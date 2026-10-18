import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const client = new Client({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev',
});

await client.connect();

try {
  const sql = readFileSync(join(__dirname, '../migrations/044_payment_label_en.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 044 applied successfully.');

  const { rows } = await client.query<{ method: string; label_en: string | null }>(
    `SELECT method, label_en FROM payment_method_config ORDER BY sort_order, method`,
  );
  console.log('\nVerification — label_en values:');
  for (const r of rows) {
    const ok = r.label_en !== null;
    console.log(`  ${ok ? '✓' : '✗'} ${r.method.padEnd(24)} ${r.label_en ?? '(NULL)'}`);
  }
} finally {
  await client.end();
}
