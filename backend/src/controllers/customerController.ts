import type { Request, Response } from "express";
import { db } from "../db";

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const allCustomers = await db.query.customers.findMany();
    res.json(allCustomers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
