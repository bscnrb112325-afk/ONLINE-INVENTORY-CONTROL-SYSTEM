import { Router } from "express";
import { getCategories, createCategory, getGoods, createGood, getSubCategories, getSuppliers, updateGood } from "../controllers/inventoryController";

const router = Router();

router.get("/categories", getCategories);
router.post("/categories", createCategory);

router.get("/subcategories", getSubCategories);
router.get("/suppliers", getSuppliers);

router.get("/goods", getGoods);
router.post("/goods", createGood);
router.put("/goods/:id", updateGood);

export default router;
