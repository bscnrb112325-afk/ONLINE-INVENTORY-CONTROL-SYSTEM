import { db } from "../db";
import { aiInsights, recommendations, supplierBids, suppliers, goods } from "../db/schema";
import { eq } from "drizzle-orm";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export class AIService {
  static async getDemandForecast(productId: string, historicalSales: number[]) {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, historical_sales: historicalSales }),
      });
      if (!response.ok) throw new Error(`AI service error: ${response.statusText}`);
      const data = await response.json();
      
      // Save to AI Insights in DB
      await db.insert(aiInsights).values({
        type: "demand_forecast",
        productId,
        prediction: JSON.stringify({ predictedSalesNextWeek: data.predicted_sales_next_week }),
        confidence: data.confidence_score.toString(),
      });

      return data;
    } catch (error) {
      console.error("[AIService] Error fetching demand forecast:", error);
      return null;
    }
  }

  static async getDynamicPricing(productId: string, currentPrice: number, stockLevel: number) {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/dynamic-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, current_price: currentPrice, stock_level: stockLevel }),
      });
      if (!response.ok) throw new Error(`AI service error: ${response.statusText}`);
      const data = await response.json();

      await db.insert(aiInsights).values({
        type: "dynamic_pricing",
        productId,
        prediction: JSON.stringify({ suggestedPrice: data.suggested_price, reason: data.reason }),
        confidence: data.confidence_score.toString(),
      });

      // Create recommendation if dynamic pricing action suggests discount or change
      await db.insert(recommendations).values({
        productId,
        action: "price_adjust",
        reason: `AI suggests adjusting price from $${currentPrice} to $${data.suggested_price}: ${data.reason}`,
        status: "pending",
      });

      return data;
    } catch (error) {
      console.error("[AIService] Error fetching dynamic pricing:", error);
      return null;
    }
  }

  static async getReorderRecommendation(productId: string, currentStock: number, avgDailySales: number) {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/reorder-recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          current_stock: currentStock,
          average_daily_sales: avgDailySales,
          lead_time_days: 3,
        }),
      });
      if (!response.ok) throw new Error(`AI service error: ${response.statusText}`);
      const data = await response.json();

      await db.insert(aiInsights).values({
        type: "restock",
        productId,
        prediction: JSON.stringify({ recommendedReorderQty: data.recommended_reorder_qty, reorderPoint: data.reorder_point }),
        confidence: data.confidence_score.toString(),
      });

      if (data.should_reorder) {
        const [rec] = await db.insert(recommendations).values({
          productId,
          action: "restock",
          reason: `Stock level is ${currentStock} units (Reorder point: ${data.reorder_point}). Restock ${data.recommended_reorder_qty} units.`,
          recommendedQty: data.recommended_reorder_qty,
          status: "pending",
        }).returning();

        // Simulate supplier bids
        await simulateSupplierBids(rec.id, productId, data.recommended_reorder_qty);
      }

      return data;
    } catch (error) {
      console.error("[AIService] Error fetching reorder recommendation:", error);
      return null;
    }
  }

  static async suggestBestSupplier(productId: string, bidsList: any[]) {
    try {
      const formattedBids = bidsList.map(b => ({
        id: b.id,
        supplier_name: b.supplier.name,
        bid_price: parseFloat(b.bidPrice),
        delivery_time_days: b.deliveryTimeDays,
        reliability_score: parseFloat(b.reliabilityScore)
      }));

      const response = await fetch(`${AI_SERVICE_URL}/suggest-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, bids: formattedBids }),
      });

      if (!response.ok) throw new Error(`AI service error: ${response.statusText}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[AIService] Error getting best supplier suggestion:", error);
      return null;
    }
  }
}

async function ensureDefaultSuppliers() {
  const existing = await db.select().from(suppliers);
  if (existing.length >= 3) {
    return existing.slice(0, 3);
  }
  
  const defaultSuppliers = [
    { name: "Apex Supply Co.", email: "bids@apexsupply.com", phone: "+254711223344", address: "Nairobi, Kenya" },
    { name: "Global Logistics Traders", email: "sales@globallogistics.com", phone: "+254722334455", address: "Mombasa, Kenya" },
    { name: "Zuri Prime Distributors", email: "info@zuriprime.com", phone: "+254733445566", address: "Kisumu, Kenya" },
  ];
  
  const inserted = [];
  for (const supplier of defaultSuppliers) {
    const [s] = await db.insert(suppliers).values(supplier).returning();
    inserted.push(s);
  }
  return inserted;
}

export async function simulateSupplierBids(recommendationId: string, productId: string, qty: number) {
  try {
    const product = await db.query.goods.findFirst({
      where: eq(goods.id, productId),
    });
    if (!product) return;
    
    const buyRate = parseFloat(product.buyRate.toString()) || 100.0;
    const activeSuppliers = await ensureDefaultSuppliers();
    
    // Bid 1: Standard
    await db.insert(supplierBids).values({
      recommendationId,
      supplierId: activeSuppliers[0].id,
      bidPrice: (buyRate * qty).toFixed(2),
      deliveryTimeDays: 3,
      reliabilityScore: "4.2",
      status: "pending",
    });

    // Bid 2: Cheap & Slow
    await db.insert(supplierBids).values({
      recommendationId,
      supplierId: activeSuppliers[1].id,
      bidPrice: (buyRate * qty * 0.90).toFixed(2), // 10% discount
      deliveryTimeDays: 5,
      reliabilityScore: "3.7",
      status: "pending",
    });

    // Bid 3: Fast & Expensive
    await db.insert(supplierBids).values({
      recommendationId,
      supplierId: activeSuppliers[2].id,
      bidPrice: (buyRate * qty * 1.15).toFixed(2), // 15% markup
      deliveryTimeDays: 1,
      reliabilityScore: "4.8",
      status: "pending",
    });
    
    console.log(`[Supplier Bidding] Generated 3 mock bids for recommendation ${recommendationId}`);

    // Publish event asynchronously to avoid module circularity issues
    const { eventBus } = await import("./eventBus");
    await eventBus.publish("SUPPLIER_BID_SUBMITTED", "procurement", {
      recommendationId,
      productId,
      qty,
    });
  } catch (error) {
    console.error("[Supplier Bidding] Error simulating bids:", error);
  }
}
