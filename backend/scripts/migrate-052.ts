// DRAFT: do not run until migration 052 has been reviewed and approved.
// Applies migrations/052_products_stock_numeric.sql in one transaction (same pattern as migrate-050.ts;
// it does not write migrations_log, which stopped at 038 and is not the record for 040+).
// WARNING: ALTER COLUMN TYPE rewrites the products table under ACCESS EXCLUSIVE. Run when the POS is idle.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev',
  connectionTimeoutMillis: 10_000,
});

await client.connect();
try {
  const sql = readFileSync(join(__dirname, '../migrations/052_products_stock_numeric.sql'), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  console.log('Migration 052 applied successfully.');
  const { rows } = await client.query<{ data_type: string; numeric_precision: number; numeric_scale: number }>(
    `SELECT data_type, numeric_precision, numeric_scale FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'stock_quantity'`,
  );
  console.log('products.stock_quantity:', JSON.stringify(rows[0]));
  console.log('Next: recount weighted stock in kg (scripts/recount-weighted-stock.sql lists the products).');
} finally {
  await client.end();
}
