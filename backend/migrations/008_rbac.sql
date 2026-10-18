-- Migration: 008_rbac
-- Creates: admin_users
-- Run order: must execute after 007

CREATE TABLE admin_users (
    admin_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role        VARCHAR(30) NOT NULL DEFAULT 'SUPER_ADMIN'
                CHECK (role IN ('SUPER_ADMIN', 'SUPPORT_AGENT')),
    totp_secret TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
