-- Migration: 005_waste_records
-- Depends on: 002_inventory_schema (ingredients table FK)
-- Creates: waste_records
-- Run order: must execute after 002

-- ============================================================
-- WASTE RECORDS — immutable after creation (INSERT only)
-- The application DB user should be granted INSERT privilege only.
-- No UPDATE or DELETE on this table (enforced at DB role level).
-- ============================================================

CREATE TABLE waste_records (
    waste_record_id         UUID PRIMARY KEY,
    tenant_id               UUID NOT NULL,
    register_id             UUID NOT NULL,
    ingredient_id           UUID NOT NULL REFERENCES ingredients(id),
    ingredient_lot_id       UUID,
    weight_grams            DECIMAL(8,2) NOT NULL
                            CHECK (weight_grams > 0 AND weight_grams <= 50000),
    reason_code             VARCHAR(20) NOT NULL
                            CHECK (reason_code IN ('EXPIRED','DAMAGED','OVERSTOCK',
                                   'PREPARATION','CUSTOMER_RETURN','OTHER')),
    recorded_by             UUID NOT NULL,
    approved_by             UUID NOT NULL,
    manager_pin_verified_at TIMESTAMPTZ NOT NULL,
    client_timestamp        TIMESTAMPTZ NOT NULL,
    server_received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status             VARCHAR(10) NOT NULL DEFAULT 'pending'
                            CHECK (sync_status IN ('pending','synced','rejected')),
    photo_evidence_url      TEXT,
    source_type             VARCHAR(20) NOT NULL
                            CHECK (source_type IN ('manual','return-routed','checkout-rollback')),
    chain_hash              VARCHAR(64) NOT NULL
);

CREATE INDEX idx_waste_records_tenant ON waste_records(tenant_id);
CREATE INDEX idx_waste_records_ingredient ON waste_records(ingredient_id);
CREATE INDEX idx_waste_records_timestamp ON waste_records(client_timestamp);
CREATE INDEX idx_waste_records_sync ON waste_records(sync_status);

-- NOTE: INSERT-only enforcement is applied at the DB role level:
-- REVOKE UPDATE, DELETE ON waste_records FROM app_user;
-- This is an infrastructure concern handled during production deployment.
