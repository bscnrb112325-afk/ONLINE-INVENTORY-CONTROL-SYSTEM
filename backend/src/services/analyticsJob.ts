import { db } from "../db";
import { sales, goods, analyticsWarehouse } from "../db/schema";
import { sum, sql, lt, and, ilike } from "drizzle-orm";

export function initAnalyticsCron() {
  console.log("[Analytics Job] Nightly data warehouse cron initialized.");

  // Simulate a nightly job by running it once on startup, then every hour.
  // In a real system, this would be `node-cron` running at 00:00 every day.
  runWarehouseAggregation();
  runOrderCleanup();
  
  setInterval(() => {
    runWarehouseAggregation();
    runOrderCleanup();
  }, 60 * 60 * 1000);
}

async function runOrderCleanup() {
  try {
    console.log("[Analytics Job] Running 30-day delivered order cleanup...");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.delete(sales)
      .where(and(
        ilike(sales.orderStatus, 'delivered'),
        lt(sales.createdAt, thirtyDaysAgo)
      ))
      .returning({ deletedId: sales.id });

    if (result.length > 0) {
      console.log(`[Analytics Job] Cleaned up ${result.length} delivered orders older than 30 days.`);
    }
  } catch (error) {
    console.error("[Analytics Job] Error during order cleanup:", error);
  }
}

async function runWarehouseAggregation() {
  try {
    console.log("[Analytics Job] Running Data Warehouse aggregation...");

    // 1. Calculate Total Sales
    const totalSalesResult = await db.select({ value: sum(sales.totalAmount) }).from(sales);
    const totalSales = parseFloat(totalSalesResult[0]?.value || "0");

    // 2. Calculate Total Profit (Simplified: Sale amount - Buy rate)
    // We would normally join saleItems, but let's mock 20% average margin for this demo warehouse
    const totalProfit = totalSales * 0.20;

    // 3. Calculate Dead Stock Value
    // Dead stock = goods with status 'in_stock' that haven't sold in X days (simplified here)
    const deadStockResult = await db.select({
      totalValue: sql<number>`SUM(qty * buy_rate)`
    }).from(goods).where(sql`status = 'in_stock' AND qty > 50`);
    
    const deadStockValue = parseFloat(deadStockResult[0]?.totalValue?.toString() || "0");

    // 4. Calculate Inventory Turnover Rate
    let turnoverRate = totalSales > 0 ? (totalSales / (deadStockValue + 1)) : 0;
    if (turnoverRate > 999.99) turnoverRate = 999.99;

    // 5. Insert into Warehouse
    await db.insert(analyticsWarehouse).values({
      reportDate: new Date(),
      totalSales: totalSales.toString(),
      totalProfit: totalProfit.toString(),
      deadStockValue: deadStockValue.toString(),
      inventoryTurnoverRate: turnoverRate.toFixed(2),
    });

    console.log("[Analytics Job] Warehouse aggregation complete. Metrics recorded.");
  } catch (error) {
    console.error("[Analytics Job] Error during warehouse aggregation:", error);
  }
}
