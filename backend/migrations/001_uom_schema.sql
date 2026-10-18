-- Migration: 001_uom_schema
-- Creates: uom_conversions
-- Run order: first migration

CREATE TABLE uom_conversions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_uom    VARCHAR(20) NOT NULL,
    to_uom      VARCHAR(20) NOT NULL,
    factor      DECIMAL(12,6) NOT NULL CHECK (factor > 0),
    family      VARCHAR(20) NOT NULL
                CHECK (family IN ('weight', 'volume', 'count', 'cross')),
    density     DECIMAL(8,4),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_uom, to_uom)
);

CREATE INDEX idx_uom_family ON uom_conversions(family);
