import { pgTable, text, timestamp, uuid, pgEnum, integer, numeric, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "inventory", "pos_staff", "supplier", "cashier"]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "accepted", "rejected", "shipped", "completed", "cancelled"]);
export const goodStatusEnum = pgEnum("good_status", ["in_stock", "sold", "returned", "damaged"]);
export const saleStatusEnum = pgEnum("sale_status", ["pending", "completed", "refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "mpesa", "card", "bank_transfer"]);
export const paymentTypeEnum = pgEnum("payment_type", ["supplier_payment", "customer_payment"]);
export const aiSuggestionStatusEnum = pgEnum("ai_suggestion_status", ["pending", "accepted", "rejected"]);
export const anomalySeverityEnum = pgEnum("anomaly_severity", ["low", "medium", "high"]);
export const anomalyStatusEnum = pgEnum("anomaly_status", ["open", "resolved", "dismissed"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk ID
  email: text("email").notNull().unique(),
  password: text("password").notNull().default("system_password"),
  name: text("name"),
  phone: text("phone"),
  role: userRoleEnum("role").default("pos_staff").notNull(),
  module: text("module").default("dashboard"),
  avatarDriveId: text("avatar_drive_id"),
  isActive: boolean("is_active").default(true).notNull(),
  posPassword: text("pos_password"), // Password used to unlock POS screen
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const subCategories = pgTable("sub_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  categoryOfGoods: text("category_of_goods"),
  paymentMode: text("payment_mode"),
  mpesaDetails: text("mpesa_details"),
  cardDetails: text("card_details"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }), // user who recorded it
  goodId: uuid("good_id"),
  expectedQty: integer("expected_qty").notNull().default(0),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: purchaseStatusEnum("status").default("pending").notNull(),
  paymentMethod: text("payment_method"),
  paymentDueDate: timestamp("payment_due_date", { mode: "date" }),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const goods = pgTable("goods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default(''), // Item Name
  description: text("description"), // Item Description
  serial: text("serial").notNull().unique(), // Barcode or Serial
  subCatId: uuid("sub_cat_id").notNull().references(() => subCategories.id, { onDelete: "restrict" }),
  purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  buyRate: numeric("buy_rate", { precision: 12, scale: 2 }).notNull(),
  sellRate: numeric("sell_rate", { precision: 12, scale: 2 }).notNull(),
  qty: integer("qty").notNull().default(1),
  reservedQty: integer("reserved_qty").notNull().default(0),
  reorderThreshold: integer("reorder_threshold").notNull().default(10),
  status: goodStatusEnum("status").default("in_stock").notNull(),
  imageGoodId: text("image_good_id"), // Could be cloud storage ID or URL
  productDetails: text("product_details"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }), // cashier
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("cash").notNull(),
  status: saleStatusEnum("status").default("completed").notNull(),
  orderStatus: text("order_status").default("Pending").notNull(), // "Pending" -> "Paid" -> "Processing" -> "Packed" -> "Shipped" -> "Delivered"
  deliveryLat: doublePrecision("delivery_lat"),   // Customer GPS latitude (from ZuriShop map pin)
  deliveryLng: doublePrecision("delivery_lng"),   // Customer GPS longitude (from ZuriShop map pin)
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  goodId: uuid("good_id").notNull().references(() => goods.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: paymentTypeEnum("type").notNull(),
  referenceId: uuid("reference_id").notNull(), // points to either sale_id or purchase_id
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  transactionId: text("transaction_id"), // Mpesa receipt number or bank ref
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date", { mode: "date" }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetTable: text("target_table"),
  targetId: text("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// New Intelligent Integrated Commerce System tables
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  priority: text("priority").default("medium").notNull(), // "low", "medium", "high"
  status: text("status").default("unread").notNull(), // "unread", "read"
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const aiInsights = pgTable("ai_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // "demand_forecast", "slow_moving", "dynamic_pricing", "restock"
  productId: uuid("product_id").references(() => goods.id, { onDelete: "cascade" }),
  prediction: text("prediction").notNull(), // JSON payload string
  confidence: numeric("confidence", { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventName: text("event_name").notNull(), // e.g. "ORDER_CREATED", "PAYMENT_COMPLETED"
  module: text("module").notNull(), // e.g. "orders", "payments", "inventory", "ai"
  payload: text("payload"), // JSON payload string
  timestamp: timestamp("timestamp", { mode: "date" }).notNull().defaultNow(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => goods.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // "restock", "price_adjust", "promote"
  reason: text("reason").notNull(),
  recommendedQty: integer("recommended_qty").notNull().default(0),
  status: text("status").default("pending").notNull(), // "pending", "approved", "dismissed"
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const supplierBids = pgTable("supplier_bids", {
  id: uuid("id").defaultRandom().primaryKey(),
  recommendationId: uuid("recommendation_id").notNull().references(() => recommendations.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  bidPrice: numeric("bid_price", { precision: 12, scale: 2 }).notNull(),
  deliveryTimeDays: integer("delivery_time_days").notNull(),
  reliabilityScore: numeric("reliability_score", { precision: 4, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // "pending", "approved", "rejected"
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const analyticsWarehouse = pgTable("analytics_warehouse", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportDate: timestamp("report_date", { mode: "date" }).notNull(),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).notNull(),
  totalProfit: numeric("total_profit", { precision: 12, scale: 2 }).notNull(),
  deadStockValue: numeric("dead_stock_value", { precision: 12, scale: 2 }).notNull(),
  inventoryTurnoverRate: numeric("inventory_turnover_rate", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const supplierDocuments = pgTable("supplier_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }), // Optional link to an order
  title: text("title").notNull(),
  type: text("type").notNull(), // "invoice", "delivery_note", "other"
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const supplierNotifications = pgTable("supplier_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const modelRuns = pgTable("model_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  runAt: timestamp("run_at", { mode: "date" }).notNull().defaultNow(),
});

export const aiSuggestions = pgTable("ai_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => goods.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(),
  suggestedValue: text("suggested_value").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 2 }).notNull(),
  status: aiSuggestionStatusEnum("status").default("pending").notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const visionScans = pgTable("vision_scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => goods.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  barcodeDetected: boolean("barcode_detected").default(false).notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 2 }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const forecasts = pgTable("forecasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => goods.id, { onDelete: "cascade" }),
  forecastDate: timestamp("forecast_date", { mode: "date" }).notNull(),
  predictedDemand: integer("predicted_demand").notNull(),
  suggestedReorderQty: integer("suggested_reorder_qty").notNull(),
  modelRunId: uuid("model_run_id").notNull().references(() => modelRuns.id, { onDelete: "cascade" }),
});

export const anomalyFlags = pgTable("anomaly_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceModule: text("source_module").notNull(),
  entityId: uuid("entity_id").notNull(), // UUID, though it could point to different tables, so no strict FK here
  anomalyType: text("anomaly_type").notNull(),
  severity: anomalySeverityEnum("severity").default("low").notNull(),
  status: anomalyStatusEnum("status").default("open").notNull(),
  flaggedAt: timestamp("flagged_at", { mode: "date" }).notNull().defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  subCategories: many(subCategories),
}));

export const subCategoriesRelations = relations(subCategories, ({ one, many }) => ({
  category: one(categories, { fields: [subCategories.categoryId], references: [categories.id] }),
  goods: many(goods),
}));

export const goodsRelations = relations(goods, ({ one, many }) => ({
  subCategory: one(subCategories, { fields: [goods.subCatId], references: [subCategories.id] }),
  purchase: one(purchases, { fields: [goods.purchaseId], references: [purchases.id] }),
  supplier: one(suppliers, { fields: [goods.supplierId], references: [suppliers.id] }),
  saleItems: many(saleItems),
  aiInsights: many(aiInsights),
  recommendations: many(recommendations),
  supplierBids: many(supplierBids),
  aiSuggestions: many(aiSuggestions),
  visionScans: many(visionScans),
  forecasts: many(forecasts),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  user: one(users, { fields: [sales.userId], references: [users.id] }), // cashier
  saleItems: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  good: one(goods, { fields: [saleItems.goodId], references: [goods.id] }),
}));

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchases.supplierId], references: [suppliers.id] }),
  user: one(users, { fields: [purchases.userId], references: [users.id] }),
  goods: many(goods),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  good: one(goods, { fields: [aiInsights.productId], references: [goods.id] }),
}));

export const recommendationsRelations = relations(recommendations, ({ one, many }) => ({
  good: one(goods, { fields: [recommendations.productId], references: [goods.id] }),
  supplierBids: many(supplierBids),
}));

export const supplierBidsRelations = relations(supplierBids, ({ one }) => ({
  recommendation: one(recommendations, { fields: [supplierBids.recommendationId], references: [recommendations.id] }),
  supplier: one(suppliers, { fields: [supplierBids.supplierId], references: [suppliers.id] }),
}));

export const supplierDocumentsRelations = relations(supplierDocuments, ({ one }) => ({
  supplier: one(suppliers, { fields: [supplierDocuments.supplierId], references: [suppliers.id] }),
  purchase: one(purchases, { fields: [supplierDocuments.purchaseId], references: [purchases.id] }),
}));

export const supplierNotificationsRelations = relations(supplierNotifications, ({ one }) => ({
  supplier: one(suppliers, { fields: [supplierNotifications.supplierId], references: [suppliers.id] }),
}));

export const aiSuggestionsRelations = relations(aiSuggestions, ({ one }) => ({
  good: one(goods, { fields: [aiSuggestions.productId], references: [goods.id] }),
  user: one(users, { fields: [aiSuggestions.reviewedBy], references: [users.id] }),
}));

export const visionScansRelations = relations(visionScans, ({ one }) => ({
  good: one(goods, { fields: [visionScans.productId], references: [goods.id] }),
}));

export const modelRunsRelations = relations(modelRuns, ({ many }) => ({
  forecasts: many(forecasts),
}));

export const forecastsRelations = relations(forecasts, ({ one }) => ({
  good: one(goods, { fields: [forecasts.productId], references: [goods.id] }),
  modelRun: one(modelRuns, { fields: [forecasts.modelRunId], references: [modelRuns.id] }),
}));

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("default"),
  companyName: text("company_name").notNull().default("Online Inventory Control System"),
  logoUrl: text("logo_url").notNull().default(""),
  currency: text("currency").notNull().default("KSh"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  theme: text("theme").notNull().default("light"),
  font: text("font").notNull().default("Inter"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
});
