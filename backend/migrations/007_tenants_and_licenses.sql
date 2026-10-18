-- Migration: 007_tenants_and_licenses
-- Creates: tenants, stores, registers, tenant_users
-- Run order: must execute before 008, 009

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'trial')),
    country         VARCHAR(50) NOT NULL DEFAULT 'Morocco',
    grace_period_hours INTEGER DEFAULT 48,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stores (
    store_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name_ar     VARCHAR(255) NOT NULL,
    name_fr     VARCHAR(255) NOT NULL,
    address     TEXT,
    city        VARCHAR(100),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_tenant ON stores(tenant_id);

CREATE TABLE registers (
    register_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(store_id),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        VARCHAR(100) NOT NULL,
    device_id   TEXT,
    status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_registers_store ON registers(store_id);
CREATE INDEX idx_registers_tenant ON registers(tenant_id);

CREATE TABLE tenant_users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    email       VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(30) NOT NULL DEFAULT 'TENANT_OWNER'
                CHECK (role IN ('TENANT_OWNER', 'TENANT_ADMIN', 'SUPPORT_AGENT')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (email, tenant_id)
);

CREATE INDEX idx_tenant_users_email ON tenant_users(email);
