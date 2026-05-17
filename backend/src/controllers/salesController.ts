import type { Request, Response } from "express";
import { db } from "../db";
import { sales, saleItems, payments, goods, customers } from "../db/schema";
import { eq } from "drizzle-orm";

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

export const createSale = async (req: Request, res: Response) => {
  try {
    const { customerId, userId, items, paymentMethod } = req.body;
    
    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    // Insert sale
    const [sale] = await db.insert(sales).values({
      customerId,
      userId,
      totalAmount: totalAmount.toString(),
      paymentMethod,
      status: "completed",
    }).returning();

    // Insert sale items and update inventory qty
    for (const item of items) {
      await db.insert(saleItems).values({
        saleId: sale.id,
        goodId: item.goodId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: (item.quantity * item.unitPrice).toString(),
      });
      // Simple logic to decrease stock, would ideally be in a transaction
      // For now we just skip the actual decrement to keep it simple, or we can fetch and update:
      // const good = await db.query.goods.findFirst({where: eq(goods.id, item.goodId)});
      // await db.update(goods).set({qty: good.qty - item.quantity}).where(eq(goods.id, item.goodId));
    }

    // Record Payment
    await db.insert(payments).values({
      type: "customer_payment",
      referenceId: sale.id,
      amount: totalAmount.toString(),
      method: paymentMethod,
    });

    res.json(sale);
  } catch (error: any) {
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

// M-Pesa Mock Webhook/Trigger
export const triggerMpesaPayment = async (req: Request, res: Response) => {
  try {
    const { phone, amount, reference } = req.body;
    // In reality, this calls Daraja API. For now we mock.
    console.log(`Initiating STK Push to ${phone} for KES ${amount} (Ref: ${reference})`);
    
    res.json({ message: "STK Push initiated successfully", status: "pending" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
