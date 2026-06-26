import type { Request, Response } from "express";
import { db } from "../db";
import { aiInsights, recommendations, goods, notifications, sales, purchases, suppliers, supplierBids, analyticsWarehouse, supplierNotifications } from "../db/schema";
import { eq, desc, and, ne, or } from "drizzle-orm";
import { eventBus } from "../services/eventBus";
import { AIService } from "../services/aiService";

// Get all AI Insights
export const getAIInsights = async (req: Request, res: Response) => {
  try {
    const insights = await db.query.aiInsights.findMany({
      orderBy: [desc(aiInsights.createdAt)],
      with: {
        good: {
          with: {
            subCategory: true
          }
        }
      },
      limit: 10,
    });
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAnalyticsWarehouse = async (req: Request, res: Response) => {
  try {
    const data = await db.query.analyticsWarehouse.findMany({
      orderBy: [desc(analyticsWarehouse.createdAt)],
      limit: 30, // last 30 days
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending and review recommendations
export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const recs = await db.query.recommendations.findMany({
      where: or(eq(recommendations.status, "pending"), eq(recommendations.status, "review")),
      orderBy: [desc(recommendations.createdAt)],
      with: {
        good: {
          with: {
            subCategory: true
          }
        }
      }
    });
    res.json(recs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Send draft recommendations to supplier portal
export const sendRecommendationsToSuppliers = async (req: Request, res: Response) => {
  try {
    const { items } = req.body; // Array of { id: string, qty: number }
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items payload" });
    }

    const allSuppliers = await db.query.suppliers.findMany();

    for (const item of items) {
      const { id, qty } = item;
      
      const rec = await db.query.recommendations.findFirst({
        where: eq(recommendations.id, id),
        with: { good: true }
      });
      
      if (!rec || rec.status !== "review") continue;

      // Update recommendation to pending and update quantity
      await db.update(recommendations)
        .set({ 
          status: "pending", 
          recommendedQty: Number(qty),
          reason: `Reviewed AI Restock Request: Restock ${qty} units`
        })
        .where(eq(recommendations.id, id));

      // Broadcast notifications and create pending bids
      if (allSuppliers.length > 0 && rec.good) {
        const notificationValues = allSuppliers.map((supplier: any) => ({
          supplierId: supplier.id,
          message: `Inventory Alert: Restock requested for ${rec.good.name || rec.good.serial} (Qty: ${qty})`,
          isRead: false
        }));
        await db.insert(supplierNotifications).values(notificationValues);

        const bidValues = allSuppliers.map((supplier: any) => ({
          recommendationId: rec.id,
          supplierId: supplier.id,
          bidPrice: rec.good.buyRate, // Default
          deliveryTimeDays: 7, 
          reliabilityScore: 1.0,
          status: "pending"
        }));
        await db.insert(supplierBids).values(bidValues);
      }
    }

    res.json({ message: "Recommendations successfully sent to supplier portal" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Analyze all stock and generate recommendations
export const analyzeStock = async (req: Request, res: Response) => {
  try {
    const allGoods = await db.query.goods.findMany();
    const pendingRecs = await db.query.recommendations.findMany({
      where: or(eq(recommendations.status, "pending"), eq(recommendations.status, "review"))
    });
    
    const pendingProductIds = new Set(pendingRecs.map((r: any) => r.productId));
    const newRecommendations = [];

    for (const product of allGoods) {
      const threshold = product.reorderThreshold || 10;
      if (product.qty <= threshold && !pendingProductIds.has(product.id)) {
        const recommendedQty = 50; // standard restock batch
        const [rec] = await db.insert(recommendations).values({
          productId: product.id,
          action: "restock",
          reason: `AI Scan: Stock level is ${product.qty} units (Threshold: ${threshold}). Recommended Restock: ${recommendedQty} units.`,
          recommendedQty: recommendedQty,
          status: "review",
        }).returning();
        
        newRecommendations.push(rec);
      }
    }

    res.json({ message: "Analysis complete", newRecommendationsFound: newRecommendations.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Approve a recommendation (e.g. restock or price adjust)
export const approveRecommendation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const rec = await db.query.recommendations.findFirst({
      where: eq(recommendations.id, id),
      with: { good: true }
    });

    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    if (rec.status !== "pending") {
      return res.status(400).json({ error: "Recommendation already processed" });
    }

    // Mark as approved
    await db.update(recommendations)
      .set({ status: "approved" })
      .where(eq(recommendations.id, id));

    const product = rec.good;
    const parsedReason = rec.reason;

    if (rec.action === "restock") {
      // Parse restocking quantity from reason, or default to 50
      let restockQty = 50;
      const match = parsedReason.match(/Restock (\d+) units/i);
      if (match && match[1]) {
        restockQty = parseInt(match[1]);
      }

      // 1. Find or create a dummy supplier
      let supplier = await db.query.suppliers.findFirst();
      if (!supplier) {
        const [newSupplier] = await db.insert(suppliers).values({
          name: "Global AI Auto-Supplier",
          email: "procurement@autosupply.com",
          phone: "555-0199",
          address: "Auto-Distributor Hub",
        }).returning();
        supplier = newSupplier;
      }

      // 2. Fetch first user ID to record purchase (or system user)
      const userList = await db.query.users.findMany();
      const userId = userList.length > 0 ? userList[0].id : "system";

      // 3. Record supplier purchase
      const totalCost = restockQty * parseFloat(product.buyRate);
      const [purchase] = await db.insert(purchases).values({
        supplierId: supplier.id,
        userId: userId,
        totalAmount: totalCost.toString(),
        status: "completed",
      }).returning();

      // 4. Update inventory stock qty
      const newQty = product.qty + restockQty;
      await db.update(goods)
        .set({ qty: newQty, status: "in_stock" })
        .where(eq(goods.id, product.id));

      // 5. Notify Event Bus
      await eventBus.publish("STOCK_UPDATED", "inventory", {
        goodId: product.id,
        qty: newQty,
        sellRate: parseFloat(product.sellRate),
        serial: product.serial,
      });

      // 6. Add notification
      await db.insert(notifications).values({
        message: `Restocked ${restockQty} units of ${product.serial} via AI Procurement approval.`,
        priority: "medium",
        status: "unread",
      });

    } else if (rec.action === "price_adjust") {
      // Parse dynamic price from reason or AI insights
      let newPrice = parseFloat(product.sellRate);
      const match = parsedReason.match(/\$?(\d+(\.\d+)?)/);
      if (match && match[1]) {
        newPrice = parseFloat(match[1]);
      }

      // Update product's sell rate
      await db.update(goods)
        .set({ sellRate: newPrice.toString() })
        .where(eq(goods.id, product.id));

      // Notify Event Bus
      await eventBus.publish("STOCK_UPDATED", "inventory", {
        goodId: product.id,
        qty: product.qty,
        sellRate: newPrice,
        serial: product.serial,
      });

      // Add notification
      await db.insert(notifications).values({
        message: `Price of ${product.serial} adjusted to $${newPrice} via dynamic pricing approval.`,
        priority: "low",
        status: "unread",
      });
    }

    res.json({ message: "Recommendation approved and executed successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Dismiss a recommendation
export const dismissRecommendation = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await db.update(recommendations)
      .set({ status: "dismissed" })
      .where(eq(recommendations.id, id));
    res.json({ message: "Recommendation dismissed" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifs = await db.query.notifications.findMany({
      orderBy: [desc(notifications.createdAt)],
    });
    res.json(notifs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Mark notification as read
export const readNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await db.update(notifications)
      .set({ status: "read" })
      .where(eq(notifications.id, id));
    res.json({ message: "Notification marked as read" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all orders (sales tracking)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await db.query.sales.findMany({
      orderBy: [desc(sales.createdAt)],
      with: {
        saleItems: {
          with: {
            good: {
              with: {
                subCategory: true
              }
            }
          }
        },
        customer: true,
        user: true,
      }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update order status (delivery stage pipeline)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { orderStatus } = req.body;

    const [updatedSale] = await db.update(sales)
      .set({ orderStatus })
      .where(eq(sales.id, id))
      .returning();

    // Create Notification
    await db.insert(notifications).values({
      message: `Order ${id.slice(0, 8)} status updated to: ${orderStatus}`,
      priority: "low",
      status: "unread",
    });

    // Broadcast the live update for the customer tracking view
    await eventBus.publish("ORDER_STATUS_UPDATED", "orders", {
      saleId: id,
      orderStatus
    });

    res.json(updatedSale);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get bids for a recommendation with AI scoring recommendation
export const getBidsForRecommendation = async (req: Request, res: Response) => {
  try {
    const recId = req.params.recId as string;
    const rec = await db.query.recommendations.findFirst({
      where: eq(recommendations.id, recId)
    });
    if (!rec) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    const bids = await db.query.supplierBids.findMany({
      where: eq(supplierBids.recommendationId, recId),
      with: {
        supplier: true
      }
    });

    // Call AI service to evaluate bids
    let aiSuggestion = null;
    if (bids.length > 0) {
      aiSuggestion = await AIService.suggestBestSupplier(rec.productId, bids);
    }

    res.json({
      bids,
      aiSuggestion
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Approve a specific supplier bid
export const approveSupplierBid = async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    
    // Find the winning bid
    const winningBid = await db.query.supplierBids.findFirst({
      where: eq(supplierBids.id, bidId),
      with: {
        recommendation: {
          with: {
            good: true
          }
        },
        supplier: true
      }
    });

    if (!winningBid) {
      return res.status(404).json({ error: "Supplier bid not found" });
    }

    if (winningBid.status !== "pending") {
      return res.status(400).json({ error: "Bid is already processed" });
    }

    const recId = winningBid.recommendationId;
    const product = winningBid.recommendation.good;
    
    // 1. Mark winning bid as approved, other bids for the same recommendation as rejected
    await db.update(supplierBids)
      .set({ status: "approved" })
      .where(eq(supplierBids.id, bidId));

    const allBids = await db.query.supplierBids.findMany({
      where: eq(supplierBids.recommendationId, recId)
    });
    for (const b of allBids) {
      if (b.id !== bidId) {
        await db.update(supplierBids)
          .set({ status: "rejected" })
          .where(eq(supplierBids.id, b.id));
      }
    }

    // 2. Mark recommendation as approved
    await db.update(recommendations)
      .set({ status: "approved" })
      .where(eq(recommendations.id, recId));

    // 3. Create a pending purchase order
    const userList = await db.query.users.findMany();
    const userId = userList.length > 0 ? userList[0].id : "system"; // fallback
    
    const [purchase] = await db.insert(purchases).values({
      supplierId: winningBid.supplierId,
      userId: userId,
      totalAmount: winningBid.bidPrice,
      status: "pending",
    }).returning();

    // Associate product with the purchase order
    await db.update(goods)
      .set({ purchaseId: purchase.id })
      .where(eq(goods.id, product.id));

    // Parse restocking quantity from reason, or default to 50
    let restockQty = 50;
    const match = winningBid.recommendation.reason.match(/Restock (\d+) units/i);
    if (match && match[1]) {
      restockQty = parseInt(match[1]);
    }

    // Emit SUPPLIER_APPROVED
    await eventBus.publish("SUPPLIER_APPROVED", "procurement", {
      bidId,
      purchaseId: purchase.id,
      supplierId: winningBid.supplierId,
      supplierName: winningBid.supplier.name,
      productId: product.id,
      qty: restockQty,
      bidPrice: winningBid.bidPrice,
    });

    // Add high-priority manager notification
    await db.insert(notifications).values({
      message: `Supplier bid approved! Order created for ${restockQty} units of ${product.serial} from ${winningBid.supplier.name} for KSh ${parseFloat(winningBid.bidPrice).toLocaleString()}. Delivery expected soon.`,
      priority: "high",
      status: "unread",
    });

    res.json({ message: "Bid approved, purchase order created", purchase });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Receive physical shipment verify & confirm quantity
export const receivePurchase = async (req: Request, res: Response) => {
  try {
    const purchaseId = req.params.purchaseId as string;
    const { qty, productId } = req.body;

    if (!qty || !productId) {
      return res.status(400).json({ error: "Missing qty or productId in request body" });
    }

    // 1. Update purchase status to completed
    await db.update(purchases)
      .set({ status: "completed" })
      .where(eq(purchases.id, purchaseId));

    // 2. Fetch the current good
    const product = await db.query.goods.findFirst({
      where: eq(goods.id, productId)
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // 3. Update stock levels
    const newQty = product.qty + parseInt(qty);
    await db.update(goods)
      .set({ qty: newQty, status: "in_stock", purchaseId })
      .where(eq(goods.id, productId));

    // 4. Emit STOCK_RECEIVED -> triggers STOCK_UPDATED -> shop syncs
    await eventBus.publish("STOCK_RECEIVED", "procurement", {
      purchaseId,
      productId,
      qty: parseInt(qty),
      newQty,
      serial: product.serial,
    });

    // 5. Trigger STOCK_UPDATED on Event Bus
    await eventBus.publish("STOCK_UPDATED", "inventory", {
      goodId: productId,
      qty: newQty,
      sellRate: parseFloat(product.sellRate),
      serial: product.serial,
    });

    // 6. Notify managers
    await db.insert(notifications).values({
      message: `Delivery received: Stock level for ${product.serial} increased by ${qty} units (total: ${newQty}).`,
      priority: "medium",
      status: "unread",
    });

    res.json({ message: "Delivery received and verified successfully, stock updated" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
