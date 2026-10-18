import type { FastifyInstance } from 'fastify';

type OrderStatus =
  | 'new'
  | 'reviewing'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

// Valid forward transitions. 'cancelled' is reachable from any non-terminal status.
const STATUS_ORDER: OrderStatus[] = [
  'new', 'reviewing', 'confirmed', 'preparing', 'ready', 'completed',
];

function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelled') {
    // Can cancel from any non-terminal status
    return from !== 'completed' && from !== 'cancelled';
  }
  const fromIdx = STATUS_ORDER.indexOf(from);
  const toIdx   = STATUS_ORDER.indexOf(to);
  // Only forward transitions, no skipping more than one step
  return fromIdx >= 0 && toIdx > fromIdx;
}

const STAFF_ROLES = ['CASHIER', 'MANAGER', 'SUPERVISOR'] as const;

// Active statuses shown by default in the queue
const ACTIVE_STATUSES = ['new', 'reviewing', 'confirmed', 'preparing', 'ready'];

export async function orderRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /orders — active queue for tenant ───────────────────────────────
  fastify.get<{ Querystring: { status?: string; limit?: string } }>(
    '/orders',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const limit  = Math.min(parseInt(request.query.limit ?? '50', 10), 200);
      const status = request.query.status;

      let rows;
      if (status) {
        ({ rows } = await fastify.pg.query(
          `SELECT
             o.order_id, o.customer_phone, o.customer_name, o.raw_message,
             o.status, o.fulfillment_type, o.payment_method, o.payment_received,
             o.scheduled_at, o.store_id, o.customer_id, o.transaction_id,
             o.assigned_to, o.notes, o.received_at, o.updated_at,
             s.name_ar AS store_name_ar, s.name_fr AS store_name_fr
           FROM whatsapp_orders o
           LEFT JOIN stores s ON s.store_id = o.store_id
           WHERE o.tenant_id = $1 AND o.status = $2
           ORDER BY o.received_at DESC
           LIMIT $3`,
          [tenantId, status, limit],
        ));
      } else {
        ({ rows } = await fastify.pg.query(
          `SELECT
             o.order_id, o.customer_phone, o.customer_name, o.raw_message,
             o.status, o.fulfillment_type, o.payment_method, o.payment_received,
             o.scheduled_at, o.store_id, o.customer_id, o.transaction_id,
             o.assigned_to, o.notes, o.received_at, o.updated_at,
             s.name_ar AS store_name_ar, s.name_fr AS store_name_fr
           FROM whatsapp_orders o
           LEFT JOIN stores s ON s.store_id = o.store_id
           WHERE o.tenant_id = $1 AND o.status = ANY($2::text[])
           ORDER BY o.received_at DESC
           LIMIT $3`,
          [tenantId, ACTIVE_STATUSES, limit],
        ));
      }

      return reply.send({ orders: rows });
    },
  );

  // ── GET /orders/:orderId — single order detail ──────────────────────────
  fastify.get<{ Params: { orderId: string } }>(
    '/orders/:orderId',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { orderId } = request.params;

      const { rows } = await fastify.pg.query(
        `SELECT
           o.*,
           s.name_ar AS store_name_ar, s.name_fr AS store_name_fr,
           st.name_ar AS assignee_name_ar, st.name_fr AS assignee_name_fr
         FROM whatsapp_orders o
         LEFT JOIN stores s  ON s.store_id   = o.store_id
         LEFT JOIN staff  st ON st.staff_id  = o.assigned_to
         WHERE o.order_id = $1 AND o.tenant_id = $2`,
        [orderId, tenantId],
      );

      if (rows.length === 0) return reply.status(404).send({ error: 'Order not found' });
      return reply.send(rows[0]);
    },
  );

  // ── PATCH /orders/:orderId — update order fields ─────────────────────────
  fastify.patch<{
    Params: { orderId: string };
    Body: {
      status?: OrderStatus;
      fulfillment_type?: 'pickup' | 'delivery';
      delivery_address?: string;
      delivery_notes?: string;
      scheduled_at?: string;
      payment_method?: 'cash_on_delivery' | 'virement' | 'tpe';
      payment_received?: boolean;
      assigned_to?: string;
      notes?: string;
    };
  }>(
    '/orders/:orderId',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { orderId } = request.params;

      // Fetch current record — need current status for transition validation
      const { rows: current } = await fastify.pg.query<{
        status: OrderStatus;
        tenant_id: string;
      }>(
        `SELECT status, tenant_id FROM whatsapp_orders WHERE order_id = $1`,
        [orderId],
      );
      if (current.length === 0 || current[0]!.tenant_id !== tenantId) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      const currentStatus = current[0]!.status;

      // Validate status transition
      const newStatus = request.body.status;
      if (newStatus && newStatus !== currentStatus) {
        if (!isValidTransition(currentStatus, newStatus)) {
          return reply.status(422).send({
            error: 'Invalid status transition',
            from: currentStatus,
            to: newStatus,
          });
        }
      }

      // Build SET clauses from only the fields provided
      const setClauses: string[] = ['updated_at = NOW()'];
      const values: unknown[] = [orderId, tenantId];
      let paramIdx = 3;

      const body = request.body;
      const fieldMap: Record<string, unknown> = {
        status:           body.status,
        fulfillment_type: body.fulfillment_type,
        delivery_address: body.delivery_address,
        delivery_notes:   body.delivery_notes,
        scheduled_at:     body.scheduled_at,
        payment_method:   body.payment_method,
        payment_received: body.payment_received,
        assigned_to:      body.assigned_to,
        notes:            body.notes,
      };

      for (const [col, val] of Object.entries(fieldMap)) {
        if (val !== undefined) {
          setClauses.push(`${col} = $${paramIdx}`);
          values.push(val);
          paramIdx++;
        }
      }

      if (setClauses.length === 1) {
        // Only updated_at — nothing to actually update
        return reply.status(400).send({ error: 'No fields to update' });
      }

      const { rows: updated } = await fastify.pg.query(
        `UPDATE whatsapp_orders
         SET ${setClauses.join(', ')}
         WHERE order_id = $1 AND tenant_id = $2
         RETURNING *`,
        values,
      );

      return reply.send(updated[0]);
    },
  );

  // ── POST /orders/:orderId/convert — link to POS transaction ─────────────
  fastify.post<{
    Params: { orderId: string };
    Body: { transactionId: string };
  }>(
    '/orders/:orderId/convert',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      const { orderId } = request.params;
      const { transactionId } = request.body;

      // Verify order belongs to tenant
      const { rows: orderRows } = await fastify.pg.query<{ tenant_id: string; status: OrderStatus }>(
        `SELECT tenant_id, status FROM whatsapp_orders WHERE order_id = $1`,
        [orderId],
      );
      if (orderRows.length === 0 || orderRows[0]!.tenant_id !== tenantId) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (orderRows[0]!.status === 'cancelled') {
        return reply.status(422).send({ error: 'Cannot convert a cancelled order' });
      }

      // Verify transaction belongs to same tenant
      const { rows: txRows } = await fastify.pg.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM transactions WHERE transaction_id = $1`,
        [transactionId],
      );
      if (txRows.length === 0 || txRows[0]!.tenant_id !== tenantId) {
        return reply.status(404).send({ error: 'Transaction not found' });
      }

      const { rows: updated } = await fastify.pg.query(
        `UPDATE whatsapp_orders
         SET transaction_id = $1, status = 'completed', updated_at = NOW()
         WHERE order_id = $2 AND tenant_id = $3
         RETURNING *`,
        [transactionId, orderId, tenantId],
      );

      return reply.send(updated[0]);
    },
  );
}
