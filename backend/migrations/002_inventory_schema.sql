-- Migration: 002_inventory_schema
-- Depends on: 001_uom_schema
-- Creates: ingredients, ingredient_lots
-- Run order: must execute after 001

-- ============================================================
-- INGREDIENTS TABLE (must exist before ingredient_lots FK)
-- ============================================================

CREATE TABLE ingredients (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL,
    name_ar           VARCHAR(255) NOT NULL,
    name_fr           VARCHAR(255) NOT NULL,
    storage_uom       VARCHAR(20) NOT NULL,
    nominal_yield_pct DECIMAL(5,2) NOT NULL
                      CHECK (nominal_yield_pct > 0 AND nominal_yield_pct <= 100),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_tenant ON ingredients(tenant_id);

-- ============================================================
-- INGREDIENT LOTS TABLE
-- ============================================================

CREATE TABLE ingredient_lots (
    lot_id                   UUID PRIMARY KEY,
    ingredient_id            UUID NOT NULL REFERENCES ingredients(id),
    tenant_id                UUID NOT NULL,
    received_at              TIMESTAMPTZ NOT NULL,
    nominal_yield_pct        DECIMAL(5,2) NOT NULL
                             CHECK (nominal_yield_pct > 0 AND nominal_yield_pct <= 100),
    actual_yield_pct         DECIMAL(5,2)
                             CHECK (actual_yield_pct IS NULL OR (actual_yield_pct > 0 AND actual_yield_pct <= 100)),
    recorded_by              UUID,
    recorded_at              TIMESTAMPTZ,
    quantity_received_grams  DECIMAL(12,2) NOT NULL,
    quantity_remaining_grams DECIMAL(12,2) NOT NULL,
    state                    VARCHAR(10) NOT NULL
                             CHECK (state IN ('RECEIVED','ACTIVE','DEPLETED','ARCHIVED')),
    activated_at             TIMESTAMPTZ,
    depleted_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lots_ingredient_active ON ingredient_lots(ingredient_id, state)
    WHERE state = 'ACTIVE';
CREATE INDEX idx_lots_tenant ON ingredient_lots(tenant_id);
