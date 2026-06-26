import { Router } from "express";
import { getSuppliers, createSupplier, getPurchases, createPurchase, markPurchasePaid } from "../controllers/purchasesController";

const router = Router();

router.get("/suppliers", getSuppliers);
router.post("/suppliers", createSupplier);

router.get("/", getPurchases);
router.post("/", createPurchase);
router.put("/:id/pay", markPurchasePaid);

export default router;
