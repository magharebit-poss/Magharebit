-- Revert gen_random_uuid() defaults added in 041 for columns that must never
-- be auto-filled: they are FK references or client-supplied idempotency keys.

-- Counter tables: PK is the tenant reference; a random value would silently
-- create orphan counters and corrupt receipt/invoice/return numbering sequences.
ALTER TABLE tenant_invoice_counters  ALTER COLUMN tenant_id    DROP DEFAULT;
ALTER TABLE tenant_receipt_counters  ALTER COLUMN tenant_id    DROP DEFAULT;
ALTER TABLE tenant_return_counters   ALTER COLUMN tenant_id    DROP DEFAULT;

-- Heartbeat table: PK is a real register reference (FK declared in migration 013).
-- A missing register_id is a bug that must surface, not be hidden.
ALTER TABLE register_heartbeats      ALTER COLUMN register_id  DROP DEFAULT;

-- Idempotency table: batch_id comes from the offline client (deduction-adjudicator.ts).
-- It is the key that prevents duplicate deductions on sync retry.
-- A random default would make every retry appear new, allowing duplicate sales.
ALTER TABLE processed_batches        ALTER COLUMN batch_id     DROP DEFAULT;
