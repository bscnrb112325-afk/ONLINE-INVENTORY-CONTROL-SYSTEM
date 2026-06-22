import type { Request, Response } from "express";
import { db } from "../db";
import { categories, subCategories, goods, suppliers, recommendations, supplierNotifications, supplierBids } from "../db/schema";
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

export const createSubCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, categoryId } = req.body;
    let catId = categoryId;
    
    if (!catId) {
       // Auto-create a default category if none provided
       let [cat] = await db.query.categories.findMany({ limit: 1 });
       if (!cat) {
          const [newCat] = await db.insert(categories).values({ name: "General Category", description: "Default category" }).returning();
          cat = newCat;
       }
       catId = cat.id;
    }

    const [subCat] = await db.insert(subCategories).values({ name, description, categoryId: catId }).returning();
    res.json(subCat);
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

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address } = req.body;
    const [supplier] = await db.insert(suppliers).values({ name, email, phone, address }).returning();
    res.json(supplier);
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

export const deleteGood = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if the good exists
    const existingGood = await db.query.goods.findFirst({
      where: eq(goods.id, id as string)
    });

    if (!existingGood) {
      return res.status(404).json({ error: "Good not found" });
    }

    // Delete the good
    await db.delete(goods).where(eq(goods.id, id as string));

    res.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createManualRestock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { qty } = req.body;
    
    if (!qty || isNaN(qty) || Number(qty) <= 0) {
      return res.status(400).json({ error: "Invalid quantity provided" });
    }

    const good = await db.query.goods.findFirst({
      where: eq(goods.id, id as string)
    });

    if (!good) {
      return res.status(404).json({ error: "Good not found" });
    }

    // Insert into recommendations to enter the bidding/approval pipeline
    const [rec] = await db.insert(recommendations).values({
      productId: id,
      action: "restock",
      reason: `Manual Restock Request: Restock ${qty} units`,
      recommendedQty: Number(qty),
      status: "pending"
    }).returning();

    // Broadcast notification and open bids to all suppliers
    const allSuppliers = await db.query.suppliers.findMany();
    if (allSuppliers.length > 0) {
      const notificationValues = allSuppliers.map((supplier: any) => ({
        supplierId: supplier.id,
        message: `Inventory Alert: Restock requested for ${good.name || good.serial} (Qty: ${qty})`,
        isRead: false
      }));
      await db.insert(supplierNotifications).values(notificationValues);

      const bidValues = allSuppliers.map((supplier: any) => ({
        recommendationId: rec.id,
        supplierId: supplier.id,
        bidPrice: good.buyRate, // Default to current buyRate
        deliveryTimeDays: 7, // Default to 7 days
        reliabilityScore: 1.0, // Default score
        status: "pending"
      }));
      await db.insert(supplierBids).values(bidValues);
    }

    res.json({ message: "Restock request queued for verification and suppliers notified", data: rec });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
