import type { FastifyInstance } from 'fastify';

const STAFF_ROLES = ['CASHIER', 'MANAGER', 'SUPERVISOR'] as const;

type KdsStatus = 'new' | 'preparing' | 'ready' | 'done';

// Forward-only transitions for the KDS status flow.
const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'done',
  done: null,
};

// Timestamp column set for each transition.
const STATUS_TIMESTAMP: Partial<Record<KdsStatus, string>> = {
  preparing: 'started_at',
  ready: 'ready_at',
  done: 'done_at',
};

interface KdsItem {
  nameAr: string;
  nameFr: string;
  quantity: number;
  notes?: string;
  category?: string;
}

export async function kdsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /kds/orders ────────────────────────────────────────────────────────
  // Returns active KDS orders (new, preparing, ready by default), oldest first.
  fastify.get<{
    Querystring: { storeId?: string; status?: string };
  }>(
    '/kds/orders',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { storeId, status } = request.query;
      const statuses: KdsStatus[] = status
        ? (status.split(',').filter((s) =>
            ['new', 'preparing', 'ready', 'done'].includes(s),
          ) as KdsStatus[])
        : ['new', 'preparing', 'ready'];

      const params: unknown[] = [tenantId, statuses];
      let storeClause = '';
      if (storeId) {
        params.push(storeId);
        storeClause = `AND store_id = $${params.length}`;
      }

      try {
        const { rows } = await fastify.pg.query(
          `SELECT kds_id, tenant_id, store_id, source,
                  whatsapp_order_id, transaction_id,
                  items_json, customer_name, customer_phone, order_notes,
                  kds_status, received_at, started_at, ready_at, done_at,
                  fulfillment_type, table_number, created_at, updated_at
           FROM kds_orders
           WHERE tenant_id = $1
             AND kds_status = ANY($2::text[])
             ${storeClause}
           ORDER BY received_at ASC
           LIMIT 50`,
          params,
        );
        return reply.send(rows);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[kds] list failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /kds/orders/:kdsId ─────────────────────────────────────────────────
  fastify.get<{ Params: { kdsId: string } }>(
    '/kds/orders/:kdsId',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { kdsId } = request.params;

      try {
        const { rows } = await fastify.pg.query(
          `SELECT * FROM kds_orders
           WHERE kds_id = $1 AND tenant_id = $2`,
          [kdsId, tenantId],
        );
        if (rows.length === 0) return reply.status(404).send({ error: 'KDS order not found' });
        return reply.send(rows[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[kds] get failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── PATCH /kds/orders/:kdsId/status ───────────────────────────────────────
  // Forward-only: new → preparing → ready → done.
  fastify.patch<{
    Params: { kdsId: string };
    Body: { status: KdsStatus };
  }>(
    '/kds/orders/:kdsId/status',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { kdsId } = request.params;
      const { status: newStatus } = request.body ?? {};

      if (!newStatus || !['new', 'preparing', 'ready', 'done'].includes(newStatus)) {
        return reply.status(400).send({ error: 'status must be one of: new, preparing, ready, done' });
      }

      try {
        const { rows: current } = await fastify.pg.query<{ kds_status: KdsStatus; tenant_id: string }>(
          `SELECT kds_status, tenant_id FROM kds_orders WHERE kds_id = $1`,
          [kdsId],
        );
        if (current.length === 0 || current[0]!.tenant_id !== tenantId) {
          return reply.status(404).send({ error: 'KDS order not found' });
        }

        const currentStatus = current[0]!.kds_status;
        const expectedNext = STATUS_NEXT[currentStatus];
        if (newStatus !== expectedNext) {
          return reply.status(422).send({
            error: 'Invalid status transition',
            from: currentStatus,
            to: newStatus,
            expected: expectedNext,
          });
        }

        const tsCol = STATUS_TIMESTAMP[newStatus];
        const tsClause = tsCol ? `, ${tsCol} = NOW()` : '';

        const { rows: updated } = await fastify.pg.query(
          `UPDATE kds_orders
           SET kds_status = $1, updated_at = NOW()${tsClause}
           WHERE kds_id = $2 AND tenant_id = $3
           RETURNING *`,
          [newStatus, kdsId, tenantId],
        );
        return reply.send(updated[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[kds] status update failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /kds/orders ──────────────────────────────────────────────────────
  // Create a KDS order from a walk-in POS session.
  fastify.post<{
    Body: {
      source: 'walkin';
      items: KdsItem[];
      customerName?: string;
      orderNotes?: string;
      fulfillmentType?: 'table' | 'takeaway' | 'pickup';
      tableNumber?: string;
      storeId?: string;
    };
  }>(
    '/kds/orders',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { source, items, customerName, orderNotes, fulfillmentType, tableNumber, storeId } =
        request.body ?? {};

      if (source !== 'walkin') {
        return reply.status(400).send({ error: 'source must be walkin for this endpoint' });
      }
      if (!items || items.length === 0) {
        return reply.status(400).send({ error: 'items is required and must not be empty' });
      }

      try {
        const { rows } = await fastify.pg.query(
          `INSERT INTO kds_orders
             (tenant_id, store_id, source, items_json, customer_name, order_notes,
              fulfillment_type, table_number)
           VALUES ($1, $2, 'walkin', $3::jsonb, $4, $5, $6, $7)
           RETURNING *`,
          [
            tenantId,
            storeId ?? null,
            JSON.stringify(items),
            customerName ?? null,
            orderNotes ?? null,
            fulfillmentType ?? null,
            tableNumber ?? null,
          ],
        );
        return reply.status(201).send(rows[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[kds] create walkin failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /kds/orders/from-whatsapp/:whatsappOrderId ───────────────────────
  // Idempotent: if a KDS order already exists for this WhatsApp order, return it.
  fastify.post<{ Params: { whatsappOrderId: string } }>(
    '/kds/orders/from-whatsapp/:whatsappOrderId',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { whatsappOrderId } = request.params;

      try {
        // Idempotency: return existing KDS order if one exists.
        const { rows: existing } = await fastify.pg.query(
          `SELECT * FROM kds_orders
           WHERE whatsapp_order_id = $1 AND tenant_id = $2
           LIMIT 1`,
          [whatsappOrderId, tenantId],
        );
        if (existing.length > 0) {
          return reply.status(200).send({ ...existing[0], already_exists: true });
        }

        // Fetch the WhatsApp order to copy fields.
        const { rows: waRows } = await fastify.pg.query(
          `SELECT * FROM whatsapp_orders WHERE order_id = $1 AND tenant_id = $2`,
          [whatsappOrderId, tenantId],
        );
        if (waRows.length === 0) {
          return reply.status(404).send({ error: 'WhatsApp order not found' });
        }
        const wa = waRows[0] as {
          order_id: string;
          tenant_id: string;
          store_id: string | null;
          customer_name: string | null;
          customer_phone: string;
          raw_message: string;
          fulfillment_type: string;
          notes: string | null;
        };

        // Build items from the raw_message (one item representing the order text).
        const items = [
          {
            nameAr: wa.raw_message,
            nameFr: wa.raw_message,
            quantity: 1,
            notes: undefined,
            category: 'whatsapp',
          },
        ];

        const ftMap: Record<string, string> = {
          pickup: 'pickup',
          delivery: 'delivery',
        };
        const fulfillmentType = ftMap[wa.fulfillment_type] ?? 'pickup';

        const { rows: created } = await fastify.pg.query(
          `INSERT INTO kds_orders
             (tenant_id, store_id, source, whatsapp_order_id,
              items_json, customer_name, customer_phone, order_notes,
              fulfillment_type)
           VALUES ($1, $2, 'whatsapp', $3, $4::jsonb, $5, $6, $7, $8)
           RETURNING *`,
          [
            tenantId,
            wa.store_id,
            whatsappOrderId,
            JSON.stringify(items),
            wa.customer_name,
            wa.customer_phone,
            wa.notes,
            fulfillmentType,
          ],
        );
        return reply.status(201).send(created[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[kds] create from-whatsapp failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
