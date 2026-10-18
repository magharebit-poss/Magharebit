// CLI runner for the ClickHouse ETL pipeline.
// Usage:
//   npx tsx src/scripts/run-etl.ts
//   npx tsx src/scripts/run-etl.ts --dry-run
//   npx tsx src/scripts/run-etl.ts --tenant <uuid>
//   npx tsx src/scripts/run-etl.ts --date 2026-10-01
//   npx tsx src/scripts/run-etl.ts --tables fact_transactions,dim_products

import 'dotenv/config';
import pg from 'pg';
import { runEtl } from '../services/analytics/etl-runner.js';

const args = process.argv.slice(2);

const dryRun = args.includes('--dry-run');

const tenantIdx = args.indexOf('--tenant');
const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

const dateIdx = args.indexOf('--date');
const date = dateIdx >= 0 ? args[dateIdx + 1] : undefined;

const tablesIdx = args.indexOf('--tables');
const tables = tablesIdx >= 0 ? args[tablesIdx + 1]?.split(',') : undefined;

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
});

console.log('Starting ETL run...', { dryRun, tenantId, date, tables });

const results = await runEtl(pool, { tenantId, date, dryRun, tables });

for (const r of results) {
  const totalRows = Object.values(r.rowsSynced).reduce((a, b) => a + b, 0);
  console.log(`Tenant ${r.tenantId}: ${totalRows} total rows in ${r.durationMs}ms`, r.rowsSynced);
  if (Object.keys(r.errors).length > 0) {
    console.error('  Errors:', r.errors);
  }
}

if (dryRun) {
  console.log('[DRY RUN] No data was written to ClickHouse.');
}

await pool.end();
process.exit(0);
