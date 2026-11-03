-- Rollback of 050_transactions_client_tx_id.sql. DRAFT, not applied.
-- Data loss: dropping the columns discards every client_tx_id, device_id and local_receipt_ref
-- written since 050 was applied. Take a backup of those columns first if any rows exist:
--   COPY (SELECT transaction_id, client_tx_id, device_id, local_receipt_ref FROM transactions
--         WHERE client_tx_id IS NOT NULL OR device_id IS NOT NULL OR local_receipt_ref IS NOT NULL) TO STDOUT CSV HEADER;
-- Do not roll back once the backend relies on client_tx_id for replay safety (duplicates become possible again).

DROP INDEX IF EXISTS idx_transactions_client_tx_per_tenant;

ALTER TABLE transactions
  DROP COLUMN IF EXISTS local_receipt_ref,
  DROP COLUMN IF EXISTS device_id,
  DROP COLUMN IF EXISTS client_tx_id;
