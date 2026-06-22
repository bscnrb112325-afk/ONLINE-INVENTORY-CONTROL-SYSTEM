import { Router } from "express";
import { getSales, getSaleById, createSale, scanBarcode, triggerMpesaPayment, mpesaCallback, simulateMpesaCallback } from "../controllers/salesController";

const router = Router();

router.get("/", getSales);
router.get("/:id", getSaleById);
router.post("/", createSale);
router.get("/scan/:serial", scanBarcode);
router.post("/mpesa/stkpush", triggerMpesaPayment);
router.post("/mpesa/callback", mpesaCallback);
router.post("/mpesa/simulate", simulateMpesaCallback);

export default router;
