import { sql } from 'drizzle-orm';
import { db } from './db';

async function migrate() {
  try {
    console.log("Adding reserved_qty to goods...");
    await db.execute(sql`ALTER TABLE goods ADD COLUMN IF NOT EXISTS reserved_qty integer NOT NULL DEFAULT 0;`);
    
    console.log("Creating analytics_warehouse table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_warehouse (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        report_date timestamp NOT NULL,
        total_sales numeric(12, 2) NOT NULL,
        total_profit numeric(12, 2) NOT NULL,
        dead_stock_value numeric(12, 2) NOT NULL,
        inventory_turnover_rate numeric(5, 2) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log("Adding delivery_lat and delivery_lng to sales...");
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_lat double precision;`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_lng double precision;`);
    console.log("Adding delivery proof columns to sales...");
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_signature text;`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_proof_photo text;`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_notes text;`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_verification_code text;`);

    console.log("Migration successful!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
