import express from "express";
import cors from "cors";
import path from "path";

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
import { initEventBusListeners } from "./services/eventBus";
import { initAnalyticsCron } from "./services/analyticsJob";

const app = express();

app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
app.use(clerkMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.json({
    message: "Inventory API running",
  });
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

// Initialize Event Bus Listeners
initEventBusListeners();

// Initialize Analytics Night Jobs
initAnalyticsCron();

if (ENV.NODE_ENV === "production") {
  const __dirname = path.resolve();
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("/{*any}", (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

app.listen(ENV.PORT, () => console.log("Server is up and running on PORT:", ENV.PORT));

