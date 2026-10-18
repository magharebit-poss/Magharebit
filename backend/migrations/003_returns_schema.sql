-- Migration: 003_returns_schema
-- Depends on: 002_inventory_schema
-- Creates: returns
-- Run order: must execute after 002

CREATE TABLE returns (
    return_id                UUID PRIMARY KEY,
    tenant_id                UUID NOT NULL,
    register_id              UUID NOT NULL,
    original_transaction_id  UUID NOT NULL,
    original_server_received_at TIMESTAMPTZ NOT NULL,
    initiated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    state                    VARCHAR(30) NOT NULL
                             CHECK (state IN (
                               'RETURN_INITIATED','TIME_CHECK',
                               'INSPECTION_PENDING','RESTOCK_APPROVED',
                               'WASTE_ROUTED'
                             )),
    route                    VARCHAR(10)
                             CHECK (route IS NULL OR route IN ('RESTOCK','WASTE')),
    elapsed_seconds          DECIMAL(10,2) GENERATED ALWAYS AS
                             (EXTRACT(EPOCH FROM (initiated_at - original_server_received_at))) STORED,
    returned_items           JSONB NOT NULL DEFAULT '[]',
    manager_approved_by      UUID,
    manager_pin_verified_at  TIMESTAMPTZ,
    cashier_id               UUID NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_returns_tenant ON returns(tenant_id);
CREATE INDEX idx_returns_transaction ON returns(original_transaction_id);
