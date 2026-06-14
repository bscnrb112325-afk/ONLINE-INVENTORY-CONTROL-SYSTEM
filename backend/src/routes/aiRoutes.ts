import { Router } from "express";
import { 
  getAIInsights, 
  getAnalyticsWarehouse,
  getRecommendations, 
  approveRecommendation, 
  dismissRecommendation, 
  getNotifications, 
  readNotification,
  getOrders,
  updateOrderStatus,
  getBidsForRecommendation,
  approveSupplierBid,
  receivePurchase
} from "../controllers/aiController";

const router = Router();

router.get("/insights", getAIInsights);
router.get("/warehouse", getAnalyticsWarehouse);
router.get("/recommendations", getRecommendations);
router.post("/recommendations/:id/approve", approveRecommendation);
router.post("/recommendations/:id/dismiss", dismissRecommendation);

router.get("/notifications", getNotifications);
router.post("/notifications/:id/read", readNotification);

router.get("/orders", getOrders);
router.post("/orders/:id/status", updateOrderStatus);

// Bidding & delivery verification routes
router.get("/bids/:recId", getBidsForRecommendation);
router.post("/bids/:bidId/approve", approveSupplierBid);
router.post("/purchases/:purchaseId/receive", receivePurchase);

export default router;
