import { Router } from "express";
import { 
  getSupplierOrders, 
  updateOrderStatus, 
  getSupplierBids, 
  submitSupplierBid 
} from "../controllers/supplierPortalController";

const router = Router();

// Order endpoints
router.get("/:supplierId/orders", getSupplierOrders);
router.put("/:supplierId/orders/:orderId/complete", updateOrderStatus);

// Bidding endpoints
router.get("/:supplierId/bids", getSupplierBids);
router.put("/:supplierId/bids/:bidId/submit", submitSupplierBid);

export default router;
