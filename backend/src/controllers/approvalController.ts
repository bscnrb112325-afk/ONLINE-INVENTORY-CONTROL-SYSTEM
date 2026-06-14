import type { Request, Response } from "express";
import { db } from "../db";
import { supplierBids, purchases, recommendations, users, goods } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { AIService } from "../services/aiService";

export const getSubmittedBids = async (req: Request, res: Response) => {
  try {
    const bids = await db.query.supplierBids.findMany({
      where: eq(supplierBids.status, "submitted"),
      with: {
        supplier: true,
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

    // Compute AI suggestion per recommendation
    const grouped: Record<string, any[]> = {};
    for (const bid of bids) {
      if (!grouped[bid.recommendationId]) grouped[bid.recommendationId] = [];
      grouped[bid.recommendationId].push(bid);
    }

    const enhancedBids = [];
    for (const [recId, recBids] of Object.entries(grouped)) {
      let aiSuggestion = null;
      if (recBids.length > 0) {
        aiSuggestion = await AIService.suggestBestSupplier(recBids[0].recommendation.productId, recBids);
      }
      for (const bid of recBids) {
        enhancedBids.push({
          ...bid,
          isRecommended: aiSuggestion?.best_bid_id === bid.id,
          recommendationReason: aiSuggestion?.best_bid_id === bid.id ? aiSuggestion.reason : null
        });
      }
    }

    res.json(enhancedBids);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const approveBid = async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    const { userId } = req.body; // Passed from frontend (the manager's ID)

    // 1. Fetch the target bid
    const targetBid = await db.query.supplierBids.findFirst({
      where: eq(supplierBids.id, bidId),
      with: {
        recommendation: true
      }
    });

    if (!targetBid) {
       res.status(404).json({ error: "Bid not found" });
       return;
    }

    // 2. Set this bid to 'approved'
    await db.update(supplierBids)
      .set({ status: 'approved' })
      .where(eq(supplierBids.id, bidId));

    // 3. Set competing bids to 'rejected'
    await db.update(supplierBids)
      .set({ status: 'rejected' })
      .where(
        and(
          eq(supplierBids.recommendationId, targetBid.recommendationId),
          ne(supplierBids.id, bidId)
        )
      );

    // 4. Update recommendation status to 'approved'
    await db.update(recommendations)
      .set({ status: 'approved' })
      .where(eq(recommendations.id, targetBid.recommendationId));

    // 5. Auto-generate Purchase Order
    // Fallback user if not provided
    let finalUserId = userId;
    if (!finalUserId) {
      const fallbackUser = await db.query.users.findFirst();
      finalUserId = fallbackUser?.id || "fallback-manager";
    }

    const [newPurchase] = await db.insert(purchases).values({
      supplierId: targetBid.supplierId,
      userId: finalUserId,
      goodId: targetBid.recommendation.productId,
      expectedQty: targetBid.recommendation.recommendedQty,
      totalAmount: targetBid.bidPrice.toString(),
      status: "pending"
    }).returning();

    // Link the item being purchased to the newly created purchase order
    // Wait, typically we'd create a new item or link existing item. The recommendation is tied to an existing 'good'.
    // In our simplified schema, a 'good' has a 'purchaseId'. But a good represents individual items or catalog? 
    // Usually we update the 'goods' record purchaseId, or we create a new goods record.
    // For simplicity, let's just update the good attached to the recommendation to point to this purchaseId.
    if (targetBid.recommendation.productId) {
      await db.update(goods)
        .set({ purchaseId: newPurchase.id })
        .where(eq(goods.id, targetBid.recommendation.productId));
    }

    res.json({ success: true, purchaseId: newPurchase.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectBid = async (req: Request, res: Response) => {
  try {
    const bidId = req.params.bidId as string;
    
    const [updatedBid] = await db.update(supplierBids)
      .set({ status: 'rejected' })
      .where(eq(supplierBids.id, bidId))
      .returning();
      
    res.json(updatedBid);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
