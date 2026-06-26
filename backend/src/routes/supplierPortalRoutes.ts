import { Router } from "express";
import { 
  getSupplierOrders, 
  updateOrderStatus, 
  getSupplierBids, 
  submitNewSupplierBid,
  getOpenRequests,
  getDashboardStats,
  getSupplierGoods,
  updateGoodPrice,
  getSupplierNotifications,
  markNotificationRead,
  getSupplierDocuments,
  uploadDocument,
  updateSupplierProfile,
  registerSupplier
} from "../controllers/supplierPortalController";

const router = Router();

// Dashboard
router.get("/:supplierId/dashboard", getDashboardStats);

// Order endpoints
router.get("/:supplierId/orders", getSupplierOrders);
router.put("/:supplierId/orders/:orderId/status", updateOrderStatus);

// Bidding endpoints
router.get("/:supplierId/open-requests", getOpenRequests);
router.get("/:supplierId/bids", getSupplierBids);
router.post("/:supplierId/bids", submitNewSupplierBid);

// Pricing
router.get("/:supplierId/goods", getSupplierGoods);
router.put("/:supplierId/goods/:goodId/price", updateGoodPrice);

// Notifications
router.get("/:supplierId/notifications", getSupplierNotifications);
router.put("/:supplierId/notifications/:notifId/read", markNotificationRead);

// Documents
router.get("/:supplierId/documents", getSupplierDocuments);
router.post("/:supplierId/documents", uploadDocument);

// Profile
router.put("/:supplierId/profile", updateSupplierProfile);
router.post("/register", registerSupplier);

export default router;
