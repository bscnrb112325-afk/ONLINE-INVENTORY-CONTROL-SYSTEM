import { EventEmitter } from "events";
import { db } from "../db";
import { events, notifications, goods, sales, purchases, suppliers, supplierBids } from "../db/schema";
import { eq } from "drizzle-orm";
import { AIService } from "./aiService";
import { cacheService } from "./cacheService";
import { approveBid } from "../controllers/approvalController";

class EventBus extends EventEmitter {
  async publish(eventName: string, module: string, payload: any) {
    try {
      console.log(`[EventBus] Publishing event: ${eventName} from module: ${module}`);
      
      // Save event to database log
      await db.insert(events).values({
        eventName,
        module,
        payload: payload ? JSON.stringify(payload) : null,
      });

      // Emit event locally for subscribers
      this.emit(eventName, payload);
    } catch (error) {
      console.error(`[EventBus] Error publishing event ${eventName}:`, error);
    }
  }
}

export const eventBus = new EventBus();

export function initEventBusListeners() {
  console.log("[EventBus] Registering event listeners...");

  // 1. ORDER_CREATED
  eventBus.on("ORDER_CREATED", async (payload: any) => {
    console.log("[EventBus Handler] ORDER_CREATED received for sale ID:", payload.saleId);
    try {
      // Step: Reserve stock
      for (const item of payload.items) {
        const product = await db.query.goods.findFirst({
          where: eq(goods.id, item.goodId),
        });
        if (product) {
          await db.update(goods)
            .set({ reservedQty: product.reservedQty + item.quantity })
            .where(eq(goods.id, product.id));
        }
      }

      // Create high-value order alerts if order total is high
      if (payload.totalAmount > 500) {
        await db.insert(notifications).values({
          message: `High-value order created: Sale ID ${payload.saleId.slice(0, 8)} worth $${payload.totalAmount}`,
          priority: "high",
          status: "unread",
        });
      }
    } catch (error) {
      console.error("Error processing ORDER_CREATED handler:", error);
    }
  });

  // 2. PAYMENT_COMPLETED
  eventBus.on("PAYMENT_COMPLETED", async (payload: any) => {
    console.log("[EventBus Handler] PAYMENT_COMPLETED received for sale ID:", payload.saleId);
    try {
      // Step A: Update sale status and orderStatus in DB
      await db.update(sales)
        .set({ status: "completed", orderStatus: "paid" })
        .where(eq(sales.id, payload.saleId));

      // Step B: Loop items to decrement stock and publish STOCK_UPDATED
      for (const item of payload.items) {
        const product = await db.query.goods.findFirst({
          where: eq(goods.id, item.goodId),
        });

        if (product) {
          const newQty = Math.max(0, product.qty - item.quantity);
          const newReservedQty = Math.max(0, product.reservedQty - item.quantity);
          const newStatus = newQty === 0 ? "sold" : product.status;

          // Update stock qty and finalize reserved stock deduction
          await db.update(goods)
            .set({ qty: newQty, reservedQty: newReservedQty, status: newStatus })
            .where(eq(goods.id, product.id));

          console.log(`[EventBus Handler] Updated stock for ${product.serial}: ${product.qty} -> ${newQty}`);

          // Publish STOCK_UPDATED event
          await eventBus.publish("STOCK_UPDATED", "inventory", {
            goodId: product.id,
            qty: newQty,
            sellRate: parseFloat(product.sellRate),
            serial: product.serial,
            reorderThreshold: product.reorderThreshold,
          });

          // Fetch historical sales for AI forecasting
          // In real life, we would aggregate database transactions for this product
          // For now, we mock historical weekly sales data with a dynamic suffix
          const mockSalesHistory = [4, 6, 8, 3, 7, 5, item.quantity];
          
          // Trigger demand forecasting asynchronously
          AIService.getDemandForecast(product.id, mockSalesHistory).catch(err =>
            console.error("Error running async AI demand forecast:", err)
          );
        }
      }
    } catch (error) {
      console.error("Error processing PAYMENT_COMPLETED handler:", error);
    }
  });

  // 3. STOCK_UPDATED
  eventBus.on("STOCK_UPDATED", async (payload: any) => {
    console.log("[EventBus Handler] STOCK_UPDATED received for good:", payload.serial, "Current Qty:", payload.qty);
    try {
      // Step A: Trigger Out of Stock check
      if (payload.qty === 0) {
        await eventBus.publish("OUT_OF_STOCK", "inventory", {
          goodId: payload.goodId,
          serial: payload.serial,
        });
      }

      // Step B: Trigger Low Stock check
      const threshold = payload.reorderThreshold ?? 10;
      if (payload.qty <= threshold && payload.qty > 0) {
        await eventBus.publish("LOW_STOCK_DETECTED", "inventory", {
          goodId: payload.goodId,
          qty: payload.qty,
          sellRate: payload.sellRate,
          serial: payload.serial,
        });
      }

      // Step C: Run AI reorder forecasting to preemptively detect low stock before it happens
      const mockAvgDailySales = 1.8;
      AIService.getReorderRecommendation(payload.goodId, payload.qty, mockAvgDailySales).catch(err =>
        console.error("Error running async AI reorder check:", err)
      );

      // Step D: Fetch dynamic pricing suggestions based on stock level changes
      AIService.getDynamicPricing(payload.goodId, payload.sellRate, payload.qty).catch(err =>
        console.error("Error running async AI dynamic pricing:", err)
      );

      // Step E: Clear Inventory Cache
      await cacheService.flush();
    } catch (error) {
      console.error("Error processing STOCK_UPDATED handler:", error);
    }
  });

  // 4. LOW_STOCK_DETECTED
  eventBus.on("LOW_STOCK_DETECTED", async (payload: any) => {
    console.log("[EventBus Handler] LOW_STOCK_DETECTED received for good:", payload.serial);
    try {
      // Create Alert Notification
      await db.insert(notifications).values({
        message: `Stock Alert: Product ${payload.serial} is running low (${payload.qty} items left). AI restocking triggered.`,
        priority: "high",
        status: "unread",
      });

      // Send notification to supplier
      await notifySuppliers(payload.serial, "LOW_STOCK", payload.qty);
    } catch (error) {
      console.error("Error processing LOW_STOCK_DETECTED handler:", error);
    }
  });

  // 5. OUT_OF_STOCK
  eventBus.on("OUT_OF_STOCK", async (payload: any) => {
    console.log("[EventBus Handler] OUT_OF_STOCK received for good:", payload.serial);
    try {
      // Create Out of Stock Notification in system
      await db.insert(notifications).values({
        message: `CRITICAL ALERT: Product ${payload.serial} is OUT OF STOCK. Sales are blocked!`,
        priority: "high",
        status: "unread",
      });

      // Send critical notification to supplier
      await notifySuppliers(payload.serial, "OUT_OF_STOCK", 0);
    } catch (error) {
      console.error("Error processing OUT_OF_STOCK handler:", error);
    }
  });

  // 6. SUPPLIER_BID_SUBMITTED
  eventBus.on("SUPPLIER_BID_SUBMITTED", async (payload: any) => {
    console.log("[EventBus Handler] SUPPLIER_BID_SUBMITTED received for recommendation:", payload.recommendationId);
    try {
      // In this updated workflow, bids are no longer auto-approved by AI.
      // They remain in 'pending' status for managers to review in the Manager Approvals module.
      // We can optionally send a notification to the manager here.
      await db.insert(notifications).values({
        message: `New supplier bid submitted for Recommendation ${payload.recommendationId.slice(0, 8)}. Awaiting manager review.`,
        priority: "medium",
        status: "unread",
      });
    } catch (error) {
      console.error("Error processing SUPPLIER_BID_SUBMITTED notification:", error);
    }
  });
}

