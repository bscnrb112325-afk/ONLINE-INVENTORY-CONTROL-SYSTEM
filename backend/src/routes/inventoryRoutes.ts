import { Router } from "express";
import { getCategories, createCategory, getGoods, createGood } from "../controllers/inventoryController";

const router = Router();

router.get("/categories", getCategories);
router.post("/categories", createCategory);

router.get("/goods", getGoods);
router.post("/goods", createGood);

export default router;
