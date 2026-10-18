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
  const sql = readFileSync(join(__dirname, '../migrations/040_suppliers.sql'), 'utf8');
  await client.query(sql);

  const { rows: supRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM suppliers`,
  );
  const { rows: invRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM supplier_invoices`,
  );
  const { rows: payRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM supplier_payments`,
  );

  console.log('Migration 040 applied successfully.');
  console.log(`  suppliers count:         ${supRows[0]?.n}`);
  console.log(`  supplier_invoices rows:  ${invRows[0]?.n}`);
  console.log(`  supplier_payments rows:  ${payRows[0]?.n}`);
} finally {
  await client.end();
}
