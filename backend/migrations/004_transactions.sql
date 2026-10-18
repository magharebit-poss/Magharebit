-- Migration: 004_transactions
-- Depends on: 001_uom_schema, 002_inventory_schema, 003_returns_schema
-- Creates: backend_stock, processed_batches
-- Run order: must execute after 002 (requires ingredients table FK)

-- ============================================================
-- BACKEND STOCK — authoritative server-side inventory per ingredient
-- CHECK constraint is the last line of defense against negative
-- stock at the DB level. The adjudicator prevents it in logic,
-- but this constraint makes it architecturally impossible (LAW 1).
-- ============================================================

CREATE TABLE backend_stock (
    ingredient_id            UUID NOT NULL,
    tenant_id                UUID NOT NULL,
    quantity_remaining_grams DECIMAL(14,2) NOT NULL
                             CHECK (quantity_remaining_grams >= 0),
    last_updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grant_version            INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ingredient_id, tenant_id),
    CONSTRAINT fk_backend_stock_ingredient
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
    CONSTRAINT quantity_non_negative
        CHECK (quantity_remaining_grams >= 0)
);

CREATE INDEX idx_backend_stock_tenant ON backend_stock(tenant_id);

-- ============================================================
-- PROCESSED BATCHES — idempotency table for sync deduction batches
-- ============================================================

CREATE TABLE processed_batches (
    batch_id        UUID PRIMARY KEY,
    register_id     UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_json   JSONB NOT NULL,
    deduction_count INTEGER NOT NULL
);

CREATE INDEX idx_processed_batches_tenant ON processed_batches(tenant_id);
CREATE INDEX idx_processed_batches_processed_at ON processed_batches(processed_at);
