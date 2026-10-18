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
  const sql = readFileSync(join(__dirname, '../migrations/035_permissions.sql'), 'utf8');
  await client.query(sql);

  const { rows: permRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM staff_permissions`,
  );
  const { rows: overrideRows } = await client.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM manager_overrides`,
  );

  console.log('Migration 035 applied successfully.');
  console.log(`  staff_permissions rows: ${permRows[0]?.n}`);
  console.log(`  manager_overrides rows: ${overrideRows[0]?.n}`);
} finally {
  await client.end();
}
