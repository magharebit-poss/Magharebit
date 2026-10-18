import type { FastifyInstance } from 'fastify';
import { sendDailyDigest, sendDigestToAllTenants } from '../../services/digest-service.js';
import { buildDigestData } from '../../services/digest-query.js';
import { formatDigest } from '../../services/digest-formatter.js';

const MANAGER_ROLES = ['MANAGER', 'SUPERVISOR'] as const;

export async function digestRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /digest/send ────────────────────────────────────────────────────
  // Manually trigger the daily digest for the authenticated tenant (or a
  // specific tenantId for SUPERVISOR). Rate-limited to prevent spam.
  fastify.post<{ Body: { tenantId?: string } }>(
    '/digest/send',
    { config: { allowedRoles: MANAGER_ROLES } },
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
  // Returns the formatted message body without sending it (UI preview).
  fastify.get<{ Querystring: { language?: string } }>(
    '/digest/preview',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenantId missing from token' });
      }

      const rawLang = request.query.language ?? 'ar';
      const language: 'ar' | 'fr' = rawLang === 'fr' ? 'fr' : 'ar';

      // Fetch tenant timezone
      const tenantRes = await fastify.pg.query<{ timezone: string }>(
        `SELECT timezone FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const timezone = tenantRes.rows[0]?.timezone ?? 'Africa/Casablanca';

      try {
        const data = await buildDigestData(fastify.pg, tenantId, timezone);
        const body = formatDigest(data, language);
        return reply.send({ body, data });
      } catch (err: unknown) {
        request.log.error({ err }, 'digest/preview: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
