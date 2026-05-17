import { Router } from "express";
import { getSuppliers, createSupplier, getPurchases, createPurchase } from "../controllers/purchasesController";

const router = Router();

router.get("/suppliers", getSuppliers);
router.post("/suppliers", createSupplier);

router.get("/", getPurchases);
router.post("/", createPurchase);

export default router;
