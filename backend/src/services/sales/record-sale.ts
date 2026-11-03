/**
 * Atomic, replay-safe sale recording for POST /transactions.
 *
 * Everything that makes a sale real happens in ONE database transaction:
 *   lock the shift row -> insert the sale (ON CONFLICT on client_tx_id) -> shift total ->
 *   payment_transactions -> sale_tenders -> stock (+ stock_variances) -> receipt number.
 * Anomaly checks, alerts and logging run after COMMIT in the caller and never fail the sale.
 *
 * A completed sale is NEVER rejected for lack of stock: the stock is clamped at zero and the
 * shortfall is written to stock_variances (docs/pos-architecture-sync.md, section 5).
 *
 * Lock order (always the same, so concurrent sales cannot deadlock):
 *   shift row  ->  product rows (sorted by product_id)  ->  tenant_receipt_counters row (last, held shortest).
 */
import { createHash, randomUUID } from 'node:crypto';
import type { CanonicalLineItem } from './line-items.js';

// ── Minimal database interfaces (satisfied by pg.Pool, pg.PoolClient and fastify.pg) ────────────
export interface SqlRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<R = any>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}
export interface SqlPool extends SqlRunner {
  connect(): Promise<SqlRunner & { release(): void }>;
}

// ── Request shapes (moved here from pos-routes.ts; the route imports them) ─────────────────────
export interface ApiDiscount {
  type: 'percentage' | 'fixed';
  value: number; // pct (0-100) or piastres
  managerApprovedBy?: string | null;
}
export interface TransactionLine {
  productId: string;
  quantity: number;
  unitPricePiastres: number;
  lineTotalPiastres: number;
  taxRate?: number;
  taxAmountPiastres: number;
  discount?: ApiDiscount | null;
}
export interface Tender {
  method: string;
  amountPiastres: number;
  reference?: string | null;
}

// ── Variance reasons (fixed vocabulary; the column itself is free text) ─────────────────────────
// The sale path can only produce these three. They are HEURISTICS on signals the client sends
// (the LOCAL- reference and sold_at), not verified facts. The name `count_mismatch` is deliberately
// NOT used here: it is reserved for a variance found by comparing a real stock-take (count) with the
// system stock, which does not exist yet.
//
//   oversell_offline  how detected: the request carries a provisional LOCAL- receipt reference
//                     (the sale was made while the register was offline).
//   late_sync         how detected: no LOCAL- reference, but sold_at is more than LATE_SYNC_SECONDS
//                     (300 s) older than the moment the server received the sale.
//   oversell_online   how detected: the default. An on-time online sale found less stock than it needed.
export type VarianceReason = 'oversell_offline' | 'late_sync' | 'oversell_online';

/** A sale that reaches the server more than this long after it was made counts as a late sync. */
export const LATE_SYNC_SECONDS = 300;

/** Why was stock short? Checked in this order: LOCAL- reference, then sold_at lag, then the default. */
export function chooseVarianceReason(i: { localReceiptRef?: string | null; soldAt: Date; receivedAt: Date }): VarianceReason {
  if (i.localReceiptRef) return 'oversell_offline';
  const lagSeconds = (i.receivedAt.getTime() - i.soldAt.getTime()) / 1000;
  if (lagSeconds > LATE_SYNC_SECONDS) return 'late_sync';
  return 'oversell_online';
}

// ── Identity fields (clientTxId, deviceId, localReceiptRef) ─────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_REF_RE = /^LOCAL-[A-Za-z0-9-]{1,32}$/;

export interface SaleIdentity {
  clientTxId: string | null;
  deviceId: string | null;
  localReceiptRef: string | null;
}

export function parseSaleIdentity(body: { clientTxId?: unknown; deviceId?: unknown; localReceiptRef?: unknown }):
  { ok: true; value: SaleIdentity } | { ok: false; error: string } {
  const { clientTxId, deviceId, localReceiptRef } = body;
  if (clientTxId !== undefined && clientTxId !== null) {
    if (typeof clientTxId !== 'string' || !UUID_RE.test(clientTxId)) return { ok: false, error: 'clientTxId must be a UUID' };
  }
  if (deviceId !== undefined && deviceId !== null) {
    if (typeof deviceId !== 'string' || deviceId.length < 1 || deviceId.length > 128) return { ok: false, error: 'deviceId must be 1-128 characters' };
  }
  if (localReceiptRef !== undefined && localReceiptRef !== null) {
    if (typeof localReceiptRef !== 'string' || !LOCAL_REF_RE.test(localReceiptRef)) return { ok: false, error: 'localReceiptRef must look like LOCAL-XXXXXXXX' };
  }
  return {
    ok: true,
    value: {
      clientTxId: typeof clientTxId === 'string' ? clientTxId.toLowerCase() : null,
      deviceId: typeof deviceId === 'string' ? deviceId : null,
      localReceiptRef: typeof localReceiptRef === 'string' ? localReceiptRef : null,
    },
  };
}

