-- Migration 040: supplier financial ledger
-- Extends: suppliers table (adds ledger columns)
-- Creates: supplier_invoices, supplier_invoice_lines, supplier_payments

-- ── Extend existing suppliers with ledger columns ─────────────────────────────
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS name_ar     TEXT,
  ADD COLUMN IF NOT EXISTS name_fr     TEXT,
  ADD COLUMN IF NOT EXISTS ice         TEXT,
  ADD COLUMN IF NOT EXISTS balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Back-fill name_ar from name for rows that already exist
UPDATE suppliers SET name_ar = name WHERE name_ar IS NULL;

-- ── PURCHASE INVOICES (financial) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_invoices (
  invoice_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  supplier_id     UUID NOT NULL REFERENCES suppliers(supplier_id),
  invoice_ref     TEXT,
  invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'unpaid'
    CONSTRAINT inv_status_check CHECK (
      status IN ('unpaid','partial','paid','cancelled')
    ),
  subtotal_mad    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_mad         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_mad       NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_mad        NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_mad   NUMERIC(12,2) GENERATED ALWAYS AS (total_mad - paid_mad) STORED,
  stock_received  BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier
  ON supplier_invoices(tenant_id, supplier_id, status);

-- ── INVOICE LINES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  line_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES supplier_invoices(invoice_id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  product_id      UUID,
  description_ar  TEXT NOT NULL,
  description_fr  TEXT,
  quantity        NUMERIC(12,3) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'unit',
  unit_cost_mad   NUMERIC(12,4) NOT NULL,
  line_total_mad  NUMERIC(12,2) NOT NULL,
  update_cost     BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_inv_lines_invoice
  ON supplier_invoice_lines(invoice_id);

-- ── SUPPLIER PAYMENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
  payment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  supplier_id     UUID NOT NULL REFERENCES suppliers(supplier_id),
  invoice_id      UUID REFERENCES supplier_invoices(invoice_id),
  amount_mad      NUMERIC(12,2) NOT NULL CHECK (amount_mad > 0),
  method          TEXT NOT NULL DEFAULT 'cash'
    CONSTRAINT pay_method_check CHECK (
      method IN ('cash','bank_transfer','cheque','mobile','other')
    ),
  reference       TEXT,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  recorded_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier
  ON supplier_payments(tenant_id, supplier_id, payment_date DESC);

-- ── Seed 3 test suppliers ─────────────────────────────────────────────────────
INSERT INTO suppliers (
  supplier_id, tenant_id,
  name, name_ar, name_fr, phone, balance
) VALUES
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  '11111111-1111-1111-1111-111111111111',
  'مورد الخضار والفواكه',
  'مورد الخضار والفواكه',
  'Fournisseur F&L',
  '0661000001', 850.00
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  '11111111-1111-1111-1111-111111111111',
  'مخبزة الأطلس',
  'مخبزة الأطلس',
  'Boulangerie Atlas',
  '0661000002', 320.50
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
  '11111111-1111-1111-1111-111111111111',
  'شركة المشروبات المغربية',
  'شركة المشروبات المغربية',
  'Boissons Maroc SARL',
  '0661000003', 0.00
)
ON CONFLICT (supplier_id) DO NOTHING;
