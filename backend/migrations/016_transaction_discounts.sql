-- Migration: 016_transaction_discounts
-- Non-destructive additions for manual cashier discounts on a sale.
-- Per-line discounts live inside the transactions.items JSONB (each line carries
-- its own { type, value, managerApprovedBy }). These columns capture the
-- cart-level discount and audit fields. Idempotent.
-- Depends on: 013_remaining_tables (transactions), 015_receipt_numbers

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cart_discount_type         TEXT,
  ADD COLUMN IF NOT EXISTS cart_discount_value        INTEGER,
  ADD COLUMN IF NOT EXISTS cart_discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_discount_cents       INTEGER NOT NULL DEFAULT 0,
  -- Manager who approved an over-threshold discount (line or cart), for audit.
  ADD COLUMN IF NOT EXISTS discount_approved_by       UUID;

-- Guard rails matching the application logic.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'transactions' AND constraint_name = 'chk_cart_discount_type'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT chk_cart_discount_type
      CHECK (cart_discount_type IS NULL OR cart_discount_type IN ('percentage', 'fixed'));
  END IF;
END $$;
