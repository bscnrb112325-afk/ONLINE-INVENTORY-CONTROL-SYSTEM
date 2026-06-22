const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_MP0HQsi6hjZW@ep-silent-flower-ao9l2rkw-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function run() {
  try {
    await pool.query("UPDATE users SET role = 'pos_staff' WHERE role = 'cashier';");
    console.log('Updated users');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
