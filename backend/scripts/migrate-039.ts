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
  const sql = readFileSync(join(__dirname, '../migrations/039_split_payments.sql'), 'utf8');
  await client.query(sql);

  const { rows: tenderRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM sale_tenders`,
  );
  const { rows: configRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM payment_method_config`,
  );

  console.log('Migration 039 applied successfully.');
  console.log(`  sale_tenders rows:          ${tenderRows[0]?.n}`);
  console.log(`  payment_method_config rows: ${configRows[0]?.n}`);
} finally {
  await client.end();
}
