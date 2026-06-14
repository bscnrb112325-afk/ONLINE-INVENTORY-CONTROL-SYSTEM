import { Pool } from "pg";
import { ENV } from "../config/env";

async function run() {
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });
  const client = await pool.connect();
  try {
    const cats = await client.query("SELECT * FROM categories LIMIT 5");
    console.log("Categories:", cats.rows);
    const subcats = await client.query("SELECT * FROM sub_categories LIMIT 5");
    console.log("Subcategories:", subcats.rows);
    const gds = await client.query("SELECT * FROM goods LIMIT 5");
    console.log("Goods:", gds.rows);
  } catch (error) {
    console.error("Error checking data:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
