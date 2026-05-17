import { Router } from "express";
import { getSales, createSale, scanBarcode, triggerMpesaPayment } from "../controllers/salesController";

const router = Router();

router.get("/", getSales);
router.post("/", createSale);
router.get("/scan/:serial", scanBarcode);
router.post("/mpesa/stkpush", triggerMpesaPayment);

export default router;
