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
  const sql = readFileSync(join(__dirname, '../migrations/036_anomaly.sql'), 'utf8');
  await client.query(sql);

  const { rows: alertRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM anomaly_alerts`,
  );
  const { rows: baselineRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM cashier_baselines`,
  );

  console.log('Migration 036 applied successfully.');
  console.log(`  anomaly_alerts rows:   ${alertRows[0]?.n}`);
  console.log(`  cashier_baselines rows: ${baselineRows[0]?.n}`);
} finally {
  await client.end();
}
