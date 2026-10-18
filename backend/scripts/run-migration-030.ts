import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");

  const sql = readFileSync(resolve(__dirname, '../migrations/030_add_business_type.sql'), 'utf8');
  console.log('Applying 030_add_business_type.sql...');
  await client.query(sql);
  console.log('Migration applied.');

  // Verify
  const r = await client.query(
    "SELECT id, business_type, feature_flags FROM tenants WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')"
  );
  console.log('Tenant config:', JSON.stringify(r.rows, null, 2));

  await client.end();
}

run().catch(console.error);
