import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../migrations/032_licenses.sql'), 'utf8');

const client = new pg.Client(
  process.env['DATABASE_URL'] ?? 'postgres://greengo:localdev@localhost:5432/greengo_dev',
);

async function run() {
  await client.connect();
  try {
    await client.query("SET client_encoding='UTF8'");
    await client.query(sql);
    console.log('Migration 032 applied.');
    const r = await client.query(
      `SELECT license_key, status, expires_at
       FROM licenses WHERE tenant_id = '11111111-1111-1111-1111-111111111111'`,
    );
    console.log('Test license:', r.rows);
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
