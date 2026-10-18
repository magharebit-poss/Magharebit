-- Migration: 015_receipt_numbers
-- Non-destructive additions for per-sale customer receipts.
-- Adds a human-readable, per-tenant sequential receipt number to transactions.
-- Idempotent (safe to run multiple times).
-- Depends on: 007_tenants_and_licenses, 013_remaining_tables (transactions)

-- ─── 1. Receipt number column on transactions ────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- ─── 2. Per-tenant receipt counter ───────────────────────────────────────
-- One row per tenant. Incremented atomically at sale time via an
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING (single statement, row-locked
-- on conflict) so concurrent sales never collide. NOT a global sequence —
-- numbering is scoped per tenant.
CREATE TABLE IF NOT EXISTS tenant_receipt_counters (
  tenant_id  UUID PRIMARY KEY,
  last_seq   BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Uniqueness of receipt numbers within a tenant ────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_receipt_per_tenant
  ON transactions(tenant_id, receipt_number)
  WHERE receipt_number IS NOT NULL;
