import { Pool } from "pg";
import { ENV } from "../config/env";

async function run() {
  const pool = new Pool({ connectionString: ENV.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Database tables:", res.rows.map(r => r.table_name));
  } catch (error) {
    console.error("Error listing tables:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
