-- Migration: 010_payment_transactions
-- Depends on: 004_transactions (transactions table reference)
-- Creates: payment_transactions
-- Run order: must execute after 004

-- ============================================================
-- PAYMENT TRANSACTIONS — stores tokenized references only
-- PCI scope: OUT OF SCOPE — no card data stored.
-- cmi_token_ref: Opaque CMI token. Contains no card data.
-- offline_auth_code: ARQC cryptogram. Not card data.
-- ============================================================

CREATE TABLE payment_transactions (
    payment_tx_id       UUID PRIMARY KEY,
    sale_transaction_id UUID NOT NULL,
    shift_id            UUID NOT NULL,
    register_id         UUID NOT NULL,
    amount              INTEGER NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3) NOT NULL DEFAULT 'MAD'
                        CHECK (currency = 'MAD'),
    payment_method      VARCHAR(10) NOT NULL
                        CHECK (payment_method IN ('card', 'lana', 'cash')),
    status              VARCHAR(15) NOT NULL
                        CHECK (status IN ('approved', 'offline_auth', 'declined', 'error')),
    cmi_token_ref       TEXT,  -- Opaque CMI token. Contains no card data. PCI: out of scope.
    offline_auth_code   TEXT,  -- ARQC cryptogram from terminal. Not card data.
    terminal_response   TEXT,  -- Status code only (e.g., "00"). Not card data.
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status         VARCHAR(10) NOT NULL DEFAULT 'pending'
                        CHECK (sync_status IN ('pending', 'synced', 'rejected'))
);

CREATE INDEX idx_payment_tx_sync ON payment_transactions(sync_status);
CREATE INDEX idx_payment_tx_sale ON payment_transactions(sale_transaction_id);
CREATE INDEX idx_payment_tx_shift ON payment_transactions(shift_id);
