-- Migration: 012_licenses_and_subscriptions
-- Depends on: 007_tenants_and_licenses
-- Creates: license_keys, updates tenants
-- Run order: must execute after 007

-- Add grace_period_hours to tenants (if not exists)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS grace_period_hours INTEGER DEFAULT 48;

-- ============================================================
-- LICENSE KEYS TABLE
-- ============================================================

CREATE TABLE license_keys (
    license_key_id    UUID PRIMARY KEY,
    key_string        TEXT NOT NULL UNIQUE,
    tenant_id         UUID NOT NULL,
    status            TEXT NOT NULL DEFAULT 'unbound'
                      CHECK (status IN ('active', 'GRACE', 'EXPIRED', 'revoked', 'unbound')),
    binding_device_id TEXT,
    bound_at          TIMESTAMPTZ,
    activated_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    subscription_tier TEXT CHECK (subscription_tier IN ('monthly', 'quarterly', 'annual')),
    grace_period_hours INTEGER DEFAULT 48,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        UUID NOT NULL
);

CREATE INDEX idx_license_keys_tenant_status ON license_keys(tenant_id, status);
CREATE INDEX idx_license_keys_device ON license_keys(binding_device_id);
CREATE INDEX idx_license_keys_expiry ON license_keys(expires_at, status);
