import type { FastifyInstance } from 'fastify';
import { evaluateCostChange, type CostAlert } from './cost-shield.js';

const MANAGER_ROLES = ['MANAGER', 'SUPERVISOR'] as const;
const VIEW_ROLES    = ['MANAGER', 'SUPERVISOR', 'CASHIER', 'SENIOR_CASHIER'] as const;

export async function supplierRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /suppliers ────────────────────────────────────────────────────────
  fastify.get('/suppliers', { config: { allowedRoles: VIEW_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    try {
      const { rows } = await fastify.pg.query(
        `SELECT supplier_id, name, phone, address, notes, is_active, created_at
         FROM suppliers
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY name ASC`,
        [tenantId],
      );
      return reply.send(rows);
    } catch (err: unknown) {
      fastify.log.error({ err }, '[suppliers] list failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── POST /suppliers ───────────────────────────────────────────────────────
  fastify.post<{
    Body: { name: string; phone?: string; address?: string; notes?: string };
  }>('/suppliers', { config: { allowedRoles: MANAGER_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    const { name, phone, address, notes } = request.body ?? {};
    if (!name || !name.trim()) return reply.status(400).send({ error: 'name is required' });
    try {
      const { rows } = await fastify.pg.query(
        `INSERT INTO suppliers (tenant_id, name, phone, address, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING supplier_id, name, phone, address, notes, is_active, created_at`,
        [tenantId, name.trim(), phone ?? null, address ?? null, notes ?? null],
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      fastify.log.error({ err }, '[suppliers] insert failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── PATCH /suppliers/:supplierId ──────────────────────────────────────────
  fastify.patch<{
    Params: { supplierId: string };
    Body: { name?: string; phone?: string; address?: string; notes?: string; is_active?: boolean };
  }>('/suppliers/:supplierId', { config: { allowedRoles: MANAGER_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    const { supplierId } = request.params;
    const { name, phone, address, notes, is_active } = request.body ?? {};

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [tenantId, supplierId];
    let idx = 3;
    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name.trim()); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(phone); }
    if (address !== undefined) { sets.push(`address = $${idx++}`); params.push(address); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); params.push(notes); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(is_active); }

    try {
      const { rows, rowCount } = await fastify.pg.query(
        `UPDATE suppliers SET ${sets.join(', ')}
         WHERE tenant_id = $1 AND supplier_id = $2
         RETURNING supplier_id, name, phone, address, notes, is_active, updated_at`,
        params,
      );
      if (!rowCount) return reply.status(404).send({ error: 'Supplier not found' });
      return reply.send(rows[0]);
    } catch (err: unknown) {
      fastify.log.error({ err }, '[suppliers] update failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── DELETE /suppliers/:supplierId (soft delete) ───────────────────────────
  fastify.delete<{ Params: { supplierId: string } }>(
    '/suppliers/:supplierId',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { supplierId } = request.params;
      try {
        const { rowCount } = await fastify.pg.query(
          `UPDATE suppliers SET is_active = false, updated_at = NOW()
           WHERE tenant_id = $1 AND supplier_id = $2`,
          [tenantId, supplierId],
        );
        if (!rowCount) return reply.status(404).send({ error: 'Supplier not found' });
        return reply.status(204).send();
      } catch (err: unknown) {
        fastify.log.error({ err }, '[suppliers] soft-delete failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /suppliers/:supplierId/invoices ──────────────────────────────────
  fastify.get<{ Params: { supplierId: string } }>(
    '/suppliers/:supplierId/invoices',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const { supplierId } = request.params;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      try {
        const { rows } = await fastify.pg.query(
          `SELECT i.*,
             COALESCE(json_agg(l.* ORDER BY l.line_id) FILTER (WHERE l.line_id IS NOT NULL), '[]') AS lines
           FROM supplier_invoices i
           LEFT JOIN supplier_invoice_lines l ON l.invoice_id = i.invoice_id
           WHERE i.supplier_id = $1 AND i.tenant_id = $2
           GROUP BY i.invoice_id
           ORDER BY i.invoice_date DESC
           LIMIT 50`,
          [supplierId, tenantId],
        );
        return reply.send(rows);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[invoices] list failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /suppliers/:supplierId/invoices ──────────────────────────────────
  fastify.post<{
    Params: { supplierId: string };
    Body: {
      invoice_ref?: string;
      invoice_date?: string;
      due_date?: string;
      tax_mad?: number;
      notes?: string;
      lines: Array<{
        product_id?: string;
        description_ar: string;
        description_fr?: string;
        quantity: number;
        unit?: string;
        unit_cost_mad: number;
        update_cost?: boolean;
      }>;
    };
  }>(
    '/suppliers/:supplierId/invoices',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const staffId  = request.auth?.staff_id;
      const { supplierId } = request.params;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { invoice_ref, invoice_date, due_date, tax_mad, notes, lines } = request.body ?? {};
      if (!lines?.length) return reply.status(400).send({ error: 'lines required' });

      if (lines.some((l) => !Number.isFinite(l.unit_cost_mad) || l.unit_cost_mad < 0)) {
        return reply.status(400).send({ error: 'unit_cost_mad must be a non-negative number' });
      }

      const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_cost_mad, 0);
      const tax   = tax_mad ?? 0;
      const total = subtotal + tax;

      const costAlerts: CostAlert[] = [];
      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        const { rows: [inv] } = await client.query<{ invoice_id: string }>(
          `INSERT INTO supplier_invoices
             (tenant_id, supplier_id, invoice_ref, invoice_date, due_date,
              subtotal_mad, tax_mad, total_mad, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING invoice_id`,
          [
            tenantId, supplierId,
            invoice_ref ?? null,
            invoice_date ?? new Date().toISOString().slice(0, 10),
            due_date ?? null,
            subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2),
            notes ?? null, staffId ?? null,
          ],
        );

        for (const line of lines) {
          const lineTotal = line.quantity * line.unit_cost_mad;
          await client.query(
            `INSERT INTO supplier_invoice_lines
               (invoice_id, tenant_id, product_id, description_ar, description_fr,
                quantity, unit, unit_cost_mad, line_total_mad, update_cost)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              inv.invoice_id, tenantId, line.product_id ?? null,
              line.description_ar, line.description_fr ?? null,
              line.quantity, line.unit ?? 'unit',
              line.unit_cost_mad.toFixed(4), lineTotal.toFixed(2),
              line.update_cost ?? true,
            ],
          );
          if (line.product_id) {
            // Lock the row so concurrent invoices see each other's cost as "previous".
            const { rows: [prod] } = await client.query<{
              name_ar: string; name_fr: string;
              price_cents: number; cost_price_cents: number | null;
            }>(
              `SELECT name_ar, name_fr, price_cents, cost_price_cents
               FROM products WHERE product_id = $1 AND tenant_id = $2 FOR UPDATE`,
              [line.product_id, tenantId],
            );

            await client.query(
              `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2 AND tenant_id = $3`,
              [line.quantity, line.product_id, tenantId],
            );

            // Same integer value feeds the history row and the product update.
            const newCostCents = Math.round(line.unit_cost_mad * 100);
            if (line.update_cost !== false) {
              await client.query(
                `UPDATE products SET cost_price_cents = $1 WHERE product_id = $2 AND tenant_id = $3`,
                [newCostCents, line.product_id, tenantId],
              );
            }

            if (prod) {
              const previousCents = prod.cost_price_cents && prod.cost_price_cents > 0
                ? prod.cost_price_cents
                : null;
              await client.query(
                `INSERT INTO product_cost_history
                   (tenant_id, product_id, supplier_id, invoice_id, unit_cost_cents, previous_cost_cents)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [tenantId, line.product_id, supplierId, inv.invoice_id, newCostCents, previousCents],
              );
              const alert = evaluateCostChange({
                product_id: line.product_id,
                name_ar: prod.name_ar,
                name_fr: prod.name_fr,
                previous_cost_cents: previousCents,
                new_cost_cents: newCostCents,
                price_cents: prod.price_cents,
              });
              if (alert) costAlerts.push(alert);
            }
          }
        }

        await client.query(
          `UPDATE suppliers SET balance = balance + $1 WHERE supplier_id = $2 AND tenant_id = $3`,
          [total.toFixed(2), supplierId, tenantId],
        );
        await client.query(
          `UPDATE supplier_invoices SET stock_received = true WHERE invoice_id = $1`,
          [inv.invoice_id],
        );

        await client.query('COMMIT');
        return reply.status(201).send({
          invoice_id: inv.invoice_id, total_mad: total, lines_count: lines.length,
          cost_alerts: costAlerts,
        });
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        fastify.log.error({ err }, '[invoices] create failed');
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
      } finally {
        client.release();
      }
    },
  );

  // ── POST /suppliers/:supplierId/payments ──────────────────────────────────
  fastify.post<{
    Params: { supplierId: string };
    Body: {
      amount_mad: number;
      method?: string;
      reference?: string;
      payment_date?: string;
      notes?: string;
      invoice_id?: string;
    };
  }>(
    '/suppliers/:supplierId/payments',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const staffId  = request.auth?.staff_id;
      const { supplierId } = request.params;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });

      const { amount_mad, method, reference, payment_date, notes, invoice_id } = request.body ?? {};
      if (!amount_mad || amount_mad <= 0) return reply.status(400).send({ error: 'amount_mad required' });

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO supplier_payments
             (tenant_id, supplier_id, invoice_id, amount_mad, method, reference,
              payment_date, notes, recorded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            tenantId, supplierId, invoice_id ?? null,
            amount_mad.toFixed(2), method ?? 'cash',
            reference ?? null,
            payment_date ?? new Date().toISOString().slice(0, 10),
            notes ?? null, staffId ?? null,
          ],
        );

        await client.query(
          `UPDATE suppliers SET balance = balance - $1 WHERE supplier_id = $2 AND tenant_id = $3`,
          [amount_mad.toFixed(2), supplierId, tenantId],
        );

        if (invoice_id) {
          await client.query(
            `UPDATE supplier_invoices
             SET paid_mad = paid_mad + $1,
               status = CASE
                 WHEN paid_mad + $1 >= total_mad THEN 'paid'
                 WHEN paid_mad + $1 > 0          THEN 'partial'
                 ELSE status
               END
             WHERE invoice_id = $2 AND tenant_id = $3`,
            [amount_mad.toFixed(2), invoice_id, tenantId],
          );
        }

        await client.query('COMMIT');

        const { rows: [sup] } = await fastify.pg.query<{ balance: string }>(
          `SELECT balance FROM suppliers WHERE supplier_id = $1`,
          [supplierId],
        );
        return reply.send({ ok: true, new_balance: parseFloat(sup?.balance ?? '0') });
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        fastify.log.error({ err }, '[payments] record failed');
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
      } finally {
        client.release();
      }
    },
  );

  // ── GET /suppliers/:supplierId/statement ──────────────────────────────────
  fastify.get<{ Params: { supplierId: string } }>(
    '/suppliers/:supplierId/statement',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const { supplierId } = request.params;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
      try {
        const [supplier, invoices, payments] = await Promise.all([
          fastify.pg.query(
            `SELECT * FROM suppliers WHERE supplier_id = $1 AND tenant_id = $2`,
            [supplierId, tenantId],
          ),
          fastify.pg.query(
            `SELECT invoice_id, invoice_ref, invoice_date, total_mad, paid_mad, remaining_mad, status
             FROM supplier_invoices
             WHERE supplier_id = $1 AND tenant_id = $2
             ORDER BY invoice_date DESC LIMIT 20`,
            [supplierId, tenantId],
          ),
          fastify.pg.query(
            `SELECT payment_id, amount_mad, method, payment_date, reference
             FROM supplier_payments
             WHERE supplier_id = $1 AND tenant_id = $2
             ORDER BY payment_date DESC LIMIT 20`,
            [supplierId, tenantId],
          ),
        ]);
        if (!supplier.rows[0]) return reply.status(404).send({ error: 'Supplier not found' });
        return reply.send({
          supplier: supplier.rows[0],
          invoices: invoices.rows,
          payments: payments.rows,
        });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[statement] failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface PoLine {
  productId: string;
  quantityReceived: number;
  unitCostPiastres?: number;
  notes?: string;
}

export async function purchaseOrderRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /purchase-orders ──────────────────────────────────────────────────
  fastify.get<{
    Querystring: { supplierId?: string; status?: string; limit?: string };
  }>('/purchase-orders', { config: { allowedRoles: VIEW_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    const { supplierId, status, limit = '20' } = request.query;

    const conditions: string[] = ['po.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (supplierId) { conditions.push(`po.supplier_id = $${idx++}`); params.push(supplierId); }
    if (status) { conditions.push(`po.status = $${idx++}`); params.push(status); }
    params.push(Math.min(parseInt(limit, 10) || 20, 100));

    try {
      const { rows } = await fastify.pg.query(
        `SELECT po.po_id, po.received_at, po.status, po.total_cost_piastres, po.notes,
                po.created_at, s.name AS supplier_name,
                COUNT(l.line_id)::int AS line_count
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
         LEFT JOIN po_lines l ON l.po_id = po.po_id
         WHERE ${conditions.join(' AND ')}
         GROUP BY po.po_id, s.name
         ORDER BY po.received_at DESC
         LIMIT $${idx}`,
        params,
      );
      return reply.send(rows);
    } catch (err: unknown) {
      fastify.log.error({ err }, '[po] list failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── GET /purchase-orders/:poId ────────────────────────────────────────────
  fastify.get<{ Params: { poId: string } }>(
    '/purchase-orders/:poId',
    { config: { allowedRoles: VIEW_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { poId } = request.params;
      try {
        const { rows: [po] } = await fastify.pg.query(
          `SELECT po.po_id, po.received_at, po.status, po.total_cost_piastres,
                  po.notes, po.created_at,
                  s.name AS supplier_name, s.supplier_id
           FROM purchase_orders po
           LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
           WHERE po.po_id = $1 AND po.tenant_id = $2`,
          [poId, tenantId],
        );
        if (!po) return reply.status(404).send({ error: 'PO not found' });

        const { rows: lines } = await fastify.pg.query(
          `SELECT l.line_id, l.product_id, l.quantity_received,
                  l.unit_cost_piastres, l.line_total_piastres, l.notes, l.lot_id,
                  p.name_ar, p.name_fr, p.plu_code
           FROM po_lines l
           JOIN products p ON p.product_id = l.product_id
           WHERE l.po_id = $1`,
          [poId],
        );
        return reply.send({ ...po, lines });
      } catch (err: unknown) {
        fastify.log.error({ err }, '[po] get failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /purchase-orders ─────────────────────────────────────────────────
  fastify.post<{
    Body: {
      supplierId?: string;
      storeId?: string;
      notes?: string;
      lines: PoLine[];
    };
  }>('/purchase-orders', { config: { allowedRoles: MANAGER_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
    const { supplierId, storeId, notes, lines } = request.body ?? {};

    if (!lines || lines.length === 0) {
      return reply.status(400).send({ error: 'lines is required and must not be empty' });
    }
    for (const line of lines) {
      if (!line.productId || !line.quantityReceived || line.quantityReceived <= 0) {
        return reply.status(400).send({ error: 'Each line requires productId and quantityReceived > 0' });
      }
    }

    const client = await fastify.pg.connect();
    try {
      await client.query('BEGIN');

      const { rows: [po] } = await client.query(
        `INSERT INTO purchase_orders (tenant_id, supplier_id, store_id, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING po_id`,
        [tenantId, supplierId ?? null, storeId ?? null, notes ?? null],
      );

      let total = 0;
      const insertedLines = [];
      for (const line of lines) {
        const lineTotal = line.unitCostPiastres != null
          ? line.unitCostPiastres * line.quantityReceived
          : null;
        if (lineTotal != null) total += lineTotal;

        const { rows: [inserted] } = await client.query(
          `INSERT INTO po_lines
             (po_id, tenant_id, product_id, quantity_received,
              unit_cost_piastres, line_total_piastres, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING line_id, product_id, quantity_received,
                     unit_cost_piastres, line_total_piastres, notes`,
          [po.po_id, tenantId, line.productId, line.quantityReceived,
           line.unitCostPiastres ?? null, lineTotal, line.notes ?? null],
        );
        insertedLines.push(inserted);
      }

      await client.query(
        `UPDATE purchase_orders SET total_cost_piastres = $1 WHERE po_id = $2`,
        [total, po.po_id],
      );

      await client.query('COMMIT');
      return reply.status(201).send({ po_id: po.po_id, total_cost_piastres: total, lines: insertedLines });
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      fastify.log.error({ err }, '[po] create failed');
      return reply.status(500).send({ error: 'Internal error' });
    } finally {
      client.release();
    }
  });

  // ── POST /purchase-orders/:poId/confirm ───────────────────────────────────
  // Atomic: creates product lots + updates stock for all lines in one transaction.
  // Rolls back completely on any failure — no partial state.
  fastify.post<{ Params: { poId: string } }>(
    '/purchase-orders/:poId/confirm',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const staffId = request.auth?.staff_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { poId } = request.params;

      const client = await fastify.pg.connect();
      try {
        await client.query('BEGIN');

        // Verify PO belongs to tenant and is still draft
        const { rows: [po] } = await client.query(
          `SELECT po_id, status, supplier_id FROM purchase_orders
           WHERE po_id = $1 AND tenant_id = $2 FOR UPDATE`,
          [poId, tenantId],
        );
        if (!po) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'PO not found' });
        }
        if (po.status !== 'draft') {
          await client.query('ROLLBACK');
          return reply.status(409).send({ error: `PO is already ${po.status}` });
        }

        // Fetch all lines
        const { rows: lines } = await client.query(
          `SELECT line_id, product_id, quantity_received,
                  unit_cost_piastres, line_total_piastres, notes
           FROM po_lines WHERE po_id = $1`,
          [poId],
        );

        const updatedProductNames: string[] = [];

        for (const line of lines) {
          // Deactivate existing active lots for this product
          await client.query(
            `UPDATE product_lots SET is_active = false
             WHERE product_id = $1 AND tenant_id = $2 AND is_active = true`,
            [line.product_id, tenantId],
          );

          // Create new lot (markdown clock reset)
          const { rows: [lot] } = await client.query(
            `INSERT INTO product_lots
               (tenant_id, product_id, received_at, quantity_received,
                notes, supplier_id, unit_cost_piastres, total_cost_piastres)
             VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
             RETURNING lot_id`,
            [
              tenantId,
              line.product_id,
              line.quantity_received,
              line.notes ?? null,
              po.supplier_id ?? null,
              line.unit_cost_piastres ?? null,
              line.line_total_piastres ?? null,
            ],
          );

          // Link lot back to the po_line
          await client.query(
            `UPDATE po_lines SET lot_id = $1 WHERE line_id = $2`,
            [lot.lot_id, line.line_id],
          );

          // Update stock: add quantity, enable track_stock on first delivery
          const { rows: [prod] } = await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + $1,
                 track_stock = true
             WHERE product_id = $2 AND tenant_id = $3
             RETURNING name_ar, name_fr`,
            [line.quantity_received, line.product_id, tenantId],
          );
          if (prod) updatedProductNames.push(prod.name_fr || prod.name_ar);
        }

        // Mark PO as received
        const { rows: [updatedPo] } = await client.query(
          `UPDATE purchase_orders
           SET status = 'received',
               received_by = $1,
               received_at = NOW()
           WHERE po_id = $2
           RETURNING po_id, status, received_at, total_cost_piastres`,
          [staffId ?? null, poId],
        );

        await client.query('COMMIT');

        return reply.send({
          ...updatedPo,
          updated_products: updatedProductNames,
          line_count: lines.length,
        });
      } catch (err: unknown) {
        await client.query('ROLLBACK');
        fastify.log.error({ err }, '[po] confirm failed — rolled back');
        return reply.status(500).send({ error: 'Internal error' });
      } finally {
        client.release();
      }
    },
  );
}
