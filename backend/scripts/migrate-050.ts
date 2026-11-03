// DRAFT: do not run until migration 050 has been reviewed and approved.
// Applies migrations/050_transactions_client_tx_id.sql in one transaction (same pattern as migrate-049.ts;
// it does not write migrations_log, which stopped at 038 and is not the record for 040+).
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
  const sql = readFileSync(join(__dirname, '../migrations/050_transactions_client_tx_id.sql'), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  console.log('Migration 050 applied successfully.');
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name IN ('client_tx_id','device_id','local_receipt_ref') ORDER BY 1`,
  );
  console.log('transactions columns present:', rows.map((r) => r.column_name).join(', '));
} finally {
  await client.end();
}
