import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(__dirname, '../migrations/033_cafe.sql'),
  'utf8'
);
const client = new pg.Client(
  process.env.DATABASE_URL
  ?? 'postgres://greengo:localdev@localhost:5432/greengo_dev'
);
async function run() {
  await client.connect();
  try {
    await client.query("SET client_encoding='UTF8'");
    await client.query(sql);
    const t = await client.query(
      `SELECT label, status FROM floor_tables
       WHERE tenant_id = '11111111-1111-1111-1111-111111111111'`
    );
    console.log('Tables:', t.rows);
    const m = await client.query(
      `SELECT group_name_ar FROM modifiers
       WHERE tenant_id = '11111111-1111-1111-1111-111111111111'`
    );
    console.log('Modifiers:', m.rows);
    console.log('Migration 033 applied.');
  } finally { await client.end(); }
}
run().catch(e => { console.error(e); process.exit(1); });
