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
  const sql = readFileSync(join(__dirname, '../migrations/038_customer_insights.sql'), 'utf8');
  await client.query(sql);

  const { rows: segRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM customer_segments`,
  );
  const { rows: sugRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM customer_suggestions`,
  );

  console.log('Migration 038 applied successfully.');
  console.log(`  customer_segments rows:    ${segRows[0]?.n}`);
  console.log(`  customer_suggestions rows: ${sugRows[0]?.n}`);
} finally {
  await client.end();
}
