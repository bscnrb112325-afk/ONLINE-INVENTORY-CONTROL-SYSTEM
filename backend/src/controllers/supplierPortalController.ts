import type { Request, Response } from "express";
import { db } from "../db";
import { purchases, supplierBids, goods } from "../db/schema";
import { eq } from "drizzle-orm";

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
    const { status } = req.body; // 'shipped' or 'completed'
    
    if (!['shipped', 'completed'].includes(status)) {
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

export const submitSupplierBid = async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const { bidPrice, deliveryTimeDays } = req.body;
    
    const [updatedBid] = await db.update(supplierBids)
      .set({ 
        bidPrice: bidPrice.toString(), 
        deliveryTimeDays: parseInt(deliveryTimeDays, 10),
        status: 'submitted' 
      })
      .where(eq(supplierBids.id, bidId))
      .returning();
      
    res.json(updatedBid);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
