import type { FastifyInstance } from 'fastify';

const MGMT_ROLES = ['MANAGER', 'SUPERVISOR'] as const;

const VALID_BUSINESS_TYPES = new Set([
  'grocery', 'cafe', 'restaurant', 'bakery', 'clothing', 'auto_parts',
]);

export async function tenantRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /tenant/profile ─────────────────────────────────────────────────────
  fastify.get(
    '/tenant/profile',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      try {
        const { rows } = await fastify.pg.query<{
          id: string;
          name: string;
          slug: string;
          status: string;
          country: string;
          business_type: string | null;
        }>(
          `SELECT id, name, slug, status, country, business_type
           FROM tenants
           WHERE id = $1`,
          [tenantId],
        );
        if (rows.length === 0) return reply.status(404).send({ error: 'Tenant not found' });
        return reply.send(rows[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[tenant] profile get failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── PATCH /tenant/business-type ──────────────────────────────────────────────
  fastify.patch<{ Body: { businessType: string } }>(
    '/tenant/business-type',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { businessType } = request.body ?? {};
      if (!businessType || !VALID_BUSINESS_TYPES.has(businessType)) {
        return reply.status(400).send({
          error: `businessType must be one of: ${[...VALID_BUSINESS_TYPES].join(', ')}`,
        });
      }

      try {
        await fastify.pg.query(
          `UPDATE tenants SET business_type = $1 WHERE id = $2`,
          [businessType, tenantId],
        );
        return reply.send({ businessType });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[tenant] business-type update failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
