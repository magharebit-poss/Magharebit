-- Migration 049: per-tenant integration credentials   *** DRAFT: NOT APPLIED ***
-- Review before applying. Apply with: npx tsx scripts/migrate-049.ts (from backend).
-- Depends on: 007 (tenants), 008 (staff)
--
-- Secrets are stored ENCRYPTED (AES-256-GCM, see src/services/credentials-crypto.ts).
-- There are deliberately NO plaintext columns for secrets. Each *_enc value is
-- [1 byte format version][12 byte IV][16 byte auth tag][ciphertext], and the
-- ciphertext is bound to (tenant_id, field) as authenticated data, so a value
-- copied into another tenant's row, or another column, fails to decrypt.
--
-- green_instance_id is an identifier, not a secret, but it is only ever used
-- together with green_token and is never returned by any API.
--
-- Unset (NULL) credentials fall back to the shared environment ones
-- (ANTHROPIC_API_KEY, GREENAPI_INSTANCE_ID / GREENAPI_API_TOKEN).

CREATE TABLE IF NOT EXISTS tenant_integrations (
  tenant_id         UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  ai_provider       TEXT NOT NULL DEFAULT 'anthropic'
                      CONSTRAINT tenant_integrations_ai_provider_check CHECK (ai_provider IN ('anthropic')),
  ai_key_enc        BYTEA,
  green_instance_id TEXT,
  green_token_enc   BYTEA,
  -- Encryption key generation that produced the *_enc values (for future rotation).
  key_version       INTEGER NOT NULL DEFAULT 1 CHECK (key_version >= 1),
  updated_by        UUID REFERENCES staff(staff_id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