// ── Body fingerprint (same clientTxId + different body => 409) ──────────────────────────────────
/**
 * Identifies "the same sale": shift, total, payment method and the multiset of (product, quantity,
 * line total). soldAt, device and receipt reference are deliberately excluded: a retry may carry
 * different transport details and is still the same sale.
 */
export function saleSignature(i: {
  shiftId: string;
  totalPiastres: number;
  paymentMethod: string;
  lines: Array<{ productId: string; quantity: number; lineTotalCents: number }>;
}): string {
  const lines = i.lines
    .map((l) => `${l.productId}|${Number(l.quantity)}|${Math.round(Number(l.lineTotalCents))}`)
    .sort();
  return createHash('sha256')
    .update(JSON.stringify([i.shiftId, Math.round(i.totalPiastres), i.paymentMethod, lines]))
    .digest('hex');
}

// ── Recording ────────────────────────────────────────────────────────────────────────────────────
export interface RecordSaleInput extends SaleIdentity {
  shiftId: string;
  lines: TransactionLine[];
  canonicalLines: CanonicalLineItem[];
  cartDiscount: ApiDiscount | null;
  paymentMethod: 'cash' | 'card' | 'lana';
  tenders: Tender[];
  grandTotalPiastres: number;
  cartDiscountAmountPiastres: number;
  totalDiscountPiastres: number;
  discountApprovedBy: string | null;
  /** The client's soldAt after the route's window checks; null means "now". */
  soldAt: Date | null;
  approvalCode: string | null;
  maskedPan: string | null;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface StockVariance {
  productId: string;
  expectedQty: number;
  actualQty: number;
  varianceQty: number;
  reason: VarianceReason;
}

export interface RecordedSale {
  transactionId: string;
  receiptNumber: string;
  createdAt: string;
  soldAt: string;
  tenantId: string;
  registerId: string;
  cashierId: string;
}

export type RecordSaleResult =
  | { kind: 'created'; sale: RecordedSale; variances: StockVariance[] }
  | { kind: 'replayed'; sale: RecordedSale }
  | { kind: 'conflict' }
  | { kind: 'shift_not_found' }
  | { kind: 'shift_not_open'; status: string };

interface ShiftRow { tenant_id: string; register_id: string; cashier_id: string; status: string }

/**
 * Runs every write inside the CALLER's open transaction. The caller decides COMMIT or ROLLBACK
 * (recordSale below does). A thrown error means nothing may be committed.
 */
export async function recordSaleInTx(db: SqlRunner, input: RecordSaleInput): Promise<RecordSaleResult> {
  const receivedAt = input.now ?? new Date();

  // 1. Lock the shift row: serialises sales of one shift and proves the shift is open.
  const shiftRes = await db.query<ShiftRow>(
    `SELECT tenant_id, register_id, cashier_id, status FROM shifts WHERE shift_id = $1 FOR UPDATE`,
    [input.shiftId],
  );
  const shift = shiftRes.rows[0];
  if (!shift) return { kind: 'shift_not_found' };
  if (shift.status !== 'open') return { kind: 'shift_not_open', status: shift.status };

  // 2. Insert the sale. The partial unique index on (tenant_id, client_tx_id) decides duplicates, so
  //    concurrent identical requests cannot both win (no read-then-write). The receipt number is
  //    assigned last, so a duplicate never burns a number.
  const transactionId = randomUUID();
  const ins = await db.query<{ transaction_id: string; created_at: string; sold_at: Date | string }>(
    `INSERT INTO transactions
       (transaction_id, tenant_id, register_id, shift_id, cashier_id,
        items, total_amount_cents, payment_method, client_timestamp, sold_at,
        cart_discount_type, cart_discount_value, cart_discount_amount_cents,
        total_discount_cents, discount_approved_by,
        card_approval_code, card_masked_pan,
        client_tx_id, device_id, local_receipt_ref)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW(), COALESCE($9, NOW()),
             $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     ON CONFLICT (tenant_id, client_tx_id) WHERE client_tx_id IS NOT NULL DO NOTHING
     RETURNING transaction_id, created_at::text AS created_at, sold_at`,
    [
      transactionId, shift.tenant_id, shift.register_id, input.shiftId, shift.cashier_id,
      JSON.stringify(input.canonicalLines), input.grandTotalPiastres, input.paymentMethod, input.soldAt,
      input.cartDiscount?.type ?? null,
      input.cartDiscount ? Math.round(input.cartDiscount.value) : null,
      input.cartDiscountAmountPiastres, input.totalDiscountPiastres, input.discountApprovedBy,
      input.approvalCode, input.maskedPan,
      input.clientTxId, input.deviceId, input.localReceiptRef,
    ],
  );

  if (ins.rows.length === 0) {
    // The same (tenant, clientTxId) already exists and is committed (a concurrent twin has finished).
    return replayOrConflict(db, input, shift);
  }
  const row = ins.rows[0]!;
  const soldAtDate = new Date(row.sold_at);

  // 3. Shift running total.
  await db.query(
    `UPDATE shifts SET total_sales_piastres = total_sales_piastres + $1 WHERE shift_id = $2`,
    [input.grandTotalPiastres, input.shiftId],
  );

  // 4. payment_transactions (same mapping as before).
  const paymentStatus = input.paymentMethod === 'card' ? (input.approvalCode ? 'approved' : 'offline_auth') : 'approved';
  await db.query(
    `INSERT INTO payment_transactions
       (payment_tx_id, sale_transaction_id, shift_id, register_id, amount, payment_method, status,
        cmi_token_ref, terminal_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [randomUUID(), transactionId, input.shiftId, shift.register_id, input.grandTotalPiastres,
      input.paymentMethod, paymentStatus, input.approvalCode, input.maskedPan],
  );

  // 5. sale_tenders.
  for (const tender of input.tenders) {
    await db.query(
      `INSERT INTO sale_tenders (transaction_id, shift_id, method, amount_piastres, reference)
       VALUES ($1, $2, $3, $4, $5)`,
      [transactionId, input.shiftId, tender.method, tender.amountPiastres, tender.reference ?? null],
    );
  }

  // 6. Stock. Product rows are locked in sorted order. A shortfall never rejects the sale: the stock
  //    is clamped at zero (as before) and the shortfall is recorded in stock_variances.
  const wanted = new Map<string, number>();
  for (const l of input.lines) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + Number(l.quantity));
  const reason = chooseVarianceReason({
    localReceiptRef: input.localReceiptRef,
    soldAt: input.soldAt ?? soldAtDate,
    receivedAt,
  });
  const variances: StockVariance[] = [];
  for (const productId of [...wanted.keys()].sort()) {
    const qty = wanted.get(productId)!;
    const stock = await db.query<{ stock_quantity: string | number }>(
      `SELECT stock_quantity FROM products
        WHERE product_id = $1 AND tenant_id = $2 AND track_stock = true FOR UPDATE`,
      [productId, shift.tenant_id],
    );
    if (stock.rows.length === 0) continue; // unknown product or stock not tracked: nothing to deduct
    const available = Number(stock.rows[0]!.stock_quantity);
    await db.query(
      // $1 must be cast: stock_quantity is INTEGER, so Postgres would otherwise infer $1 as an integer
      // and reject a fractional (weighted) quantity such as 0.5 with 22P02, failing the whole sale.
      // The result is rounded to an integer on assignment; the kg-versus-grams question for weighted
      // stock is a separate audit and is deliberately not decided here.
      `UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1::numeric, 0)
        WHERE product_id = $2 AND tenant_id = $3 AND track_stock = true`,
      [qty, productId, shift.tenant_id],
    );
    if (qty > available) {
      // expected_qty = what the sale needed, actual_qty = what was on hand; variance = actual - expected (< 0).
      await db.query(
        `INSERT INTO stock_variances (tenant_id, product_id, register_id, transaction_id, expected_qty, actual_qty, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [shift.tenant_id, productId, shift.register_id, transactionId, qty, available, reason],
      );
      variances.push({ productId, expectedQty: qty, actualQty: available, varianceQty: available - qty, reason });
    }
  }

  // 7. Official receipt number, last: it is the only tenant-wide lock and is held until COMMIT.
  //    Inside the transaction, so a rollback leaves no gap in the sequence.
  const seq = await db.query<{ last_seq: string }>(
    `INSERT INTO tenant_receipt_counters (tenant_id, last_seq, updated_at) VALUES ($1, 1, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET last_seq = tenant_receipt_counters.last_seq + 1, updated_at = NOW()
     RETURNING last_seq`,
    [shift.tenant_id],
  );
  const receiptNumber = `R-${String(parseInt(seq.rows[0]?.last_seq ?? '0', 10)).padStart(6, '0')}`;
  await db.query(`UPDATE transactions SET receipt_number = $1 WHERE transaction_id = $2`, [receiptNumber, transactionId]);

  return {
    kind: 'created',
    variances,
    sale: {
      transactionId, receiptNumber, createdAt: row.created_at, soldAt: soldAtDate.toISOString(),
      tenantId: shift.tenant_id, registerId: shift.register_id, cashierId: shift.cashier_id,
    },
  };
}

