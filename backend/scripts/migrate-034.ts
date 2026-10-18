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
  const sql = readFileSync(join(__dirname, '../migrations/034_data_foundation.sql'), 'utf8');
  await client.query(sql);

  const { rows: dimRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM dim_date`,
  );
  const { rows: holRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM dim_date WHERE holiday_code IS NOT NULL`,
  );
  const { rows: unconfRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM dim_date WHERE date_confirmed = false`,
  );
  const { rows: backfillRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM transactions WHERE sold_at IS NOT NULL`,
  );

  console.log('Migration 034 applied successfully.');
  console.log(`  dim_date rows:        ${dimRows[0]?.n}`);
  console.log(`  holiday rows:         ${holRows[0]?.n}`);
  console.log(`  unconfirmed rows:     ${unconfRows[0]?.n}`);
  console.log(`  transactions backfilled (sold_at set): ${backfillRows[0]?.n}`);
} finally {
  await client.end();
}
