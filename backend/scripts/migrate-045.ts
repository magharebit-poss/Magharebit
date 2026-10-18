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
  const sql = readFileSync(join(__dirname, '../migrations/045_cafe_courses.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 045 applied successfully.');

  const cols = await client.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'cafe_order_lines' AND column_name IN ('course_number', 'allergy_flags')
     ORDER BY column_name`,
  );
  console.log('\ncafe_order_lines new columns:', cols.rows.map((c) => `${c.column_name}:${c.data_type}`).join(', '));

  for (const t of ['course_fire_log', 'allergy_definitions']) {
    const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${rows[0]!.n} rows`);
  }
} finally {
  await client.end();
}
