import type { Request, Response } from "express";
import { db } from "../db";
import { categories, subCategories, goods } from "../db/schema";
import { eq } from "drizzle-orm";

export const getCategories = async (req: Request, res: Response) => {
  try {
    const allCategories = await db.query.categories.findMany();
    res.json(allCategories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const [category] = await db.insert(categories).values({ name, description }).returning();
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getGoods = async (req: Request, res: Response) => {
  try {
    const allGoods = await db.query.goods.findMany({
      with: { subCategory: true }
    });
    res.json(allGoods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createGood = async (req: Request, res: Response) => {
  try {
    const { serial, subCatId, buyRate, sellRate, qty, status } = req.body;
    const [good] = await db.insert(goods).values({
      serial, subCatId, buyRate, sellRate, qty, status
    }).returning();
    res.json(good);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
