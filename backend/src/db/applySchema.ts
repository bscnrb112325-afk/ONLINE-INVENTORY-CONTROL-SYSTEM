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

    console.log("Fixing UUID to TEXT for users.id and all foreign keys...");
    try {
      await client.query(`
        ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_user_id_users_id_fk";
        ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_user_id_users_id_fk";
        ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_user_id_users_id_fk";
        ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_user_id_users_id_fk";
        ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_users_id_fk";

        ALTER TABLE "users" ALTER COLUMN "id" TYPE text;

        ALTER TABLE "sales" ALTER COLUMN "user_id" TYPE text;
        ALTER TABLE "purchases" ALTER COLUMN "user_id" TYPE text;
        ALTER TABLE "expenses" ALTER COLUMN "user_id" TYPE text;
        ALTER TABLE "activity_logs" ALTER COLUMN "user_id" TYPE text;
        ALTER TABLE "notifications" ALTER COLUMN "user_id" TYPE text;

        ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
        ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
        ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
        ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
        ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
      `);
      console.log("Successfully fixed UUID -> TEXT for user relationships.");
    } catch (e: any) {
      console.log("UUID->TEXT fix skipped or already applied:", e.message);
    }

    console.log("Dropping NOT NULL constraints for legacy columns...");
    try {
      await client.query(`
        ALTER TABLE "users" ALTER COLUMN "role_id" DROP NOT NULL;
        ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
      `);
    } catch (e: any) {
      console.log("Legacy column NOT NULL drop skipped:", e.message);
    }

    console.log("Applying ALTER TABLE on users...");
    await client.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" text DEFAULT 'system_password' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'cashier' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_drive_id" text;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
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

    console.log("Applying Supplier Portal schema updates...");
    try {
      await client.query(`ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'accepted';`);
      await client.query(`ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'rejected';`);
    } catch (e: any) {
      console.log("Enum values 'accepted' / 'rejected' may already exist or cannot be added inside transaction block (will retry outside if needed).", e.message);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "supplier_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE cascade,
        "purchase_id" uuid REFERENCES "purchases"("id") ON DELETE set null,
        "title" text NOT NULL,
        "type" text NOT NULL,
        "file_url" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "supplier_notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id") ON DELETE cascade,
        "message" text NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
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
