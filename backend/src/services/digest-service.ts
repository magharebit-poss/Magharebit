import type { Pool } from 'pg';
import { buildDigestData } from './digest-query.js';
import { formatDigest, type DigestLanguage } from './digest-formatter.js';
import { getWhatsAppProvider } from './whatsapp/provider-factory.js';
import { loadTenantGreenCreds } from './integrations.js';

/** The scheduler ticks every DIGEST_TICK_MINUTES; digest_time is floored to a tick. */
export const DIGEST_TICK_MINUTES = 15;

export function toDigestLanguage(raw: string | null | undefined): DigestLanguage {
  return raw === 'fr' || raw === 'en' ? raw : 'ar';
}

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
  const language = toDigestLanguage(tenant.digest_language);
  const phone = tenant.whatsapp_phone;
  const maskedPhone = `****${phone.slice(-4)}`;

  try {
    const data = await buildDigestData(pg, tenantId, timezone);
    const body = formatDigest(data, language);

    // The tenant's own Green API account when configured, else the shared one.
    // If its stored credentials cannot be decrypted we stop: falling back to the
    // shared account would send this merchant's data through someone else's number.
    let tenantCreds: Awaited<ReturnType<typeof loadTenantGreenCreds>>;
    try {
      tenantCreds = await loadTenantGreenCreds(pg, tenantId);
    } catch {
      console.warn(`[digest] tenant ${tenantId}: stored Green API credentials unreadable, skipping send`);
      return { tenantId, sent: false, skipped: false, error: 'tenant credentials unreadable' };
    }
    const provider = getWhatsAppProvider(tenantCreds ?? undefined);
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

// ── Per-tenant send time ───────────────────────────────────────────────────────
// The cron ticks every DIGEST_TICK_MINUTES. A tenant is "due" when its local clock
// is inside the tick that contains its digest_time. `lastSentLocalDate` guards
// against a double send within one process; it is in memory (no migration), so a
// restart inside the same tick could resend once.
const lastSentLocalDate = new Map<string, string>();

function localClock(now: Date, timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = parseInt(get('hour'), 10) % 24;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + parseInt(get('minute'), 10) };
}

function tickStart(minutesOfDay: number): number {
  return Math.floor(minutesOfDay / DIGEST_TICK_MINUTES) * DIGEST_TICK_MINUTES;
}

function parseDigestTime(value: string | null): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!m) return 7 * 60; // default 07:00
  const mins = parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
  return mins >= 0 && mins < 24 * 60 ? mins : 7 * 60;
}

/** Send the digest to every enabled tenant whose send time falls in the current tick. */
export async function sendDigestsDue(pg: Pool, now: Date = new Date()): Promise<DigestSendResult[]> {
  const res = await pg.query<{ id: string; digest_time: string | null; timezone: string | null }>(
    `SELECT id, digest_time, timezone
     FROM tenants
     WHERE digest_enabled = true AND whatsapp_phone IS NOT NULL`,
  );

  const results: DigestSendResult[] = [];
  for (const row of res.rows) {
    let clock: { date: string; minutes: number };
    try {
      clock = localClock(now, row.timezone ?? 'Africa/Casablanca');
    } catch {
      results.push({ tenantId: row.id, sent: false, skipped: true, skipReason: 'invalid_timezone' });
      continue;
    }
    if (tickStart(clock.minutes) !== tickStart(parseDigestTime(row.digest_time))) continue;
    if (lastSentLocalDate.get(row.id) === clock.date) continue;
    lastSentLocalDate.set(row.id, clock.date);

    try {
      results.push(await sendDailyDigest(pg, row.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      results.push({ tenantId: row.id, sent: false, skipped: false, error: msg });
    }
  }
  return results;
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
