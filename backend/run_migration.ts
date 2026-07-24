import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'shipped'");
    console.log("Success");
  } catch (e: any) {
    console.log("Error:", e.message);
  }
  await client.end();
}
run();
