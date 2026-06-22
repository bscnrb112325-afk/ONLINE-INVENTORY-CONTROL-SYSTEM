import type { Request, Response } from "express";
import { db } from "../db";
import { sales, saleItems, payments, goods, customers, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { eventBus } from "../services/eventBus";
import { DarajaService } from "../services/darajaService";

export const getSales = async (req: Request, res: Response) => {
  try {
    const allSales = await db.query.sales.findMany({
      with: { saleItems: true, customer: true, user: true },
    });
    res.json(allSales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const sale = await db.query.sales.findFirst({
      where: eq(sales.id, id),
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
        user: true 
      },
    });
    if (!sale) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(sale);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSale = async (req: Request, res: Response) => {
  try {
    const { customerId, customerName, customerPhone, userId, items, discountAmount = 0, paymentMethod, payments: splitPayments, amountTendered = 0 } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    let finalCustomerId = customerId;

    // Handle ZuriShop dynamic customer creation
    if (!finalCustomerId && customerName && customerPhone) {
      // 1. Check if customer with phone exists
      const existingCustomer = await db.query.customers.findFirst({
        where: eq(customers.phone, customerPhone)
      });
      
      if (existingCustomer) {
        finalCustomerId = existingCustomer.id;
      } else {
        // 2. Create new customer
        const [newCust] = await db.insert(customers).values({
          name: customerName,
          phone: customerPhone,
          email: `${customerPhone}@customer.local`, // placeholder
        }).returning();
        finalCustomerId = newCust.id;
      }
    }
    
    // Calculate total amount
    let subTotal = 0;
    for (const item of items) {
      subTotal += item.quantity * item.unitPrice;
    }
    
    const totalAmount = Math.max(0, subTotal - discountAmount);

    // 0. Ensure user exists (to prevent foreign key violations)
    if (userId) {
      const userExists = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      if (!userExists) {
        await db.insert(users).values({ 
          id: userId, 
          email: `${userId}@system.local`, 
          name: "System User",
          phone: `SYS-${Date.now().toString().slice(-6)}`,
          password: "system_password"
        });
      }
    }

    // 1. Insert sale in Pending state
    const [sale] = await db.insert(sales).values({
      customerId: finalCustomerId || null,
      userId: userId || 'system',
      totalAmount: totalAmount.toString(),
      paymentMethod,
      status: "pending",
      orderStatus: "Pending",
    }).returning();

    // 2. Insert sale items and reduce stock
    for (const item of items) {
      await db.insert(saleItems).values({
        saleId: sale.id,
        goodId: item.goodId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: (item.quantity * item.unitPrice).toString(),
      });

      // Reduce stock
      const goodData = await db.query.goods.findFirst({
        where: eq(goods.id, item.goodId)
      });
      if (goodData) {
        await db.update(goods)
          .set({ qty: Math.max(0, goodData.qty - item.quantity) })
          .where(eq(goods.id, item.goodId));

        // Emit stock update event
        eventBus.emit("STOCK_UPDATED", {
          goodId: goodData.id,
          qty: Math.max(0, goodData.qty - item.quantity),
          serial: goodData.serial,
          sellRate: parseFloat(goodData.sellRate),
          reorderThreshold: goodData.reorderThreshold
        });
      }
    }

    // 3. Publish ORDER_CREATED
    await eventBus.publish("ORDER_CREATED", "orders", {
      saleId: sale.id,
      totalAmount,
      userId,
      customerId,
      items,
    });

    // 4. Record Payments and publish PAYMENT_COMPLETED
    if (splitPayments && Array.isArray(splitPayments)) {
      for (const pmt of splitPayments) {
        const transactionId = pmt.method === "mpesa" 
          ? "MPX" + Math.random().toString(36).substring(2, 11).toUpperCase()
          : "TX" + Math.random().toString(36).substring(2, 11).toUpperCase();

        await db.insert(payments).values({
          type: "customer_payment",
          referenceId: sale.id,
          amount: pmt.amount.toString(),
          method: pmt.method,
          transactionId,
        });
      }
    } else {
      const transactionId = paymentMethod === "mpesa" 
        ? "MPX" + Math.random().toString(36).substring(2, 11).toUpperCase()
        : "TX" + Math.random().toString(36).substring(2, 11).toUpperCase();

      await db.insert(payments).values({
        type: "customer_payment",
        referenceId: sale.id,
        amount: totalAmount.toString(),
        method: paymentMethod,
        transactionId,
      });
    }

    await eventBus.publish("PAYMENT_COMPLETED", "payments", {
      saleId: sale.id,
      items,
      totalAmount,
    });

    // Fetch the updated sale record (which will be updated by event handlers)
    const updatedSale = await db.query.sales.findFirst({
      where: eq(sales.id, sale.id),
      with: { saleItems: true }
    });

    res.json(updatedSale);
  } catch (error: any) {
    console.error("CREATE SALE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};


// POS Endpoint (Scan Barcode)
export const scanBarcode = async (req: Request, res: Response) => {
  try {
    const serial = req.params.serial as string;
    const good = await db.query.goods.findFirst({
      where: eq(goods.serial, serial),
      with: { subCategory: true }
    });
    
    if (!good) {
      return res.status(404).json({ error: "Good not found" });
    }
    
    if (good.qty <= 0) {
       return res.status(400).json({ error: "Out of stock" });
    }

    res.json(good);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Real M-Pesa STK Push
export const triggerMpesaPayment = async (req: Request, res: Response) => {
  try {
    const { phone, amount, reference } = req.body;
    
    // Fallback callback URL if ngrok is not provided by frontend. Daraja rejects localhost.
    const defaultCallback = process.env.MPESA_CALLBACK_URL || "https://mydomain.com/api/sales/mpesa/callback";
    const callbackUrl = req.body.callbackUrl || defaultCallback;

    const result = await DarajaService.stkPush(phone, amount, reference, callbackUrl);
    
    res.json({ message: "STK Push initiated successfully", status: "pending", data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Webhook Callback Endpoint
export const mpesaCallback = async (req: Request, res: Response) => {
  try {
    console.log("[M-Pesa Webhook] Callback received:", JSON.stringify(req.body, null, 2));
    
    const body = req.body?.Body?.stkCallback;
    if (!body) {
      return res.status(400).json({ error: "Invalid callback payload" });
    }

    const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = body;
    
    // ResultCode 0 means success
    if (ResultCode === 0 && CallbackMetadata) {
      const amountItem = CallbackMetadata.Item.find((i: any) => i.Name === 'Amount');
      const receiptItem = CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
      const phoneItem = CallbackMetadata.Item.find((i: any) => i.Name === 'PhoneNumber');

      const amount = amountItem?.Value;
      const receipt = receiptItem?.Value;
      const phone = phoneItem?.Value;

      console.log(`[M-Pesa Webhook] Success! Receipt: ${receipt}, Amount: ${amount}, Phone: ${phone}`);

      // Optional: Store the transaction in a dedicated mpesa_transactions table or generic events
      await eventBus.publish("MPESA_PAYMENT_RECEIVED", "payments", {
        checkoutRequestId: CheckoutRequestID,
        receipt,
        amount,
        phone,
      });

      // Notify the frontend via SSE that this specific CheckoutRequestID was successful
      await eventBus.publish("STK_PUSH_SUCCESS", "pos", { CheckoutRequestID, receipt });
    } else {
      console.error(`[M-Pesa Webhook] Failed STK Push: ${ResultDesc}`);
      await eventBus.publish("STK_PUSH_FAILED", "pos", { CheckoutRequestID, reason: ResultDesc });
    }

    // Acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error: any) {
    console.error("[M-Pesa Webhook] Error processing callback:", error);
    res.status(500).json({ error: error.message });
  }
};

// Simulator Endpoint
export const simulateMpesaCallback = async (req: Request, res: Response) => {
  try {
    const { checkoutRequestId, amount, phone } = req.body;
    
    // Emit success
    await eventBus.publish("STK_PUSH_SUCCESS", "pos", { 
      CheckoutRequestID: checkoutRequestId, 
      receipt: "SIM" + Math.random().toString().slice(2, 10).toUpperCase() 
    });

    res.json({ message: "Simulated success callback fired" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
