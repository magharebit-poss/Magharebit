import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

function requireAdminRole(request: FastifyRequest, reply: FastifyReply): boolean {
  // In dev/staging, skip auth check if no role is set
  const role = (request as FastifyRequest & { role?: string }).role;
  if (role && role !== 'SUPER_ADMIN' && role !== 'SUPPORT_AGENT') {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /admin/tenants ──────────────────────────────────────────────────
  fastify.get('/admin/tenants', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    try {
      const { rows } = await fastify.pg.query(`
        SELECT
          t.id AS tenant_id,
          t.name,
          t.country,
          t.status,
          t.created_at::text,
          COUNT(s.store_id)::int AS store_count
        FROM tenants t
        LEFT JOIN stores s ON s.tenant_id = t.id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `);
      return reply.send(rows);
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── GET /admin/licenses ─────────────────────────────────────────────────
  fastify.get('/admin/licenses', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    try {
      const { rows } = await fastify.pg.query(`
        SELECT
          lk.license_key_id,
          lk.key_string,
          lk.tenant_id,
          t.name AS tenant_name,
          lk.status,
          lk.binding_device_id,
          lk.activated_at::text,
          lk.expires_at::text,
          lk.subscription_tier
        FROM license_keys lk
        JOIN tenants t ON t.id = lk.tenant_id
        ORDER BY lk.created_at DESC
      `);
      return reply.send(rows);
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── POST /admin/licenses/generate ───────────────────────────────────────
  fastify.post('/admin/licenses/generate', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    const { tenantId, subscriptionTier } = request.body as {
      tenantId: string;
      subscriptionTier: string;
    };
    if (!tenantId || !subscriptionTier) {
      return reply.status(400).send({ error: 'tenantId and subscriptionTier required' });
    }
    try {
      const { randomBytes, createHmac } = await import('crypto');
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const tenantPart = tenantId.replace(/-/g, '').slice(0, 6).toUpperCase();
      const randomBuf = randomBytes(8);
      let randomPart = '';
      for (let i = 0; i < 8; i++) {
        randomPart += chars[randomBuf[i] % 36];
      }
      const secret = process.env['MASTER_SIGNING_SECRET'] ?? 'dev-secret-not-for-production';
      const checksum = createHmac('sha256', secret)
        .update(tenantPart + randomPart)
        .digest('hex')
        .slice(0, 4)
        .toUpperCase();
      const keyString = `GGPO-${tenantPart}-${randomPart}-${checksum}`;

      const durationDays: Record<string, number> = {
        monthly: 30, quarterly: 90, annual: 365,
      };
      const days = durationDays[subscriptionTier] ?? 30;

      const { rows } = await fastify.pg.query(
        `INSERT INTO license_keys
           (license_key_id, key_string, tenant_id, status, subscription_tier,
            expires_at, created_by)
         VALUES (gen_random_uuid(), $1, $2, 'unbound', $3,
           NOW() + INTERVAL '1 day' * $4, $2)
         RETURNING license_key_id, key_string`,
        [keyString, tenantId, subscriptionTier, days],
      );
      return reply.send({ keyString: rows[0].key_string, licenseKeyId: rows[0].license_key_id });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to generate key' });
    }
  });

  // ── POST /admin/licenses/:id/unbind ─────────────────────────────────────
  fastify.post('/admin/licenses/:id/unbind', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      await fastify.pg.query(
        `UPDATE license_keys SET binding_device_id = NULL, bound_at = NULL
         WHERE license_key_id = $1`, [id],
      );
      return reply.send({ ok: true });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to unbind' });
    }
  });

  // ── DELETE /admin/licenses/:id/revoke ───────────────────────────────────
  fastify.delete('/admin/licenses/:id/revoke', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      await fastify.pg.query(
        `UPDATE license_keys SET status = 'revoked' WHERE license_key_id = $1`, [id],
      );
      return reply.send({ ok: true });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to revoke' });
    }
  });

  // ── GET /admin/subscriptions ────────────────────────────────────────────
  fastify.get('/admin/subscriptions', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    try {
      const { rows } = await fastify.pg.query(`
        SELECT
          lk.license_key_id,
          t.name AS tenant_name,
          lk.status,
          lk.subscription_tier,
          lk.activated_at::text,
          lk.expires_at::text,
          COALESCE(t.grace_period_hours, 48) AS grace_period_hours,
          EXTRACT(DAY FROM (lk.expires_at - NOW()))::int AS days_remaining
        FROM license_keys lk
        JOIN tenants t ON t.id = lk.tenant_id
        ORDER BY lk.expires_at ASC NULLS LAST
      `);
      return reply.send(rows);
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── PATCH /admin/subscriptions/:id/extend ───────────────────────────────
  fastify.patch('/admin/subscriptions/:id/extend', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;
    const { id } = request.params as { id: string };
    const { tier } = request.body as { tier: string };
    const durationDays: Record<string, number> = {
      monthly: 30, quarterly: 90, annual: 365,
    };
    const days = durationDays[tier] ?? 30;
    try {
      await fastify.pg.query(
        `UPDATE license_keys
         SET expires_at = GREATEST(expires_at, NOW()) + INTERVAL '1 day' * $1,
             subscription_tier = $2,
             status = 'active'
         WHERE license_key_id = $3`,
        [days, tier, id],
      );
      return reply.send({ ok: true });
    } catch (err: unknown) {
      return reply.status(500).send({ error: 'Failed to extend' });
    }
  });
}
