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
  receivePurchase,
  analyzeStock,
  sendRecommendationsToSuppliers,
  processVisionScan,
  saveAiSuggestions,
  processDashboardChat,
  triggerForecastJob,
  getAnomalies,
  dismissAnomaly,
  sendEmailReport,
  getEmailConfig,
  updateEmailRecipients,
  calculateDeliveryCost
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
router.patch("/orders/:id/status", updateOrderStatus);
router.post("/analyze-stock", analyzeStock);
router.post("/send-to-suppliers", sendRecommendationsToSuppliers);
router.post("/vision-scan", processVisionScan);
router.post("/scan-vision", processVisionScan);
router.post("/save-ai-suggestions", saveAiSuggestions);
router.post("/chat", processDashboardChat);
router.post("/trigger-forecast", triggerForecastJob);
router.get("/anomalies", getAnomalies);
router.post("/anomalies/:id/dismiss", dismissAnomaly);

// Bidding & delivery verification routes
router.get("/bids/:recId", getBidsForRecommendation);
router.post("/bids/:bidId/approve", approveSupplierBid);
router.post("/purchases/:purchaseId/receive", receivePurchase);

// Email Daily Reports
router.post("/email/send-report", sendEmailReport);
router.get("/email/config", getEmailConfig);
router.post("/email/recipients", updateEmailRecipients);

// Delivery Cost AI
router.post("/delivery-cost", calculateDeliveryCost);

export default router;
