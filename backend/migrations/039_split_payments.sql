-- Migration 039: split payments
-- sale_tenders: one row per payment method per transaction
CREATE TABLE IF NOT EXISTS sale_tenders (
  tender_id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id  UUID NOT NULL REFERENCES transactions(transaction_id),
  shift_id        UUID NOT NULL,
  method          TEXT NOT NULL CHECK (method IN (
    'cash', 'card_cmi', 'card_visa', 'card_mastercard',
    'mobile_cih', 'mobile_cih_pay', 'mobile_orange_money',
    'mobile_inwi_money', 'credit', 'voucher', 'other'
  )),
  amount_piastres INTEGER NOT NULL CHECK (amount_piastres > 0),
  reference       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_tenders_transaction ON sale_tenders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sale_tenders_shift ON sale_tenders(shift_id);

-- payment_method_config: per-tenant enabled payment methods
CREATE TABLE IF NOT EXISTS payment_method_config (
  config_id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  method      TEXT NOT NULL CHECK (method IN (
    'cash', 'card_cmi', 'card_visa', 'card_mastercard',
    'mobile_cih', 'mobile_cih_pay', 'mobile_orange_money',
    'mobile_inwi_money', 'credit', 'voucher', 'other'
  )),
  label_ar    TEXT NOT NULL,
  label_fr    TEXT NOT NULL,
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, method)
);

CREATE INDEX IF NOT EXISTS idx_payment_method_config_tenant ON payment_method_config(tenant_id);

-- Seed: 6 methods for the dev/test tenant
INSERT INTO payment_method_config (tenant_id, method, label_ar, label_fr, sort_order)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cash',                 'نقد',          'Espèces',      1),
  ('11111111-1111-1111-1111-111111111111', 'card_cmi',             'بطاقة CMI',    'Carte CMI',    2),
  ('11111111-1111-1111-1111-111111111111', 'mobile_cih',           'CIH مباشر',    'CIH Direct',   3),
  ('11111111-1111-1111-1111-111111111111', 'mobile_orange_money',  'أورانج موني',  'Orange Money', 4),
  ('11111111-1111-1111-1111-111111111111', 'credit',               'آجل',          'Crédit',       5),
  ('11111111-1111-1111-1111-111111111111', 'voucher',              'قسيمة',        'Bon',          6)
ON CONFLICT (tenant_id, method) DO NOTHING;
