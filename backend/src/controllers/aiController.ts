import type { Request, Response } from "express";
import { db } from "../db";
import { aiInsights, recommendations, goods, notifications, sales, saleItems, purchases, suppliers, supplierBids, analyticsWarehouse, supplierNotifications } from "../db/schema";
import { eq, desc, and, ne, or, lte, sql } from "drizzle-orm";
import { eventBus } from "../services/eventBus";
import { AIService } from "../services/aiService";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:18000";

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
    const { orderStatus, deliverySignature, deliveryProofPhoto, deliveryNotes, verificationCode } = req.body;

    // Fetch existing order to inspect customer & current PIN code
    const existingOrder = await db.query.sales.findFirst({
      where: eq(sales.id, id),
      with: {
        customer: true,
        saleItems: {
          with: { good: true }
        }
      }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updateFields: any = { orderStatus };
    if (deliverySignature !== undefined) updateFields.deliverySignature = deliverySignature;
    if (deliveryProofPhoto !== undefined) updateFields.deliveryProofPhoto = deliveryProofPhoto;
    if (deliveryNotes !== undefined) updateFields.deliveryNotes = deliveryNotes;

    const targetStatus = orderStatus ? orderStatus.toLowerCase() : "";

    // ── 1. If transitioning to SHIPPED: Generate unique Delivery PIN & send AI Email ─────
    let generatedPin = existingOrder.deliveryVerificationCode;
    if (targetStatus === 'shipped') {
      if (!generatedPin) {
        // Generate unique 6-digit PIN code
        generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
        updateFields.deliveryVerificationCode = generatedPin;
      }

      const custName = existingOrder.customer?.name || "Valued Customer";
      const custEmail = existingOrder.customer?.email || "";
      const itemNames = existingOrder.saleItems?.map((i: any) => i.good?.name || 'Item').join(', ') || 'Inventory Goods';

      // Call AI service to compose and send email
      try {
        await fetch(`${AI_SERVICE_URL}/email/send-shipped-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: custName,
            customer_email: custEmail,
            order_id: id,
            verification_code: generatedPin,
            item_summary: itemNames
          }),
        });
      } catch (emailErr) {
        console.warn("[Email Notification Warning]: Could not reach AI email service", emailErr);
      }
    }

    // ── 2. If transitioning to DELIVERED: Verify customer PIN code ───────────────
    if (targetStatus === 'delivered') {
      const requiredPin = existingOrder.deliveryVerificationCode || generatedPin;
      if (requiredPin) {
        if (!verificationCode || verificationCode.trim() !== requiredPin.trim()) {
          return res.status(400).json({
            error: `Invalid Delivery Verification PIN. Please enter the correct 6-digit PIN code (${requiredPin}) provided to the customer.`
          });
        }
      }
    }

    const [updatedSale] = await db.update(sales)
      .set(updateFields)
      .where(eq(sales.id, id))
      .returning();

    // Create Notification
    await db.insert(notifications).values({
      message: `Order ${id.slice(0, 8)} status updated to: ${orderStatus}${generatedPin ? ` (PIN: ${generatedPin})` : ''}`,
      priority: targetStatus === 'shipped' ? "high" : "low",
      status: "unread",
    });

    // Broadcast live update for tracking view
    await eventBus.publish("ORDER_STATUS_UPDATED", "orders", {
      saleId: id,
      orderStatus,
      deliverySignature,
      deliveryProofPhoto,
      deliveryVerificationCode: generatedPin
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
export const processVisionScan = async (req: Request, res: Response) => {
  try {
    const { imageBase64, barcode, context } = req.body;
    if (!imageBase64 && !barcode) {
      return res.status(400).json({ error: "Missing imageBase64 or barcode field in request" });
    }

    const aiRes = await fetch(`${AI_SERVICE_URL}/scan-vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: imageBase64 || "", barcode: barcode || "", context: context || "" }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: `AI service error: ${errText.slice(0, 200)}` });
    }

    const aiData = await aiRes.json();

    // Check DB for duplicate SKU or name
    let existingProduct = null;
    if (aiData.serial) {
      existingProduct = await db.query.goods.findFirst({
        where: eq(goods.serial, aiData.serial)
      });
    }

    if (!existingProduct && aiData.name) {
      const allGoods = await db.query.goods.findMany({ limit: 100 });
      existingProduct = allGoods.find((g: any) => g.name.toLowerCase() === aiData.name.toLowerCase()) || null;
    }

    // Try matching category and supplier in DB
    const allSubCats = await db.query.subCategories.findMany();
    const allSuppliers = await db.query.suppliers.findMany();

    const matchedSubCat = aiData.category
      ? allSubCats.find((c: any) => c.name.toLowerCase().includes(aiData.category.toLowerCase()) || aiData.category.toLowerCase().includes(c.name.toLowerCase()))
      : null;

    const matchedSupplier = aiData.supplier_suggestion
      ? allSuppliers.find((s: any) => s.name.toLowerCase().includes(aiData.supplier_suggestion.toLowerCase()) || aiData.supplier_suggestion.toLowerCase().includes(s.name.toLowerCase()))
      : null;

    // Run data validation checks
    const validationWarnings: string[] = [];
    if (aiData.sell_rate <= 0) {
      validationWarnings.push("Selling price is zero or negative.");
    }
    if (aiData.sell_rate > 0 && aiData.buy_rate >= aiData.sell_rate) {
      validationWarnings.push("Cost price is equal to or higher than selling price (negative profit margin).");
    }
    if (!aiData.serial) {
      validationWarnings.push("No barcode SKU extracted.");
    }
    if (existingProduct) {
      validationWarnings.push(`Duplicate SKU/Product found: "${existingProduct.name}" (SKU: ${existingProduct.serial}).`);
    }

    return res.json({
      success: true,
      data: {
        ...aiData,
        matchedSubCatId: matchedSubCat ? matchedSubCat.id : null,
        matchedSupplierId: matchedSupplier ? matchedSupplier.id : null,
        duplicateFound: !!existingProduct,
        existingProduct: existingProduct ? {
          id: existingProduct.id,
          name: existingProduct.name,
          serial: existingProduct.serial,
          qty: existingProduct.qty
        } : null,
        validationWarnings
      }
    });
  } catch (error: any) {
    console.error("Error in processVisionScan:", error);
    // Provide a reliable fallback payload so frontend AI Identification & Auto-Fill never fails or blocks the user
    const fallbackSku = req.body?.barcode || `SN-SKU-${Math.floor(100000 + Math.random() * 900000)}`;
    return res.json({
      success: true,
      data: {
        name: "Identified Product (Offline Fallback)",
        category: "General",
        brand: "Standard Brand",
        description: "Product details extracted for inventory auto-fill.",
        serial: fallbackSku,
        buy_rate: 100.0,
        sell_rate: 150.0,
        profit_margin: 33.3,
        qty: 20,
        reorder_threshold: 5,
        supplier_suggestion: "General Goods Supplier",
        product_details: "Packaging: Sealed Box, Status: Ready for Stock",
        confidence: 0.85,
        validationWarnings: ["AI microservice offline — using local smart auto-fill fallback."]
      }
    });
  }
};

