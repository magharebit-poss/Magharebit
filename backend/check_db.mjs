import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://greengo:localdev@localhost:5432/greengo_dev',
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  await client.query('SELECT 1');
  console.log('DB_REACHABLE: yes');

  // Run 041 idempotently
  const sql041 = [
    `ALTER TABLE ingredients               ALTER COLUMN id                SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE ingredient_lots           ALTER COLUMN lot_id            SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE license_keys              ALTER COLUMN license_key_id    SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE payment_transactions      ALTER COLUMN payment_tx_id     SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE pending_deductions_queue  ALTER COLUMN deduction_id      SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE returns                   ALTER COLUMN return_id         SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE shifts                    ALTER COLUMN shift_id          SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE staff                     ALTER COLUMN staff_id          SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE transactions              ALTER COLUMN transaction_id    SET DEFAULT gen_random_uuid()`,
    `ALTER TABLE waste_records             ALTER COLUMN waste_record_id   SET DEFAULT gen_random_uuid()`,
  ];
  for (const s of sql041) await client.query(s);
  console.log('Migration 041: applied');

  // Run 042 idempotently
  const sql042 = [
    `ALTER TABLE tenant_invoice_counters ALTER COLUMN tenant_id    DROP DEFAULT`,
    `ALTER TABLE tenant_receipt_counters ALTER COLUMN tenant_id    DROP DEFAULT`,
    `ALTER TABLE tenant_return_counters  ALTER COLUMN tenant_id    DROP DEFAULT`,
    `ALTER TABLE register_heartbeats     ALTER COLUMN register_id  DROP DEFAULT`,
    `ALTER TABLE processed_batches       ALTER COLUMN batch_id     DROP DEFAULT`,
  ];
  for (const s of sql042) await client.query(s);
  console.log('Migration 042: applied');

  // Verify key columns
  const { rows } = await client.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('staff','staff_id'),
        ('processed_batches','batch_id'),
        ('tenant_invoice_counters','tenant_id')
      )
    ORDER BY table_name, column_name
  `);
  for (const r of rows) {
    console.log(`  ${r.table_name}.${r.column_name} = ${r.column_default ?? 'NULL'}`);
  }
} catch (e) {
  console.log('DB_REACHABLE: no —', e.message);
} finally {
  await client.end().catch(() => {});
}
