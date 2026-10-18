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
  const sql = readFileSync(join(__dirname, '../migrations/046_branches.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 046 applied successfully.');

  const cols = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'staff' AND column_name = 'store_id')
        OR (table_name = 'products' AND column_name = 'is_central')
     ORDER BY table_name`,
  );
  console.log('Columns added:', cols.rows.map((c) => `${c.table_name}.${c.column_name}`).join(', '));

  for (const t of ['stock_transfers', 'branch_daily_summary']) {
    const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`${t}: exists, ${rows[0]!.n} rows`);
  }
} finally {
  await client.end();
}
