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
  const sql = readFileSync(join(__dirname, '../migrations/042_revert_uuid_defaults.sql'), 'utf8');
  await client.query(sql);
  console.log('Migration 042 applied successfully.');

  // Verify the 5 columns now have NULL defaults
  const { rows } = await client.query<{ table_name: string; column_name: string; column_default: string | null }>(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('tenant_invoice_counters','tenant_receipt_counters','tenant_return_counters','register_heartbeats','processed_batches')
      AND column_name IN ('tenant_id','register_id','batch_id')
    ORDER BY table_name, column_name
  `);

  console.log('\nVerification — column defaults after migration 042:');
  const reverted: string[] = [];
  const wrong: string[] = [];
  for (const r of rows) {
    const label = `${r.table_name}.${r.column_name}`;
    if (r.column_default === null) {
      reverted.push(label);
      console.log(`  ✓ ${label} = NULL`);
    } else {
      wrong.push(`${label} = ${r.column_default}`);
      console.log(`  ✗ ${label} = ${r.column_default}  <-- still has a default!`);
    }
  }

  console.log('\nDEFAULTS REVERTED:', reverted.join(', '));
  if (wrong.length > 0) console.log('WRONG:', wrong.join(', '));
  else console.log('KEPT: none (all 5 reverted as expected)');
} finally {
  await client.end();
}
