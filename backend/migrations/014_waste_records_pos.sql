-- Migration: 014_waste_records_pos
-- Non-destructive additions for POS-web waste recording.
-- Safe to run multiple times (idempotent).
-- Depends on: 005_waste_records, 007_tenants_and_licenses, 009_shifts, 013_remaining_tables

-- ─── 1. Add new columns ──────────────────────────────────────────────────
ALTER TABLE waste_records
  ADD COLUMN IF NOT EXISTS product_id    UUID,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS shift_id      UUID;

-- ─── 2. Drop NOT NULL on POS-blocking columns (idempotent) ───────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'waste_records'
      AND column_name = 'approved_by'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE waste_records ALTER COLUMN approved_by DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'waste_records'
      AND column_name = 'manager_pin_verified_at'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE waste_records ALTER COLUMN manager_pin_verified_at DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'waste_records'
      AND column_name = 'ingredient_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE waste_records ALTER COLUMN ingredient_id DROP NOT NULL;
  END IF;
END $$;

-- ─── 3. Extend reason_code CHECK constraint ──────────────────────────────
-- Drop old constraint by exact name confirmed in Understand phase, then
-- re-add with extended value set including SPOILED and PREP_DAMAGE.
ALTER TABLE waste_records
  DROP CONSTRAINT IF EXISTS waste_records_reason_code_check;

ALTER TABLE waste_records
  ADD CONSTRAINT waste_records_reason_code_check
  CHECK (reason_code IN (
    'EXPIRED', 'DAMAGED', 'OVERSTOCK',
    'PREPARATION', 'CUSTOMER_RETURN', 'OTHER',
    'SPOILED', 'PREP_DAMAGE'
  ));

-- ─── 4. Performance index for shift queries ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_waste_records_shift_id
  ON waste_records(shift_id, server_received_at DESC);

-- ─── 5. FK for shift_id (nullable, no cascade) ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'waste_records_shift_id_fkey'
      AND table_name = 'waste_records'
  ) THEN
    ALTER TABLE waste_records
      ADD CONSTRAINT waste_records_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 6. FK for product_id (nullable, no cascade) ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'waste_records_product_id_fkey'
      AND table_name = 'waste_records'
  ) THEN
    ALTER TABLE waste_records
      ADD CONSTRAINT waste_records_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(product_id)
      ON DELETE SET NULL;
  END IF;
END $$;
