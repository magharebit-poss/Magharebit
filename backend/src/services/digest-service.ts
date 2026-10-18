import type { Pool } from 'pg';
import { buildDigestData } from './digest-query.js';
import { formatDigest } from './digest-formatter.js';
import { getWhatsAppProvider } from './whatsapp/provider-factory.js';

export interface DigestSendResult {
  tenantId: string;
  sent: boolean;
  skipped: boolean;
  skipReason?: string;
  error?: string;
  messageId?: string;
}

interface TenantDigestConfig {
  id: string;
  whatsapp_phone: string | null;
  digest_enabled: boolean;
  digest_language: string;
  timezone: string;
}

export async function sendDailyDigest(
  pg: Pool,
  tenantId: string,
): Promise<DigestSendResult> {
  const tenantRes = await pg.query<TenantDigestConfig>(
    `SELECT id, whatsapp_phone, digest_enabled, digest_language, timezone
     FROM tenants
     WHERE id = $1`,
    [tenantId],
  );

  if (tenantRes.rows.length === 0) {
    return { tenantId, sent: false, skipped: true, skipReason: 'tenant_not_found' };
  }

  const tenant = tenantRes.rows[0]!;

  if (!tenant.digest_enabled) {
    return { tenantId, sent: false, skipped: true, skipReason: 'digest_disabled' };
  }

  if (!tenant.whatsapp_phone) {
    return { tenantId, sent: false, skipped: true, skipReason: 'no_phone_configured' };
  }

  const timezone = tenant.timezone ?? 'Africa/Casablanca';
  const language = (tenant.digest_language ?? 'ar') as 'ar' | 'fr';
  const phone = tenant.whatsapp_phone;
  const maskedPhone = `****${phone.slice(-4)}`;

  try {
    const data = await buildDigestData(pg, tenantId, timezone);
    const body = formatDigest(data, language);

    const provider = getWhatsAppProvider();
    const result = await provider.send({ to: phone, body });

    if (result.success) {
      console.info(
        `[digest] Sent via ${provider.name} to ${maskedPhone} (tenant ${tenantId}, date ${data.date})`,
      );
      return { tenantId, sent: true, skipped: false, messageId: result.messageId };
    } else {
      console.warn(
        `[digest] Send failed via ${provider.name} to ${maskedPhone} (tenant ${tenantId}): ${result.error}`,
      );
      return { tenantId, sent: false, skipped: false, error: result.error };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn(`[digest] Error for tenant ${tenantId}: ${msg}`);
    return { tenantId, sent: false, skipped: false, error: msg };
  }
}

export async function sendDigestToAllTenants(pg: Pool): Promise<DigestSendResult[]> {
  const res = await pg.query<{ id: string }>(
    `SELECT id FROM tenants WHERE digest_enabled = true`,
  );

  const results: DigestSendResult[] = [];
  for (const row of res.rows) {
    try {
      const result = await sendDailyDigest(pg, row.id);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      results.push({ tenantId: row.id, sent: false, skipped: false, error: msg });
    }
  }
  return results;
}
