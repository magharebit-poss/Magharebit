CREATE TABLE IF NOT EXISTS licenses (
  license_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  license_key         TEXT NOT NULL UNIQUE,
  status              TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT license_status_check
    CHECK (status IN ('active','revoked','expired')),
  expires_at          TIMESTAMPTZ,
  machine_id          TEXT,
  first_activated_at  TIMESTAMPTZ,
  last_validated_at   TIMESTAMPTZ,
  plan                TEXT NOT NULL DEFAULT 'starter',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key    ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant ON licenses(tenant_id);

INSERT INTO licenses (
  tenant_id,
  license_key,
  status,
  expires_at,
  plan
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'MGH-DEV000-00000000-0000-00',
  'active',
  NULL,
  'business'
) ON CONFLICT DO NOTHING;
