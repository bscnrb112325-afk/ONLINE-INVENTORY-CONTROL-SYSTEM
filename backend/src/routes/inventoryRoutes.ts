import { Router } from "express";
import { getCategories, createCategory, getGoods, createGood, getSubCategories, createSubCategory, getSuppliers, createSupplier, updateGood, deleteGood, createManualRestock } from "../controllers/inventoryController";

const router = Router();

router.get("/categories", getCategories);
router.post("/categories", createCategory);

router.get("/subcategories", getSubCategories);
router.post("/subcategories", createSubCategory);

router.get("/suppliers", getSuppliers);
router.post("/suppliers", createSupplier);

router.get("/goods", getGoods);
router.post("/goods", createGood);
router.put("/goods/:id", updateGood);
router.delete("/goods/:id", deleteGood);
router.post("/goods/:id/restock", createManualRestock);

export default router;
