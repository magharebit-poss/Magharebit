import type { FastifyInstance } from 'fastify';
import {
  sendDailyDigest,
  sendDigestToAllTenants,
  toDigestLanguage,
  DIGEST_TICK_MINUTES,
} from '../../services/digest-service.js';
import { buildDigestData } from '../../services/digest-query.js';
import { formatDigest } from '../../services/digest-formatter.js';

// "Manager and above" for the manual-send, preview and settings routes.
const SETTINGS_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;

interface DigestSettingsRow {
  digest_enabled: boolean;
  whatsapp_phone: string | null;
  digest_language?: string;
  digest_time?: string;
  timezone?: string;
}

/** Digits only, country code included. Accepts +212…, 00212…, and local 06/07/05 numbers. */
function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (/^0[5-7]\d{8}$/.test(d)) d = `212${d.slice(1)}`; // Moroccan local format
  return /^\d{8,15}$/.test(d) ? d : null;
}

export async function digestRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /digest/send ────────────────────────────────────────────────────
  // Manually trigger the daily digest for the authenticated tenant (or a
  // specific tenantId for SUPERVISOR). Rate-limited to prevent spam.
  fastify.post<{ Body: { tenantId?: string } }>(
    '/digest/send',
    { config: { allowedRoles: SETTINGS_ROLES } },
    async (request, reply) => {
      const targetTenantId = request.body?.tenantId ?? request.tenantId;

      if (!targetTenantId) {
        return reply.status(400).send({ error: 'tenantId could not be resolved from token or body' });
      }

      try {
        const result = await sendDailyDigest(fastify.pg, targetTenantId);
        return reply.send(result);
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/send: unexpected error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /digest/send-all ────────────────────────────────────────────────
  // Trigger digest for all tenants with digest_enabled = true.
  // SUPERVISOR only — used by the cron and admin tooling.
  fastify.post(
    '/digest/send-all',
    { config: { allowedRoles: ['SUPERVISOR'] as const } },
    async (request, reply) => {
      try {
        const results = await sendDigestToAllTenants(fastify.pg);
        return reply.send(results);
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/send-all: unexpected error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /digest/preview ──────────────────────────────────────────────────
  // Returns the formatted message without sending it (UI preview).
  //   body   — exactly what WhatsApp would receive (compact, ~1500 chars max)
  //   detail — the full report, no length cap
  //   data   — the raw numbers
  fastify.get<{ Querystring: { language?: string } }>(
    '/digest/preview',
    { config: { allowedRoles: SETTINGS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenantId missing from token' });
      }

      // Fetch tenant timezone + configured language (used when ?language is absent)
      const tenantRes = await fastify.pg.query<{ timezone: string; digest_language: string | null }>(
        `SELECT timezone, digest_language FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const timezone = tenantRes.rows[0]?.timezone ?? 'Africa/Casablanca';
      const language = toDigestLanguage(request.query.language ?? tenantRes.rows[0]?.digest_language);

      try {
        const data = await buildDigestData(fastify.pg, tenantId, timezone);
        const body = formatDigest(data, language);
        const detail = formatDigest(data, language, { detail: true });
        return reply.send({ language, body, bodyLength: body.length, detail, data });
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/preview: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /digest/settings ─────────────────────────────────────────────────
  // The caller's own tenant only: the tenant id always comes from the verified
  // token, never from the request.
  fastify.get(
    '/digest/settings',
    { config: { allowedRoles: SETTINGS_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      try {
        const { rows } = await fastify.pg.query<DigestSettingsRow>(
          `SELECT digest_enabled, whatsapp_phone, digest_language, digest_time, timezone
           FROM tenants WHERE id = $1`,
          [tenantId],
        );
        if (!rows[0]) return reply.status(404).send({ error: 'Tenant not found' });
        return reply.send(rows[0]);
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/settings: read failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── PUT /digest/settings ─────────────────────────────────────────────────
  // Turn the digest on/off and set phone, language and send time. Every field is
  // optional; only the fields present are changed. MANAGER, SUPERVISOR, OWNER.
  fastify.put<{
    Body: {
      digest_enabled?: boolean;
      whatsapp_phone?: string | null;
      digest_language?: string;
      digest_time?: string;
    };
  }>(
    '/digest/settings',
    { config: { allowedRoles: SETTINGS_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });

      const body = request.body ?? {};
      const sets: string[] = [];
      const params: unknown[] = [tenantId];

      if (body.digest_enabled !== undefined) {
        if (typeof body.digest_enabled !== 'boolean') {
          return reply.status(400).send({ error: 'digest_enabled must be a boolean' });
        }
        params.push(body.digest_enabled);
        sets.push(`digest_enabled = $${params.length}`);
      }

      let newPhone: string | null | undefined;
      if (body.whatsapp_phone !== undefined) {
        if (body.whatsapp_phone === null || body.whatsapp_phone === '') {
          newPhone = null;
        } else if (typeof body.whatsapp_phone === 'string') {
          newPhone = normalizePhone(body.whatsapp_phone);
          if (!newPhone) {
            return reply.status(400).send({
              error: 'whatsapp_phone must be 8-15 digits with country code, e.g. 212612345678',
            });
          }
        } else {
          return reply.status(400).send({ error: 'whatsapp_phone must be a string or null' });
        }
        params.push(newPhone);
        sets.push(`whatsapp_phone = $${params.length}`);
      }

      if (body.digest_language !== undefined) {
        if (body.digest_language !== 'ar' && body.digest_language !== 'fr' && body.digest_language !== 'en') {
          return reply.status(400).send({ error: "digest_language must be 'ar', 'fr' or 'en'" });
        }
        params.push(body.digest_language);
        sets.push(`digest_language = $${params.length}`);
      }

      if (body.digest_time !== undefined) {
        const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(body.digest_time));
        if (!m || parseInt(m[2]!, 10) % DIGEST_TICK_MINUTES !== 0) {
          return reply.status(400).send({
            error: `digest_time must be HH:MM on a ${DIGEST_TICK_MINUTES}-minute step (e.g. 07:00, 07:15)`,
          });
        }
        params.push(body.digest_time);
        sets.push(`digest_time = $${params.length}`);
      }

      if (sets.length === 0) return reply.status(400).send({ error: 'nothing to update' });

      try {
        // A digest cannot be enabled without a destination number.
        const current = await fastify.pg.query<DigestSettingsRow>(
          `SELECT digest_enabled, whatsapp_phone FROM tenants WHERE id = $1`,
          [tenantId],
        );
        if (!current.rows[0]) return reply.status(404).send({ error: 'Tenant not found' });
        const willBeEnabled = body.digest_enabled ?? current.rows[0].digest_enabled;
        const willHavePhone = newPhone !== undefined ? newPhone : current.rows[0].whatsapp_phone;
        if (willBeEnabled && !willHavePhone) {
          return reply.status(400).send({ error: 'whatsapp_phone is required to enable the digest' });
        }

        const { rows } = await fastify.pg.query<DigestSettingsRow>(
          `UPDATE tenants SET ${sets.join(', ')}
           WHERE id = $1
           RETURNING digest_enabled, whatsapp_phone, digest_language, digest_time, timezone`,
          params,
        );
        return reply.send(rows[0]);
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/settings: update failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
