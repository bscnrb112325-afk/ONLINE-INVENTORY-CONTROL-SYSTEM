require('dotenv').config();
const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  try {
    const res = await client.query('DELETE FROM goods WHERE id = $1', ['92f62892-8926-4bad-b334-1da7317706d8']);
    console.log("Success", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
  await client.end();
}

test();
