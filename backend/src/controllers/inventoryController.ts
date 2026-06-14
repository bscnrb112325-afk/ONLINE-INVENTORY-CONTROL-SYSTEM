import type { Request, Response } from "express";
import { db } from "../db";
import { categories, subCategories, goods, suppliers } from "../db/schema";
import { eq } from "drizzle-orm";
import { eventBus } from "../services/eventBus";
import { cacheService } from "../services/cacheService";

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
    const cached = await cacheService.get("all_goods");
    if (cached) {
      console.log("[Inventory Cache] HIT: all_goods");
      return res.json(cached);
    }
    
    console.log("[Inventory Cache] MISS: all_goods");
    const allGoods = await db.query.goods.findMany({
      with: { subCategory: true }
    });
    
    await cacheService.set("all_goods", allGoods, 60); // Cache for 60s
    res.json(allGoods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSubCategories = async (req: Request, res: Response) => {
  try {
    const allSubCategories = await db.query.subCategories.findMany();
    res.json(allSubCategories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const allSuppliers = await db.query.suppliers.findMany();
    res.json(allSuppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createGood = async (req: Request, res: Response) => {
  try {
    const { 
      name, description, serial, subCatId, supplierId, 
      buyRate, sellRate, qty, reorderThreshold, status, 
      imageGoodId, productDetails 
    } = req.body;
    
    const [good] = await db.insert(goods).values({
      name,
      description,
      serial,
      subCatId,
      supplierId: supplierId || null,
      buyRate,
      sellRate,
      qty,
      reorderThreshold: reorderThreshold ?? 10,
      status,
      imageGoodId,
      productDetails
    }).returning();

    // Emit stock updated event so we check reorder thresholds immediately
    eventBus.emit("STOCK_UPDATED", {
      goodId: good.id,
      qty: good.qty,
      serial: good.serial,
      sellRate: parseFloat(good.sellRate),
      reorderThreshold: good.reorderThreshold
    });

    res.json(good);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGood = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      name, description, serial, subCatId, supplierId, 
      buyRate, sellRate, qty, reorderThreshold, status, 
      imageGoodId, productDetails 
    } = req.body;
    
    const [good] = await db.update(goods).set({
      name,
      description,
      serial,
      subCatId,
      supplierId: supplierId || null,
      buyRate: buyRate !== undefined ? String(buyRate) : undefined,
      sellRate: sellRate !== undefined ? String(sellRate) : undefined,
      qty,
      reorderThreshold,
      status,
      imageGoodId,
      productDetails
    })
    .where(eq(goods.id, id as string))
    .returning();

    if (!good) {
      return res.status(404).json({ error: "Good not found" });
    }

    // Emit stock updated event
    eventBus.emit("STOCK_UPDATED", {
      goodId: good.id,
      qty: good.qty,
      serial: good.serial,
      sellRate: parseFloat(good.sellRate),
      reorderThreshold: good.reorderThreshold
    });

    res.json(good);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
