require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query("SELECT id, name, email, pos_password FROM users WHERE name ILIKE '%kelvin%'");
  console.log(res.rows);
  process.exit(0);
}

check();
