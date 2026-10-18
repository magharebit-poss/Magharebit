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
  const sql = readFileSync(join(__dirname, '../migrations/041_uuid_defaults.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 041 applied successfully.');
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('already exists') || msg.includes('column_default')) {
    console.log('Migration 041 may already be applied:', msg);
  } else {
    throw e;
  }
} finally {
  await client.end();
}
