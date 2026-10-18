import type { FastifyInstance, FastifyRequest } from 'fastify';

// ── Role sets (mirror pos-routes.ts) ─────────────────────────────────────
const STAFF_ROLES = ['CASHIER', 'MANAGER', 'SUPERVISOR'] as const;

interface GenerateInvoiceBody {
  transactionId: string;
}

interface StoredItem {
  productId: string;
  quantity: number;
  unitPricePiastres: number;
  lineTotalPiastres: number;
  taxRate?: number;
  taxAmountPiastres: number;
}

interface TaxSummaryLine {
  rate: number;        // decimal, e.g. 0.20 for 20% TVA
  htPiastres: number;
  tvaPiastres: number;
  ttcPiastres: number;
}

const DEFAULT_TAX_RATE = 0.2;

/**
 * Compute a per-rate TVA breakdown from the stored transaction items and the
 * cart-level discount amount. Mirrors the proportional allocation in
 * recomputeTransaction (pos-routes.ts) so the breakdown matches what was
 * charged. Remainder of cart discount is assigned to the last item to keep
 * the allocation exact.
 */
function buildTaxSummary(
  items: StoredItem[],
  cartDiscountAmountPiastres: number,
): TaxSummaryLine[] {
  if (items.length === 0) return [];

  const totalLineHT = items.reduce((s, it) => s + (it.lineTotalPiastres ?? 0), 0);
  const cartDisc = Math.max(0, cartDiscountAmountPiastres ?? 0);

  const rateMap = new Map<number, { htPiastres: number; tvaPiastres: number }>();
  let allocatedCartDisc = 0;

  items.forEach((item, i) => {
    const rate =
      typeof item.taxRate === 'number' && Number.isFinite(item.taxRate)
        ? item.taxRate
        : DEFAULT_TAX_RATE;
    const lineHT = item.lineTotalPiastres ?? 0;

    // Proportional share of cart discount for this line.
    let cartDiscShare = 0;
    if (cartDisc > 0 && totalLineHT > 0) {
      if (i === items.length - 1) {
        cartDiscShare = cartDisc - allocatedCartDisc; // remainder to last line
      } else {
        cartDiscShare = Math.round((cartDisc * lineHT) / totalLineHT);
        allocatedCartDisc += cartDiscShare;
      }
    }

    const finalHT = Math.max(0, lineHT - cartDiscShare);
    const finalTVA = Math.round(finalHT * rate);

    const existing = rateMap.get(rate) ?? { htPiastres: 0, tvaPiastres: 0 };
    rateMap.set(rate, {
      htPiastres: existing.htPiastres + finalHT,
      tvaPiastres: existing.tvaPiastres + finalTVA,
    });
  });

  return Array.from(rateMap.entries()).map(([rate, { htPiastres, tvaPiastres }]) => ({
    rate,
    htPiastres,
    tvaPiastres,
    ttcPiastres: htPiastres + tvaPiastres,
  }));
}

export async function invoiceRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /invoices/generate ──────────────────────────────────────────────
  // Idempotent: if this transaction already has an invoice_number, returns it
  // without allocating a new sequence number.
  fastify.post<{ Body: GenerateInvoiceBody }>(
    '/invoices/generate',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request: FastifyRequest<{ Body: GenerateInvoiceBody }>, reply) => {
      const { transactionId } = request.body;
      // Tenant comes only from the verified JWT claim — never trust client input.
      const tenantId = request.auth?.tenant_id;

      if (!transactionId) {
        return reply.status(400).send({ error: 'transactionId is required' });
      }
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenant claim missing from token' });
      }

      try {
        // ── Look up the transaction — must belong to this tenant ─────────
        const { rows } = await fastify.pg.query<{
          transaction_id: string;
          receipt_number: string | null;
          invoice_number: string | null;
          total_amount_cents: number;
          payment_method: string;
          items: StoredItem[];
          cart_discount_amount_cents: number;
          created_at: string;
        }>(
          `SELECT transaction_id,
                  receipt_number,
                  invoice_number,
                  total_amount_cents,
                  payment_method,
                  items,
                  COALESCE(cart_discount_amount_cents, 0) AS cart_discount_amount_cents,
                  created_at::text AS created_at
           FROM transactions
           WHERE transaction_id = $1 AND tenant_id = $2`,
          [transactionId, tenantId],
        );

        const tx = rows[0];
        if (!tx) {
          return reply.status(404).send({ error: 'Transaction not found' });
        }

        // ── Idempotent: already has an invoice number ────────────────────
        let invoiceNumber = tx.invoice_number;

        if (!invoiceNumber) {
          // Atomically increment the per-tenant invoice counter (row-locked on
          // conflict → no gap, no collision across concurrent requests).
          const { rows: seqRows } = await fastify.pg.query<{ last_seq: string }>(
            `INSERT INTO tenant_invoice_counters (tenant_id, last_seq, updated_at)
             VALUES ($1, 1, NOW())
             ON CONFLICT (tenant_id) DO UPDATE
               SET last_seq = tenant_invoice_counters.last_seq + 1, updated_at = NOW()
             RETURNING last_seq`,
            [tenantId],
          );
          const seq = parseInt(seqRows[0]?.last_seq ?? '1', 10);
          invoiceNumber = `F-${String(seq).padStart(6, '0')}`;

          // Persist the invoice number on the transaction. Scoped to tenant for safety.
          await fastify.pg.query(
            `UPDATE transactions
             SET invoice_number = $1
             WHERE transaction_id = $2 AND tenant_id = $3`,
            [invoiceNumber, transactionId, tenantId],
          );
        }

        // ── Compute server-side TVA breakdown ────────────────────────────
        const items = Array.isArray(tx.items) ? (tx.items as StoredItem[]) : [];
        const taxSummary = buildTaxSummary(items, tx.cart_discount_amount_cents);

        return reply.send({
          invoiceNumber,
          transactionId: tx.transaction_id,
          serverTimestamp: tx.created_at,
          receiptNumber: tx.receipt_number,
          totalPiastres: tx.total_amount_cents,
          paymentMethod: tx.payment_method,
          items: tx.items,
          taxSummary,
        });
      } catch (err: unknown) {
        request.log.error(
          { err, handler: 'POST /invoices/generate', transactionId },
          'invoices/generate: unhandled error',
        );
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );
}