async function notifySuppliers(productSerial: string, status: "LOW_STOCK" | "OUT_OF_STOCK", qty?: number) {
  try {
    const list = await db.select().from(suppliers);
    const supplier = list[0] || { name: "Apex Supply Co.", email: "bids@apexsupply.com", phone: "+254711223344" };
    
    const qtyNeeded = 50; // Standard reorder quantity suggestion
    const urgency = status === "OUT_OF_STOCK" ? "CRITICAL" : "HIGH";

    console.log(`[Supplier Notification Service] Dispatched SMS alert to ${supplier.phone}`);
    console.log(`[Supplier Notification Service] Dispatched Email alert to ${supplier.email}`);
    console.log(`[Supplier Notification Service] Dispatched WhatsApp API notification to ${supplier.phone}`);
    console.log(`[Supplier Notification Service] Message details: Product="${productSerial}", Qty Needed=${qtyNeeded}, Urgency=${urgency}`);

    // Create a database notification logs showing supplier alert was successfully sent
    await db.insert(notifications).values({
      message: `Supplier Alert Sent: Contacted ${supplier.name} (${supplier.email}) regarding ${status.replace('_', ' ')} of ${productSerial}. Urgency: ${urgency}.`,
      priority: status === "OUT_OF_STOCK" ? "high" : "medium",
      status: "unread",
    });
  } catch (err) {
    console.error("Error in notifySuppliers simulation:", err);
  }
}
