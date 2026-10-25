/**
 * Per-tenant integration credentials (AI key, Green API instance + token).
 *
 * Every function takes the tenantId explicitly and only ever reads or writes that
 * tenant's row; there is no cache, so one tenant's credentials can never be used
 * for another tenant. Secrets are encrypted at rest (credentials-crypto.ts) and
 * are returned only by the two load* functions, which exist for the code that
 * actually calls the provider. Nothing here logs a secret.
 */
import type { Pool } from 'pg';
import { decryptSecret, encryptSecret } from './credentials-crypto.js';

export interface IntegrationStatus {
  whatsapp_phone: string | null;
  digest_enabled: boolean;
  ai_configured: boolean;
  green_configured: boolean;
  updated_at: string | null;
}

/** Fields present = change; empty string = clear; field omitted = leave unchanged. */
export interface IntegrationInput {
  ai_key?: string;
  green_instance_id?: string;
  green_token?: string;
}

export async function getIntegrationStatus(pg: Pool, tenantId: string): Promise<IntegrationStatus | null> {
  const { rows } = await pg.query<IntegrationStatus>(
    `SELECT t.whatsapp_phone,
            t.digest_enabled,
            (i.ai_key_enc IS NOT NULL) AS ai_configured,
            (i.green_instance_id IS NOT NULL AND i.green_token_enc IS NOT NULL) AS green_configured,
            i.updated_at
     FROM tenants t
     LEFT JOIN tenant_integrations i ON i.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    whatsapp_phone: row.whatsapp_phone,
    digest_enabled: row.digest_enabled,
    ai_configured: row.ai_configured === true,
    green_configured: row.green_configured === true,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/** True when saving this input needs the encryption key (i.e. it sets, not only clears). */
export function inputNeedsEncryption(input: IntegrationInput): boolean {
  return Boolean(input.ai_key) || Boolean(input.green_token);
}

export async function saveIntegrations(
  pg: Pool,
  tenantId: string,
  staffId: string | undefined,
  input: IntegrationInput,
): Promise<void> {
  const aiProvided = input.ai_key !== undefined;
  const idProvided = input.green_instance_id !== undefined;
  const tokenProvided = input.green_token !== undefined;

  const aiEnc = aiProvided && input.ai_key ? encryptSecret(input.ai_key, tenantId, 'ai_key') : null;
  const tokenEnc = tokenProvided && input.green_token
    ? encryptSecret(input.green_token, tenantId, 'green_token') : null;
  const instanceId = idProvided && input.green_instance_id ? input.green_instance_id : null;

  await pg.query(
    `INSERT INTO tenant_integrations
       (tenant_id, ai_key_enc, green_instance_id, green_token_enc, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       ai_key_enc        = CASE WHEN $6 THEN EXCLUDED.ai_key_enc        ELSE tenant_integrations.ai_key_enc        END,
       green_instance_id = CASE WHEN $7 THEN EXCLUDED.green_instance_id ELSE tenant_integrations.green_instance_id END,
       green_token_enc   = CASE WHEN $8 THEN EXCLUDED.green_token_enc   ELSE tenant_integrations.green_token_enc   END,
       updated_by        = EXCLUDED.updated_by,
       updated_at        = now()`,
    [tenantId, aiEnc, instanceId, tokenEnc, staffId ?? null, aiProvided, idProvided, tokenProvided],
  );
}

/** The tenant's own AI key, or null when unset (callers then use the shared environment key). */
export async function loadTenantAiKey(pg: Pool, tenantId: string): Promise<string | null> {
  const { rows } = await pg.query<{ ai_key_enc: Buffer | null }>(
    `SELECT ai_key_enc FROM tenant_integrations WHERE tenant_id = $1`,
    [tenantId],
  );
  const enc = rows[0]?.ai_key_enc;
  return enc ? decryptSecret(enc, tenantId, 'ai_key') : null;
}

/** The tenant's own Green API credentials; null unless BOTH instance id and token are set. */
export async function loadTenantGreenCreds(
  pg: Pool,
  tenantId: string,
): Promise<{ instanceId: string; apiToken: string } | null> {
  const { rows } = await pg.query<{ green_instance_id: string | null; green_token_enc: Buffer | null }>(
    `SELECT green_instance_id, green_token_enc FROM tenant_integrations WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = rows[0];
  if (!row?.green_instance_id || !row.green_token_enc) return null;
  return {
    instanceId: row.green_instance_id,
    apiToken: decryptSecret(row.green_token_enc, tenantId, 'green_token'),
  };
}
