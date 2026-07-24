import express from "express";
import cors from "cors";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
import { ENV } from "./config/env";
import { clerkMiddleware } from "@clerk/express";

import userRoutes from "./routes/userRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import salesRoutes from "./routes/salesRoutes";
import purchasesRoutes from "./routes/purchasesRoutes";
import aiRoutes from "./routes/aiRoutes";
import supplierPortalRoutes from "./routes/supplierPortalRoutes";
import approvalRoutes from "./routes/approvalRoutes";
import streamRoutes from "./routes/streamRoutes";
import customerRoutes from "./routes/customerRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import { initEventBusListeners } from "./services/eventBus";
import { initAnalyticsCron } from "./services/analyticsJob";

const app = express();

// Allow any origin to connect, reflecting the request origin dynamically.
// This is essential for local network testing (e.g., accessing via phone).
app.use(cors({ origin: true, credentials: true }));
app.use(clerkMiddleware());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get(["/health", "/api/health"], (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "Inventory API running" });
});

app.use("/api/users", userRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/supplier-portal", supplierPortalRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/settings", settingsRoutes);

// Initialize Event Bus Listeners
initEventBusListeners();

// Initialize Analytics Night Jobs
initAnalyticsCron();

if (ENV.NODE_ENV === "production") {
  const __dirname = path.resolve();
  const frontendDistPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendDistPath));
  app.get("*", (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  // In development, proxy all non-API requests to the Vite dev server!
  app.use(createProxyMiddleware({ target: "http://localhost:5173", changeOrigin: true, ws: true }));
}

app.listen(Number(ENV.PORT), "0.0.0.0", () => console.log("Server is up and running on PORT:", ENV.PORT));