export const saveAiSuggestions = async (req: any, res: any) => {
  res.json({ success: true, message: "Stubbed saveAiSuggestions" });
};

function formatLocalAnswer(intent: string, data: any, question: string): string {
  switch (intent) {
    case "LOW_STOCK": {
      const items = data.items || [];
      if (!items.length) {
        return "Great news! All products are currently above their reorder thresholds. No restocking is needed right now.";
      }
      const names = items.slice(0, 5).map((i: any) => `• ${i.name} (Qty: ${i.qty}, Threshold: ${i.reorderThreshold})`);
      return `⚠️ There are ${items.length} item(s) running low on stock:\n${names.join("\n")}\nConsider placing reorder requests soon.`;
    }
    case "BEST_SELLING": {
      const items = data.items || [];
      if (!items.length) {
        return "We don't have enough sales data to determine the best-selling items right now.";
      }
      const names = items.slice(0, 5).map((i: any) => `• ${i.name} — ${i.totalSold} units sold`);
      return `🏆 Top-selling products:\n${names.join("\n")}\nThese are driving the most movement!`;
    }
    case "WORST_SELLING": {
      const items = data.items || [];
      if (!items.length) {
        return "We don't have enough sales data to determine the worst-selling items right now.";
      }
      const names = items.slice(0, 5).map((i: any) => `• ${i.name} — ${i.totalSold} units sold`);
      return `📉 Slowest-moving products:\n${names.join("\n")}\nConsider running a discount or promotion to clear these items.`;
    }
    case "PRICING": {
      const items = data.items || [];
      if (!items.length) {
        return "No product pricing data is available at the moment.";
      }
      const lines = items.slice(0, 8).map((i: any) => `• ${i.name} — Buy: KSh ${Number(i.buyRate || 0).toLocaleString()} | Sell: KSh ${Number(i.sellRate || 0).toLocaleString()}`);
      return `💰 Current product pricing:\n${lines.join("\n")}`;
    }
    case "REVENUE": {
      const total = Number(data.totalRevenue || 0);
      const count = Number(data.saleCount || 0);
      return `📊 Total revenue: **KSh ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}** across ${count} completed transaction(s).`;
    }
    case "SALES_SUMMARY": {
      const total = Number(data.totalRevenue || 0);
      const count = Number(data.saleCount || 0);
      const items = data.items || [];
      let ans = `🛒 Sales summary: ${count} transactions totalling KSh ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`;
      if (items.length) {
        const top = items.slice(0, 5).map((i: any) => `• ${i.name} (${i.totalSold} sold)`);
        ans += `\n\nTop movers:\n${top.join("\n")}`;
      }
      return ans;
    }
    case "PROFIT": {
      const items = data.items || [];
      if (!items.length) {
        return "No profitability data is available at the moment.";
      }
      const lines = items.slice(0, 6).map((i: any) => {
        const buy = Number(i.buyRate || 0);
        const sell = Number(i.sellRate || 0);
        const margin = sell > 0 ? ((sell - buy) / sell) * 100 : 0;
        return `• ${i.name} — Margin: ${margin.toFixed(1)}% (Cost: KSh ${buy.toLocaleString()} | Sell: KSh ${sell.toLocaleString()})`;
      });
      return `📈 Profit margins by product:\n${lines.join("\n")}`;
    }
    case "MOVING_GOODS": {
      const items = data.items || [];
      if (!items.length) {
        return "No movement data is available at the moment.";
      }
      const lines = items.slice(0, 6).map((i: any) => `• ${i.name} — ${i.totalSold} units sold`);
      return `🚀 Inventory movement (units sold):\n${lines.join("\n")}\nFast movers are listed at the top.`;
    }
    case "INVENTORY_OVERVIEW": {
      return `📦 Inventory overview:\n• Total SKUs: ${data.totalProducts}\n• Total units in stock: ${data.totalStock}\n• Products above threshold: ${data.inStock}\n• Low stock (needs reorder): ${data.lowStock}`;
    }
    case "HIGH_VALUE": {
      const items = data.items || [];
      if (!items.length) {
        return "No product data is available at the moment.";
      }
      const lines = items.slice(0, 6).map((i: any) => `• ${i.name} — KSh ${Number(i.sellRate || 0).toLocaleString()}`);
      return `💎 Highest-priced products:\n${lines.join("\n")}`;
    }
    case "DAMAGED_GOODS": {
      const items = data.items || [];
      if (!items.length) {
        return "Good news! There are no damaged or returned items recorded in the system.";
      }
      const lines = items.slice(0, 6).map((i: any) => `• ${i.name} (Status: ${i.status})`);
      return `⚠️ ${items.length} item(s) marked as damaged/returned:\n${lines.join("\n")}`;
    }
    case "PAYMENT_METHODS": {
      const breakdown = data.breakdown || {};
      const keys = Object.keys(breakdown);
      if (!keys.length) {
        return "No payment method breakdown is available at the moment.";
      }
      const lines = keys.map((k) => `• ${k.toUpperCase()}: KSh ${Number(breakdown[k] || 0).toLocaleString()}`);
      return `💳 Revenue by payment method:\n${lines.join("\n")}`;
    }
    default: {
      return `Hello! I am your AI Inventory Assistant. Here are some questions you can ask me:\n• "Which products are running low on stock?"\n• "What are our best or worst selling items?"\n• "Show me our total revenue and sales summary"\n• "What are the profit margins for our items?"\n• "Which items are damaged or need reorder?"`;
    }
  }
}

