-- Migration: 009_shifts
-- Depends on: 007_tenants_and_licenses
-- Creates: staff, shifts
-- Run order: must execute after 007

-- ============================================================
-- STAFF TABLE
-- pin_hash: SHA-256 hex string (64 chars). NEVER store plain PIN.
-- ============================================================

CREATE TABLE staff (
    staff_id    UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    name_ar     VARCHAR(255) NOT NULL,
    name_fr     VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL
                CHECK (role IN ('CASHIER', 'MANAGER', 'SUPERVISOR')),
    pin_hash    VARCHAR(64) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_tenant_active ON staff(tenant_id, is_active);
CREATE INDEX idx_staff_role ON staff(role);

-- ============================================================
-- SHIFTS TABLE
-- ============================================================

CREATE TABLE shifts (
    shift_id               UUID PRIMARY KEY,
    tenant_id              UUID NOT NULL,
    register_id            UUID NOT NULL,
    cashier_id             UUID NOT NULL REFERENCES staff(staff_id),
    opened_at              TIMESTAMPTZ NOT NULL,
    closed_at              TIMESTAMPTZ,
    status                 VARCHAR(10) NOT NULL
                           CHECK (status IN ('open', 'closed', 'error')),
    opening_float          INTEGER NOT NULL CHECK (opening_float >= 0),
    closing_cash_counted   INTEGER,
    expected_cash          INTEGER,
    cash_variance          INTEGER,
    total_sales_piastres   INTEGER NOT NULL DEFAULT 0,
    total_tax_piastres     INTEGER NOT NULL DEFAULT 0,
    total_waste_records    INTEGER NOT NULL DEFAULT 0,
    total_waste_grams      INTEGER NOT NULL DEFAULT 0,
    final_chain_hash       VARCHAR(64),
    z_report_json          JSONB
);

CREATE INDEX idx_shifts_register_status ON shifts(register_id, status);
CREATE INDEX idx_shifts_tenant ON shifts(tenant_id);
