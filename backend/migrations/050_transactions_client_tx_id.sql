-- Migration 050: replay-safe sales (client_tx_id), device id, provisional receipt ref
--   *** DRAFT: NOT APPLIED ***  Review before applying.
-- Apply with: npx tsx scripts/migrate-050.ts (from backend). Rollback: migrations/rollback/050_rollback.sql
-- Depends on: 013 (transactions), 015 (receipt numbers), 034 (sold_at)
--
-- Why: POST /transactions has no idempotency key. If a response is lost, the offline drain
-- retries and the server records a second sale, burns a second receipt number and deducts
-- stock twice (docs/pos-architecture-sync.md, F1).
--
-- client_tx_id   UUID supplied by the POS for each payment attempt. Deliberately NO DEFAULT:
--                a database-generated value would make every retry look like a new sale
--                (same reasoning as processed_batches.batch_id, migration 042).
-- device_id      stable id of the terminal that made the sale. TEXT, same type as
--                registers.device_id. Informational; the unique key below does not use it.
-- local_receipt_ref  the provisional LOCAL-xxxxxxxx number printed offline, kept so the
--                official R-number issued at sync can be linked to it. No renumbering logic here.
--
-- Existing rows keep NULL in all three columns. Nothing is backfilled.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS client_tx_id      UUID,
  ADD COLUMN IF NOT EXISTS device_id         TEXT,
  ADD COLUMN IF NOT EXISTS local_receipt_ref TEXT;

COMMENT ON COLUMN transactions.client_tx_id IS
  'Client-supplied idempotency key (one per payment attempt). NO DEFAULT on purpose. Unique per tenant when set.';
COMMENT ON COLUMN transactions.device_id IS
  'Stable terminal id that recorded the sale (see registers.device_id).';
COMMENT ON COLUMN transactions.local_receipt_ref IS
  'Provisional LOCAL- receipt number printed while offline; links to the official receipt_number issued at sync.';

-- One sale per (tenant, client_tx_id). Partial, so existing and legacy rows (NULL) are exempt
-- and a replayed POST can be answered from the stored row.
-- NOTE: not CONCURRENTLY, because migrations here run inside a transaction. See the lock note.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_client_tx_per_tenant
  ON transactions (tenant_id, client_tx_id)
  WHERE client_tx_id IS NOT NULL;
