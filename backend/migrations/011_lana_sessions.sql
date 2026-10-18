-- Migration: 011_lana_sessions
-- Depends on: 010_payment_transactions
-- Creates: lana_sessions
-- Run order: must execute after 010

CREATE TABLE lana_sessions (
    session_id      TEXT PRIMARY KEY,
    transaction_ref TEXT NOT NULL,
    register_id     UUID NOT NULL,
    tenant_id       UUID NOT NULL,
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_lana_sessions_register ON lana_sessions(register_id, status);
CREATE INDEX idx_lana_sessions_status ON lana_sessions(status);
