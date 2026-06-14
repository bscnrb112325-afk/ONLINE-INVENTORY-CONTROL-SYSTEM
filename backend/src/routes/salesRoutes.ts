import { Router } from "express";
import { getSales, createSale, scanBarcode, triggerMpesaPayment, mpesaCallback, simulateMpesaCallback } from "../controllers/salesController";

const router = Router();

router.get("/", getSales);
router.post("/", createSale);
router.get("/scan/:serial", scanBarcode);
router.post("/mpesa/stkpush", triggerMpesaPayment);
router.post("/mpesa/callback", mpesaCallback);
router.post("/mpesa/simulate", simulateMpesaCallback);

export default router;
