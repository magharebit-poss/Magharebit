// DRAFT: do not run until migration 049 has been reviewed and approved.
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
  const sql = readFileSync(join(__dirname, '../migrations/049_tenant_integrations.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 049 applied successfully.');

  const { rows } = await client.query<{ n: number }>('SELECT count(*)::int AS n FROM tenant_integrations');
  console.log(`tenant_integrations: exists, ${rows[0]!.n} rows`);
} finally {
  await client.end();
}