async function replayOrConflict(db: SqlRunner, input: RecordSaleInput, shift: ShiftRow): Promise<RecordSaleResult> {
  const prev = await db.query<{
    transaction_id: string; receipt_number: string | null; created_at: string; sold_at: Date | string;
    shift_id: string; total_amount_cents: number; payment_method: string; items: CanonicalLineItem[] | string;
    register_id: string; cashier_id: string;
  }>(
    `SELECT transaction_id, receipt_number, created_at::text AS created_at, sold_at, shift_id,
            total_amount_cents, payment_method, items, register_id, cashier_id
       FROM transactions WHERE tenant_id = $1 AND client_tx_id = $2`,
    [shift.tenant_id, input.clientTxId],
  );
  const p = prev.rows[0];
  if (!p) throw new Error('replay_row_missing'); // cannot happen: the unique index said it exists
  const storedItems: CanonicalLineItem[] = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
  const before = saleSignature({
    shiftId: p.shift_id, totalPiastres: p.total_amount_cents, paymentMethod: p.payment_method,
    lines: storedItems.map((l) => ({ productId: l.productId, quantity: l.quantity, lineTotalCents: l.lineTotalCents })),
  });
  const now = saleSignature({
    shiftId: input.shiftId, totalPiastres: input.grandTotalPiastres, paymentMethod: input.paymentMethod,
    lines: input.canonicalLines.map((l) => ({ productId: l.productId, quantity: l.quantity, lineTotalCents: l.lineTotalCents })),
  });
  if (before !== now) return { kind: 'conflict' };
  return {
    kind: 'replayed',
    sale: {
      transactionId: p.transaction_id,
      receiptNumber: p.receipt_number ?? '',
      createdAt: p.created_at,
      soldAt: new Date(p.sold_at).toISOString(),
      tenantId: shift.tenant_id, registerId: p.register_id, cashierId: p.cashier_id,
    },
  };
}

