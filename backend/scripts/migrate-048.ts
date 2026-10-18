import 'dotenv/config';
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
  const sql = readFileSync(join(__dirname, '../migrations/048_cost_history.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 048 applied successfully.');

  const { rows } = await client.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM product_cost_history',
  );
  console.log(`product_cost_history: exists, ${rows[0]!.n} rows`);
} finally {
  await client.end();
}
