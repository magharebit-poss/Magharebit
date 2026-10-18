/**
 * sync-dim-date.ts
 * Copies all rows from the PostgreSQL dim_date table into ClickHouse.
 * Safe to re-run: dim_date uses ReplacingMergeTree and deduplicates on merge.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/sync-dim-date.ts
 *
 * Prerequisites:
 *   - Migration 034 must have been run (dim_date exists in PostgreSQL)
 *   - ClickHouse container must be running (003_agg_tables.sql applied)
 */

import pg from 'pg';
import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in backend/.env');
  process.exit(1);
}

const containerName = process.env['CLICKHOUSE_CONTAINER'] ?? 'infra-clickhouse-1';
const chUser       = process.env['CLICKHOUSE_USER']      ?? 'magharebit';
const chPassword   = process.env['CLICKHOUSE_PASSWORD']  ?? 'analyticsdev';
const chDb         = process.env['CLICKHOUSE_DB']        ?? 'magharebit_analytics';

type DimDateRow = {
  date: Date;
  year: number;
  month: number;
  day_of_week: number;
  is_weekend: boolean;
  is_friday: boolean;
  holiday_code: string | null;
  holiday_name_ar: string | null;
  holiday_name_fr: string | null;
  is_ramadan: boolean;
  date_confirmed: boolean;
};

async function main(): Promise<void> {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  const { rows } = await pool.query<DimDateRow>(`SELECT * FROM dim_date ORDER BY date`);

  if (rows.length === 0) {
    console.error('dim_date is empty — run "npx tsx scripts/migrate-034.ts" first');
    await pool.end();
    process.exit(1);
  }

  // Serialize as ClickHouse JSONEachRow.
  // PG returns DATE columns as JS Date objects (midnight UTC); slice to YYYY-MM-DD.
  const jsonLines = rows
    .map((r) =>
      JSON.stringify({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        year:            r.year,
        month:           r.month,
        day_of_week:     r.day_of_week,
        is_weekend:      r.is_weekend  ? 1 : 0,
        is_friday:       r.is_friday   ? 1 : 0,
        holiday_code:    r.holiday_code    ?? null,
        holiday_name_ar: r.holiday_name_ar ?? null,
        holiday_name_fr: r.holiday_name_fr ?? null,
        is_ramadan:      r.is_ramadan      ? 1 : 0,
        date_confirmed:  r.date_confirmed  ? 1 : 0,
      }),
    )
    .join('\n');

  execSync(
    `docker exec -i ${containerName} clickhouse-client` +
      ` --user ${chUser}` +
      ` --password ${chPassword}` +
      ` --database ${chDb}` +
      ` --query "INSERT INTO dim_date FORMAT JSONEachRow"`,
    { input: jsonLines, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );

  console.log(`✓ Synced ${rows.length} dim_date rows to ClickHouse (${chDb}.dim_date)`);

  const holidays = rows.filter((r) => r.holiday_code !== null).length;
  const unconfirmed = rows.filter((r) => !r.date_confirmed).length;
  console.log(`  ${holidays} holiday entries, ${unconfirmed} unconfirmed (Islamic calendar)`);

  await pool.end();
}

main().catch((err: unknown) => {
  console.error('sync-dim-date failed:', err);
  process.exit(1);
});
