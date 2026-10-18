import type { FastifyInstance } from 'fastify';
import { computeMarkdowns } from '../../services/markdown-engine.js';

export async function markdownRoutes(fastify: FastifyInstance): Promise<void> {
  const MANAGER_ROLES = ['MANAGER', 'SUPERVISOR'] as const;
  const STAFF_ROLES = ['CASHIER', 'MANAGER', 'SUPERVISOR'] as const;

  // ── POST /markdown/compute — run engine for the caller's tenant ───────────
  fastify.post('/markdown/compute', { config: { allowedRoles: MANAGER_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    try {
      const result = await computeMarkdowns(fastify.pg, tenantId);
      return reply.send(result);
    } catch (err: unknown) {
      fastify.log.error({ err }, '[markdown] compute failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── GET /markdown/rules — list rules for a product ────────────────────────
  fastify.get<{ Querystring: { productId?: string } }>(
    '/markdown/rules',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { productId } = request.query;
      try {
        const q = productId
          ? `SELECT rule_id, product_id, days_after_receipt, discount_percent, created_at
             FROM markdown_rules
             WHERE tenant_id = $1 AND product_id = $2
             ORDER BY days_after_receipt`
          : `SELECT rule_id, product_id, days_after_receipt, discount_percent, created_at
             FROM markdown_rules
             WHERE tenant_id = $1
             ORDER BY product_id, days_after_receipt`;
        const params = productId ? [tenantId, productId] : [tenantId];
        const { rows } = await fastify.pg.query(q, params);
        return reply.send(rows);
      } catch (err: unknown) {
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /markdown/rules — create a rule ──────────────────────────────────
  fastify.post<{
    Body: { productId: string; daysAfterReceipt: number; discountPercent: number };
  }>(
    '/markdown/rules',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { productId, daysAfterReceipt, discountPercent } = request.body ?? {};
      if (!productId || !daysAfterReceipt || !discountPercent) {
        return reply.status(400).send({ error: 'productId, daysAfterReceipt, discountPercent are required' });
      }
      if (discountPercent <= 0 || discountPercent >= 100) {
        return reply.status(400).send({ error: 'discountPercent must be 1–99' });
      }
      if (daysAfterReceipt <= 0) {
        return reply.status(400).send({ error: 'daysAfterReceipt must be > 0' });
      }
      try {
        const { rows } = await fastify.pg.query(
          `INSERT INTO markdown_rules (tenant_id, product_id, days_after_receipt, discount_percent)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, product_id, days_after_receipt)
             DO UPDATE SET discount_percent = EXCLUDED.discount_percent
           RETURNING rule_id, product_id, days_after_receipt, discount_percent, created_at`,
          [tenantId, productId, daysAfterReceipt, discountPercent],
        );
        return reply.status(201).send(rows[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[markdown] insert rule failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── DELETE /markdown/rules/:ruleId ────────────────────────────────────────
  fastify.delete<{ Params: { ruleId: string } }>(
    '/markdown/rules/:ruleId',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { ruleId } = request.params;
      try {
        const { rowCount } = await fastify.pg.query(
          `DELETE FROM markdown_rules WHERE rule_id = $1 AND tenant_id = $2`,
          [ruleId, tenantId],
        );
        if (!rowCount) return reply.status(404).send({ error: 'Rule not found' });
        return reply.status(204).send();
      } catch (err: unknown) {
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /markdown/lots — list active lots for a product ───────────────────
  fastify.get<{ Querystring: { productId?: string } }>(
    '/markdown/lots',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { productId } = request.query;
      try {
        const q = productId
          ? `SELECT lot_id, product_id, received_at, quantity_received, notes, is_active, created_at
             FROM product_lots
             WHERE tenant_id = $1 AND product_id = $2 AND is_active = true
             ORDER BY received_at DESC`
          : `SELECT lot_id, product_id, received_at, quantity_received, notes, is_active, created_at
             FROM product_lots
             WHERE tenant_id = $1 AND is_active = true
             ORDER BY product_id, received_at DESC`;
        const params = productId ? [tenantId, productId] : [tenantId];
        const { rows } = await fastify.pg.query(q, params);
        return reply.send(rows);
      } catch (err: unknown) {
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /markdown/lots — receive a new lot ───────────────────────────────
  fastify.post<{
    Body: { productId: string; receivedAt?: string; quantityReceived: number; notes?: string };
  }>(
    '/markdown/lots',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { productId, receivedAt, quantityReceived, notes } = request.body ?? {};

      if (!productId || !quantityReceived) {
        return reply.status(400).send({ error: 'productId and quantityReceived are required' });
      }
      if (quantityReceived <= 0) {
        return reply.status(400).send({ error: 'quantityReceived must be > 0' });
      }

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `UPDATE product_lots
           SET is_active = false
           WHERE product_id = $1 AND tenant_id = $2
             AND is_active = true`,
          [productId, tenantId],
        );

        const { rows } = await client.query(
          `INSERT INTO product_lots (tenant_id, product_id, received_at, quantity_received, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING lot_id, product_id, received_at, quantity_received, notes, is_active, created_at`,
          [tenantId, productId, receivedAt ?? new Date().toISOString(), quantityReceived, notes ?? null],
        );

        await client.query('COMMIT');
        return reply.status(201).send(rows[0]);
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        fastify.log.error({ err }, '[markdown] insert lot failed');
        return reply.status(500).send({ error: 'Internal error' });
      } finally {
        client.release();
      }
    },
  );
}