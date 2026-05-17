import type { Request, Response } from "express";
import { db } from "../db";
import { purchases, suppliers } from "../db/schema";
import { eq } from "drizzle-orm";

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const allSuppliers = await db.query.suppliers.findMany();
    res.json(allSuppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address } = req.body;
    const [supplier] = await db.insert(suppliers).values({
      name, email, phone, address
    }).returning();
    res.json(supplier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getPurchases = async (req: Request, res: Response) => {
  try {
    const allPurchases = await db.query.purchases.findMany({
      with: { supplier: true, user: true },
    });
    res.json(allPurchases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const { supplierId, userId, totalAmount, status } = req.body;
    const [purchase] = await db.insert(purchases).values({
      supplierId, userId, totalAmount: totalAmount.toString(), status
    }).returning();
    res.json(purchase);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
