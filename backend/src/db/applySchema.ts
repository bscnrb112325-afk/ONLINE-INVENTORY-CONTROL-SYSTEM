import { Pool } from "pg";
import { ENV } from "../config/env";

async function run() {
  if (!ENV.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });
  console.log("Connecting to Neon database to apply schema updates...");
  
  const client = await pool.connect();
  try {
    console.log("Applying ALTER TABLE on sales...");
    await client.query(`
      ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "order_status" text DEFAULT 'Pending' NOT NULL;
    `);

    console.log("Applying ALTER TABLE on goods...");
    await client.query(`
      ALTER TABLE "goods" ADD COLUMN IF NOT EXISTS "name" text DEFAULT '' NOT NULL;
      ALTER TABLE "goods" ADD COLUMN IF NOT EXISTS "description" text;
      ALTER TABLE "goods" ADD COLUMN IF NOT EXISTS "supplier_id" uuid REFERENCES "suppliers"("id") ON DELETE set null;
      ALTER TABLE "goods" ADD COLUMN IF NOT EXISTS "reorder_threshold" integer DEFAULT 10 NOT NULL;
      ALTER TABLE "goods" ADD COLUMN IF NOT EXISTS "product_details" text;
    `);

    console.log("Creating suppliers table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "email" text,
        "phone" text,
        "address" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("Creating purchases table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "purchases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE restrict,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE restrict,
        "total_amount" numeric(12, 2) NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("Adding foreign key to goods table for purchase_id...");
    try {
      await client.query(`
        ALTER TABLE "goods" ADD CONSTRAINT "goods_purchase_id_purchases_id_fk" 
        FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE set null;
      `);
    } catch (e: any) {
      console.log("Foreign key on goods for purchase_id already exists or skipped.");
    }

    console.log("Creating expenses table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE set null,
        "description" text NOT NULL,
        "amount" numeric(12, 2) NOT NULL,
        "date" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("Creating activity_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" text REFERENCES "users"("id") ON DELETE set null,
        "action" text NOT NULL,
        "target_table" text,
        "target_id" text,
        "details" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("Creating notifications table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" text,
        "message" text NOT NULL,
        "priority" text DEFAULT 'medium' NOT NULL,
        "status" text DEFAULT 'unread' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );
    `);

    console.log("Creating ai_insights table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ai_insights" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "type" text NOT NULL,
        "product_id" uuid,
        "prediction" text NOT NULL,
        "confidence" numeric(4, 2) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ai_insights_product_id_goods_id_fk" FOREIGN KEY ("product_id") REFERENCES "goods"("id") ON DELETE cascade
      );
    `);

    console.log("Creating events table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "event_name" text NOT NULL,
        "module" text NOT NULL,
        "payload" text,
        "timestamp" timestamp DEFAULT now() NOT NULL
      );
    `);

    console.log("Creating recommendations table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "recommendations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" uuid NOT NULL,
        "action" text NOT NULL,
        "reason" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "recommendations_product_id_goods_id_fk" FOREIGN KEY ("product_id") REFERENCES "goods"("id") ON DELETE cascade
      );
    `);

    console.log("Creating supplier_bids table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "supplier_bids" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recommendation_id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "bid_price" numeric(12, 2) NOT NULL,
        "delivery_time_days" integer NOT NULL,
        "reliability_score" numeric(4, 2) NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "supplier_bids_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE cascade,
        CONSTRAINT "supplier_bids_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE cascade
      );
    `);

    console.log("Schema updates applied successfully! ✅");
  } catch (error) {
    console.error("Error applying schema updates:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
