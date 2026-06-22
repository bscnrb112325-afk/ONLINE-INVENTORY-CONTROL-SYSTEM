import { Router, Request, Response } from "express";
import { eventBus } from "../services/eventBus";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send an initial heartbeat to establish connection
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "SSE stream established" })}\n\n`);

  const onEvent = (type: string) => (payload: any) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  const handleStockUpdated = onEvent("STOCK_UPDATED");
  const handleLowStock = onEvent("LOW_STOCK_DETECTED");
  const handleOutOfStock = onEvent("OUT_OF_STOCK");
  const handleStkPushSuccess = onEvent("STK_PUSH_SUCCESS");
  const handleStkPushFailed = onEvent("STK_PUSH_FAILED");
  const handleMpesaPayment = onEvent("MPESA_PAYMENT_RECEIVED");
  const handleOrderStatusUpdated = onEvent("ORDER_STATUS_UPDATED");

  eventBus.on("STOCK_UPDATED", handleStockUpdated);
  eventBus.on("LOW_STOCK_DETECTED", handleLowStock);
  eventBus.on("OUT_OF_STOCK", handleOutOfStock);
  eventBus.on("STK_PUSH_SUCCESS", handleStkPushSuccess);
  eventBus.on("STK_PUSH_FAILED", handleStkPushFailed);
  eventBus.on("MPESA_PAYMENT_RECEIVED", handleMpesaPayment);
  eventBus.on("ORDER_STATUS_UPDATED", handleOrderStatusUpdated);

  // Keep alive ping every 15s to prevent timeouts
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "PING" })}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    eventBus.off("STOCK_UPDATED", handleStockUpdated);
    eventBus.off("LOW_STOCK_DETECTED", handleLowStock);
    eventBus.off("OUT_OF_STOCK", handleOutOfStock);
    eventBus.off("STK_PUSH_SUCCESS", handleStkPushSuccess);
    eventBus.off("STK_PUSH_FAILED", handleStkPushFailed);
    eventBus.off("MPESA_PAYMENT_RECEIVED", handleMpesaPayment);
    eventBus.off("ORDER_STATUS_UPDATED", handleOrderStatusUpdated);
  });
});

export default router;