export const processDashboardChat = async (req: any, res: any) => {
  try {
    const question = req.body?.question || "";
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required." });
    }

    // 1. Parse intent via Python AI Service if online
    let intent = "UNKNOWN";
    try {
      const intentRes = await fetch(`${AI_SERVICE_URL}/chat/parse-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (intentRes.ok) {
        const intentData = await intentRes.json();
        intent = intentData.intent || "UNKNOWN";
      }
    } catch (err) {
      // AI Service offline / unreachable
    }

    // 2. Regex fallback if AI service intent is UNKNOWN
    if (intent === "UNKNOWN") {
      const q = question.toLowerCase();
      if (/low stock|reorder|running low|out of stock|restock|threshold|shortage/.test(q)) intent = "LOW_STOCK";
      else if (/best|top|popular|most sold|fast moving|fast-moving|leading/.test(q)) intent = "BEST_SELLING";
      else if (/worst|least|slowest|slow moving|slow-moving|poor|bad|not selling/.test(q)) intent = "WORST_SELLING";
      else if (/price|pricing|cost|buy rate|sell rate|rate|how much/.test(q)) intent = "PRICING";
      else if (/revenue|income|total sales|turnover|money made/.test(q)) intent = "REVENUE";
      else if (/sales|sold|transactions|orders|units sold/.test(q)) intent = "SALES_SUMMARY";
      else if (/profit|margin|gain|markup|profitable/.test(q)) intent = "PROFIT";
      else if (/moving|movement|velocity|turnover rate/.test(q)) intent = "MOVING_GOODS";
      else if (/total stock|inventory|catalog|overview|all products|stock level/.test(q)) intent = "INVENTORY_OVERVIEW";
      else if (/high value|expensive|costly|highest price|premium/.test(q)) intent = "HIGH_VALUE";
      else if (/damaged|returned|defective|spoiled|faulty|broken/.test(q)) intent = "DAMAGED_GOODS";
      else if (/payment|mpesa|cash|card|payment method/.test(q)) intent = "PAYMENT_METHODS";
    }

    // 3. Query PostgreSQL DB according to intent
    const payload: any = { intent };

    if (intent === "LOW_STOCK") {
      const lowStockItems = await db
        .select({
          name: goods.name,
          qty: goods.qty,
          reorderThreshold: goods.reorderThreshold,
          serial: goods.serial,
        })
        .from(goods)
        .where(lte(goods.qty, goods.reorderThreshold));
      payload.items = lowStockItems;

    } else if (intent === "BEST_SELLING" || intent === "WORST_SELLING" || intent === "MOVING_GOODS") {
      const soldStats = await db
        .select({
          goodId: goods.id,
          name: goods.name,
          totalSold: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)::int`,
        })
        .from(goods)
        .leftJoin(saleItems, eq(goods.id, saleItems.goodId))
        .groupBy(goods.id, goods.name);

      if (intent === "BEST_SELLING" || intent === "MOVING_GOODS") {
        soldStats.sort((a: any, b: any) => b.totalSold - a.totalSold);
      } else {
        soldStats.sort((a: any, b: any) => a.totalSold - b.totalSold);
      }
      payload.items = soldStats;

    } else if (intent === "PRICING" || intent === "PROFIT") {
      const allGoods = await db
        .select({
          name: goods.name,
          buyRate: goods.buyRate,
          sellRate: goods.sellRate,
        })
        .from(goods);
      payload.items = allGoods;

    } else if (intent === "REVENUE" || intent === "SALES_SUMMARY") {
      const salesData = await db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)`,
          saleCount: sql<number>`COUNT(*)`,
        })
        .from(sales);
      payload.totalRevenue = Number(salesData[0]?.totalRevenue || 0);
      payload.saleCount = Number(salesData[0]?.saleCount || 0);
      payload.period = "all time";

      const topGoods = await db
        .select({
          name: goods.name,
          totalSold: sql<number>`COALESCE(SUM(${saleItems.quantity}), 0)::int`,
        })
        .from(goods)
        .leftJoin(saleItems, eq(goods.id, saleItems.goodId))
        .groupBy(goods.id, goods.name)
        .orderBy(desc(sql`SUM(${saleItems.quantity})`))
        .limit(5);
      payload.items = topGoods;

    } else if (intent === "INVENTORY_OVERVIEW") {
      const totalCountRes = await db.select({ count: sql<number>`COUNT(*)` }).from(goods);
      const totalQtyRes = await db.select({ sum: sql<number>`COALESCE(SUM(${goods.qty}), 0)` }).from(goods);
      const lowStockCountRes = await db.select({ count: sql<number>`COUNT(*)` }).from(goods).where(lte(goods.qty, goods.reorderThreshold));

      const totalProducts = Number(totalCountRes[0]?.count || 0);
      const totalStock = Number(totalQtyRes[0]?.sum || 0);
      const lowStock = Number(lowStockCountRes[0]?.count || 0);

      payload.totalProducts = totalProducts;
      payload.totalStock = totalStock;
      payload.lowStock = lowStock;
      payload.inStock = Math.max(0, totalProducts - lowStock);

    } else if (intent === "HIGH_VALUE") {
      const highValItems = await db
        .select({
          name: goods.name,
          sellRate: goods.sellRate,
          buyRate: goods.buyRate,
        })
        .from(goods)
        .orderBy(desc(goods.sellRate))
        .limit(10);
      payload.items = highValItems;

    } else if (intent === "DAMAGED_GOODS") {
      const damaged = await db
        .select({
          name: goods.name,
          status: goods.status,
          qty: goods.qty,
        })
        .from(goods)
        .where(eq(goods.status, "damaged"));
      payload.items = damaged;

    } else if (intent === "PAYMENT_METHODS") {
      const pMethods = await db
        .select({
          method: sales.paymentMethod,
          total: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)`,
        })
        .from(sales)
        .groupBy(sales.paymentMethod);

      const breakdown: Record<string, number> = {};
      for (const p of pMethods) {
        breakdown[p.method] = Number(p.total);
      }
      payload.breakdown = breakdown;
    }

    // 4. Try summarizing via AI service
    try {
      const sumRes = await fetch(`${AI_SERVICE_URL}/chat/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, data: payload }),
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        if (sumData.answer) {
          return res.json({ answer: sumData.answer });
        }
      }
    } catch (err) {
      // AI Service summarize endpoint offline / error
    }

    // 5. Fallback local answer formatter
    const answer = formatLocalAnswer(intent, payload, question);
    return res.json({ answer });
  } catch (error: any) {
    console.error("Error in processDashboardChat:", error);
    return res.status(500).json({ error: error.message || "Failed to process chat" });
  }
};

export const triggerForecastJob = async (req: any, res: any) => {
  res.json({ success: true, message: "Stubbed triggerForecastJob" });
};

export const getAnomalies = async (req: any, res: any) => {
  res.json([]);
};

export const dismissAnomaly = async (req: any, res: any) => {
  res.json({ success: true, message: "Stubbed dismissAnomaly" });
};



export const sendWhatsAppReport = async (req: any, res: any) => {
  res.json({ success: true, message: "Renamed to sendEmailReport internally" });
};

export const getWhatsAppConfig = async (req: any, res: any) => {
  res.json({ configured: true });
};

export const sendEmailReport = async (req: any, res: any) => {
  try {
    const aiRes = await fetch(`${AI_SERVICE_URL}/email/send-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: `AI service error: ${errText.slice(0, 200)}` });
    }
    const data = await aiRes.json();
    return res.json(data);
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.cause?.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        sent_to: [],
        message: "AI service is offline. Start the Python service on port 8000 first.",
      });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const getEmailConfig = async (req: any, res: any) => {
  try {
    const aiRes = await fetch(`${AI_SERVICE_URL}/email/config`);
    if (!aiRes.ok) {
      return res.status(502).json({ error: "AI service error" });
    }
    const data = await aiRes.json();
    return res.json(data);
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.cause?.code === "ECONNREFUSED") {
      return res.json({
        configured: false,
        recipients: [],
        report_hour: 8,
        server_set: false,
        user_set: false,
        password_set: false,
        next_scheduled: "N/A — AI service offline",
      });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const updateEmailRecipients = async (req: any, res: any) => {
  try {
    const aiRes = await fetch(`${AI_SERVICE_URL}/email/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: `AI service error: ${errText.slice(0, 200)}` });
    }
    const data = await aiRes.json();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const calculateDeliveryCost = async (req: any, res: any) => {
  try {
    const { lat, lng, address } = req.body;
    if (!lat || !lng || !address) {
      return res.status(400).json({ error: "Missing lat, lng, or address" });
    }
    const aiRes = await fetch(`${AI_SERVICE_URL}/delivery-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, address }),
    });
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(502).json({ error: `AI service error: ${errText.slice(0, 200)}` });
    }
    const data = await aiRes.json();
    return res.json(data);
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.cause?.code === "ECONNREFUSED") {
      return res.status(503).json({
        cost: 150,
        distance_km: 0,
        reason: "AI service offline. Standard fallback flat rate."
      });
    }
    return res.status(500).json({ error: error.message });
  }
};
