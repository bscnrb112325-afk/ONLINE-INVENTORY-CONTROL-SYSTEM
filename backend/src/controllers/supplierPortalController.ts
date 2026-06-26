import type { Request, Response } from "express";
import { db } from "../db";
import { purchases, supplierBids, goods, supplierDocuments, supplierNotifications, suppliers, recommendations } from "../db/schema";
import { eq, count } from "drizzle-orm";

export const getSupplierOrders = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const orders = await db.query.purchases.findMany({
      where: eq(purchases.supplierId, supplierId),
      with: {
        goods: {
          with: {
            subCategory: true
          }
        }
      },
      orderBy: (fields: any, { desc }: any) => [desc(fields.createdAt)]
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const { status } = req.body; // 'accepted', 'rejected', 'shipped', or 'completed'
    
    if (!['accepted', 'rejected', 'shipped', 'completed'].includes(status)) {
       res.status(400).json({ error: "Invalid status update" });
       return;
    }

    const [updatedOrder] = await db.update(purchases)
      .set({ status })
      .where(eq(purchases.id, orderId))
      .returning();

    // If marked as completed, we need to increase the stock level
    if (status === 'completed' && updatedOrder.goodId) {
       const good = await db.query.goods.findFirst({
         where: eq(goods.id, updatedOrder.goodId)
       });
       
       if (good) {
         await db.update(goods)
           .set({ qty: good.qty + updatedOrder.expectedQty })
           .where(eq(goods.id, good.id));
           
         // Emit stock updated event
         const { eventBus } = await import("../services/eventBus");
         await eventBus.publish("STOCK_UPDATED", "inventory", {
           goodId: good.id,
           newQty: good.qty + updatedOrder.expectedQty,
           change: updatedOrder.expectedQty,
           reason: "Purchase order delivered"
         });
       }
    }

    res.json(updatedOrder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpenRequests = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    
    // Find all 'restock' recommendations that are 'pending'
    const openRequests = await db.query.recommendations.findMany({
      where: eq(recommendations.status, "pending"),
      with: {
        good: {
          with: { subCategory: true }
        },
        supplierBids: true
      },
      orderBy: (fields: any, { desc }: any) => [desc(fields.createdAt)]
    });

    // Filter out requests that this supplier has already bid on
    const availableRequests = openRequests.filter((req: any) => {
      // Check if any of the bids on this recommendation are from the current supplier
      const hasBid = req.supplierBids.some((bid: any) => bid.supplierId === supplierId);
      return !hasBid && req.action === "restock";
    });

    res.json(availableRequests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSupplierBids = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const bids = await db.query.supplierBids.findMany({
      where: eq(supplierBids.supplierId, supplierId),
      with: {
        recommendation: {
          with: {
            good: {
              with: {
                subCategory: true
              }
            }
          }
        }
      },
      orderBy: (fields: any, { desc }: any) => [desc(fields.createdAt)]
    });
    res.json(bids);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const submitNewSupplierBid = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const { recommendationId, bidPrice, deliveryTimeDays } = req.body;
    
    const [newBid] = await db.insert(supplierBids).values({
      recommendationId,
      supplierId,
      bidPrice: bidPrice.toString(),
      deliveryTimeDays: parseInt(deliveryTimeDays, 10),
      reliabilityScore: "5.0", // Default score for new bids
      status: "submitted"
    }).returning();
    
    const { eventBus } = await import("../services/eventBus");
    await eventBus.publish("SUPPLIER_BID_SUBMITTED", "procurement", {
      recommendationId,
      bidId: newBid.id
    });
      
    res.json(newBid);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    
    const allOrders = await db.query.purchases.findMany({
      where: eq(purchases.supplierId, supplierId)
    });
    
    const allBids = await db.query.supplierBids.findMany({
      where: eq(supplierBids.supplierId, supplierId)
    });
    
    const unreadNotifications = await db.query.supplierNotifications.findMany({
      where: eq(supplierNotifications.supplierId, supplierId)
    });

    const stats = {
      activeOrders: allOrders.filter((o: any) => o.status === 'pending').length,
      acceptedOrders: allOrders.filter((o: any) => o.status === 'accepted').length,
      shippedOrders: allOrders.filter((o: any) => o.status === 'shipped').length,
      completedOrders: allOrders.filter((o: any) => o.status === 'completed').length,
      pendingBids: allBids.filter((b: any) => b.status === 'pending').length,
      unreadNotificationsCount: unreadNotifications.filter((n: any) => !n.isRead).length
    };
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSupplierGoods = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const items = await db.query.goods.findMany({
      where: eq(goods.supplierId, supplierId),
      with: { subCategory: true }
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGoodPrice = async (req: Request, res: Response) => {
  try {
    const goodId = req.params.goodId as string;
    const { buyRate } = req.body;
    
    const [updatedGood] = await db.update(goods)
      .set({ buyRate: buyRate.toString() })
      .where(eq(goods.id, goodId))
      .returning();
      
    res.json(updatedGood);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSupplierNotifications = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const notifs = await db.query.supplierNotifications.findMany({
      where: eq(supplierNotifications.supplierId, supplierId),
      orderBy: (fields: any, { desc }: any) => [desc(fields.createdAt)]
    });
    res.json(notifs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const notifId = req.params.notifId as string;
    await db.update(supplierNotifications)
      .set({ isRead: true })
      .where(eq(supplierNotifications.id, notifId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSupplierDocuments = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const docs = await db.query.supplierDocuments.findMany({
      where: eq(supplierDocuments.supplierId, supplierId),
      orderBy: (fields: any, { desc }: any) => [desc(fields.createdAt)]
    });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const { title, type, fileUrl, purchaseId } = req.body;
    
    const [newDoc] = await db.insert(supplierDocuments).values({
      supplierId,
      title,
      type,
      fileUrl,
      purchaseId: purchaseId || null,
    }).returning();
    
    res.json(newDoc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSupplierProfile = async (req: Request, res: Response) => {
  try {
    const supplierId = req.params.supplierId as string;
    const { name, email, phone, address, categoryOfGoods, paymentMode, mpesaDetails, cardDetails } = req.body;
    
    const [updatedSupplier] = await db.update(suppliers)
      .set({ name, email, phone, address, categoryOfGoods, paymentMode, mpesaDetails, cardDetails })
      .where(eq(suppliers.id, supplierId))
      .returning();
      
    res.json(updatedSupplier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const registerSupplier = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, categoryOfGoods } = req.body;
    
    const [newSupplier] = await db.insert(suppliers).values({
      name, email, phone, address, categoryOfGoods
    }).returning();
    
    res.status(201).json(newSupplier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
