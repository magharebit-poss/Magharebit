-- ── TABLES ──────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_tables (
  table_id      UUID PRIMARY KEY
                DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  label         TEXT NOT NULL,
  capacity      INT  NOT NULL DEFAULT 4,
  pos_x         INT  NOT NULL DEFAULT 0,
  pos_y         INT  NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'available'
    CONSTRAINT table_status_check CHECK (
      status IN (
        'available','occupied','billed','reserved'
      )
    ),
  current_order_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tables_tenant
  ON floor_tables(tenant_id);

-- ── ORDERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cafe_orders (
  order_id      UUID PRIMARY KEY
                DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  table_id      UUID REFERENCES floor_tables(table_id),
  shift_id      UUID,
  staff_id      UUID,
  status        TEXT NOT NULL DEFAULT 'open'
    CONSTRAINT order_status_check CHECK (
      status IN ('open','billed','paid','cancelled')
    ),
  covers        INT  NOT NULL DEFAULT 1,
  note          TEXT,
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  billed_at     TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant
  ON cafe_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table
  ON cafe_orders(table_id);

-- ── ORDER LINES ─────────────────────────────
CREATE TABLE IF NOT EXISTS cafe_order_lines (
  line_id       UUID PRIMARY KEY
                DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL
                REFERENCES cafe_orders(order_id)
                ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  product_id    UUID NOT NULL,
  name_ar       TEXT NOT NULL,
  name_fr       TEXT,
  quantity      INT  NOT NULL DEFAULT 1,
  unit_price    NUMERIC(10,2) NOT NULL,
  modifiers     JSONB NOT NULL DEFAULT '[]',
  modifier_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total    NUMERIC(10,2) NOT NULL,
  kds_status    TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT kds_status_check CHECK (
      kds_status IN (
        'pending','preparing','ready','served'
      )
    ),
  sent_to_kds_at TIMESTAMPTZ,
  ready_at      TIMESTAMPTZ,
  served_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lines_order
  ON cafe_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_lines_kds
  ON cafe_order_lines(tenant_id, kds_status)
  WHERE kds_status IN ('pending','preparing');

-- ── MODIFIERS ───────────────────────────────
CREATE TABLE IF NOT EXISTS modifiers (
  modifier_id   UUID PRIMARY KEY
                DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  product_id    UUID,
  group_name_ar TEXT NOT NULL,
  group_name_fr TEXT,
  required      BOOLEAN NOT NULL DEFAULT false,
  multi_select  BOOLEAN NOT NULL DEFAULT false,
  options       JSONB NOT NULL DEFAULT '[]',
  sort_order    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_modifiers_product
  ON modifiers(tenant_id, product_id);

-- Seed 6 tables for test tenant
INSERT INTO floor_tables (
  table_id, tenant_id, label, capacity,
  pos_x, pos_y
) VALUES
('00000001-0001-0001-0001-000000000001',
 '11111111-1111-1111-1111-111111111111',
 'T1', 4, 80, 80),
('00000001-0001-0001-0001-000000000002',
 '11111111-1111-1111-1111-111111111111',
 'T2', 4, 260, 80),
('00000001-0001-0001-0001-000000000003',
 '11111111-1111-1111-1111-111111111111',
 'T3', 6, 440, 80),
('00000001-0001-0001-0001-000000000004',
 '11111111-1111-1111-1111-111111111111',
 'T4', 2, 80, 260),
('00000001-0001-0001-0001-000000000005',
 '11111111-1111-1111-1111-111111111111',
 'T5', 4, 260, 260),
('00000001-0001-0001-0001-000000000006',
 '11111111-1111-1111-1111-111111111111',
 'Bar', 8, 440, 260)
ON CONFLICT DO NOTHING;

-- Seed 2 modifier groups
INSERT INTO modifiers (
  modifier_id, tenant_id, product_id,
  group_name_ar, group_name_fr,
  required, multi_select, options
) VALUES
(
  '00000002-0001-0001-0001-000000000001',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  'السكر', 'Sucre',
  false, false,
  '[
    {"label_ar":"بدون سكر",
     "label_fr":"Sans sucre","price_delta":0},
    {"label_ar":"سكر عادي",
     "label_fr":"Sucre normal","price_delta":0},
    {"label_ar":"سكر مضاعف",
     "label_fr":"Double sucre","price_delta":0}
  ]'::jsonb
),
(
  '00000002-0001-0001-0001-000000000002',
  '11111111-1111-1111-1111-111111111111',
  NULL,
  'الحجم', 'Taille',
  true, false,
  '[
    {"label_ar":"صغير",
     "label_fr":"Petit","price_delta":0},
    {"label_ar":"وسط",
     "label_fr":"Moyen","price_delta":5},
    {"label_ar":"كبير",
     "label_fr":"Grand","price_delta":10}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
