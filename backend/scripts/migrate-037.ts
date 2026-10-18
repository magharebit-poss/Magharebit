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
  const sql = readFileSync(join(__dirname, '../migrations/037_forecasting.sql'), 'utf8');
  await client.query(sql);

  const { rows: forecastRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM demand_forecasts`,
  );
  const { rows: holidayRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM holiday_confirmations`,
  );

  console.log('Migration 037 applied successfully.');
  console.log(`  demand_forecasts rows:      ${forecastRows[0]?.n}`);
  console.log(`  holiday_confirmations rows: ${holidayRows[0]?.n}`);
} finally {
  await client.end();
}