/** BEGIN, recordSaleInTx, then COMMIT only when a new sale was created; ROLLBACK otherwise and on any error. */
export async function recordSale(pool: SqlPool, input: RecordSaleInput): Promise<RecordSaleResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await recordSaleInTx(client, input);
    await client.query(result.kind === 'created' ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ── After COMMIT: alerts (best effort, never throws) ─────────────────────────────────────────────
/** One anomaly_alerts row per variance (alert_type is free text in that table). Never fails the sale. */
export async function raiseVarianceAlerts(
  pool: SqlRunner,
  ctx: { tenantId: string; shiftId: string; cashierId: string; transactionId: string },
  variances: StockVariance[],
): Promise<void> {
  for (const v of variances) {
    try {
      const ratio = v.expectedQty > 0 ? Math.min(1, (v.expectedQty - v.actualQty) / v.expectedQty) : 1;
      const score = Math.round((40 + 60 * ratio) * 100) / 100;
      await pool.query(
        `INSERT INTO anomaly_alerts (tenant_id, shift_id, cashier_id, alert_type, severity, score, details, reference_id)
         VALUES ($1, $2, $3, 'stock_variance', $4, $5, $6::jsonb, $7)`,
        [
          ctx.tenantId, ctx.shiftId, ctx.cashierId,
          v.actualQty <= 0 ? 'high' : 'medium', score,
          JSON.stringify({
            product_id: v.productId, expected_qty: v.expectedQty, actual_qty: v.actualQty,
            variance_qty: v.varianceQty, reason: v.reason,
          }),
          ctx.transactionId,
        ],
      );
    } catch (err) {
      console.error('[stock-variance] alert insert failed', err instanceof Error ? err.name : 'unknown');
    }
  }
}
