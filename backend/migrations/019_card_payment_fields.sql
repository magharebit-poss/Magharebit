-- 019_card_payment_fields.sql
-- Adds card terminal approval fields to transactions table.
-- Idempotent — safe to run multiple times.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS card_approval_code TEXT,
  ADD COLUMN IF NOT EXISTS card_masked_pan    TEXT;
