import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  'postgresql://greengo:localdev@localhost:5432/greengo_dev';

const sql = readFileSync(
  join(__dirname, '../migrations/031_customers.sql'),
  'utf8'
);

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");

  console.log('Applying 031_customers.sql...');
  await client.query(sql);
  console.log('Migration 031 applied.');

  const r = await client.query(
    `SELECT name_ar, balance FROM customers
     WHERE tenant_id = '11111111-1111-1111-1111-111111111111'`
  );
  console.log('Test customers:', JSON.stringify(r.rows, null, 2));

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
