-- Add gen_random_uuid() defaults to UUID primary key columns that had none.
-- Composite-PK FK columns (allocated_stock, backend_stock) are intentionally excluded.

ALTER TABLE ingredients               ALTER COLUMN id                SET DEFAULT gen_random_uuid();
ALTER TABLE ingredient_lots           ALTER COLUMN lot_id            SET DEFAULT gen_random_uuid();
ALTER TABLE license_keys              ALTER COLUMN license_key_id    SET DEFAULT gen_random_uuid();
ALTER TABLE payment_transactions      ALTER COLUMN payment_tx_id     SET DEFAULT gen_random_uuid();
ALTER TABLE pending_deductions_queue  ALTER COLUMN deduction_id      SET DEFAULT gen_random_uuid();
ALTER TABLE processed_batches         ALTER COLUMN batch_id          SET DEFAULT gen_random_uuid();
ALTER TABLE register_heartbeats       ALTER COLUMN register_id       SET DEFAULT gen_random_uuid();
ALTER TABLE returns                   ALTER COLUMN return_id         SET DEFAULT gen_random_uuid();
ALTER TABLE shifts                    ALTER COLUMN shift_id          SET DEFAULT gen_random_uuid();
ALTER TABLE staff                     ALTER COLUMN staff_id          SET DEFAULT gen_random_uuid();
ALTER TABLE tenant_invoice_counters   ALTER COLUMN tenant_id         SET DEFAULT gen_random_uuid();
ALTER TABLE tenant_receipt_counters   ALTER COLUMN tenant_id         SET DEFAULT gen_random_uuid();
ALTER TABLE tenant_return_counters    ALTER COLUMN tenant_id         SET DEFAULT gen_random_uuid();
ALTER TABLE transactions              ALTER COLUMN transaction_id    SET DEFAULT gen_random_uuid();
ALTER TABLE waste_records             ALTER COLUMN waste_record_id   SET DEFAULT gen_random_uuid();
