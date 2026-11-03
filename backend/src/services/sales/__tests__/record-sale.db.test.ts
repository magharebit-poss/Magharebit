/**
 * recordSale against the dev PostgreSQL (greengo_dev). Skipped when the database is unreachable.
 *
 * - Every test except the two "concurrent" ones runs inside a transaction that is ALWAYS rolled back.
 * - The two concurrent tests need real commits (two connections must see each other's rows). They use a
 *   throwaway tenant, shift, staff and products with random ids and delete every row they created in a
 *   `finally`. They never touch the existing dev tenants.
 */
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { normalizeLineItem } from '../line-items';
import {
  raiseVarianceAlerts,
  recordSale,
  recordSaleInTx,
  type RecordSaleInput,
  type SqlRunner,
} from '../record-sale';

const URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
const pool = new pg.Pool({ connectionString: URL, max: 6, connectionTimeoutMillis: 8_000, query_timeout: 60_000 });

async function reachable(): Promise<boolean> {
  if (!/greengo_dev/.test(URL)) return false; // never run against anything else
  try { await pool.query('select 1'); return true; } catch { return false; }
}
const dbOk = await reachable();
afterAll(async () => { await pool.end(); });

interface Seed { tenantId: string; staffId: string; registerId: string; shiftId: string; pA: string; pB: string; pC: string }

/** Inserts a throwaway tenant, staff, open shift and three products using `db` (a transaction or the pool). */
async function seed(db: SqlRunner, stockA = 5): Promise<Seed> {
  // stock_variances.register_id is a foreign key, so the shift must point at a register that exists.
  // An existing dev register is only referenced (read), never modified.
  const reg = (await db.query<{ register_id: string }>(`select register_id from registers limit 1`)).rows[0];
  if (!reg) throw new Error('no register in the dev database to reference');
  const s: Seed = {
    tenantId: randomUUID(), staffId: randomUUID(), registerId: reg.register_id, shiftId: randomUUID(),
    pA: randomUUID(), pB: randomUUID(), pC: randomUUID(),
  };
  await db.query(`INSERT INTO tenants (id, name, slug) VALUES ($1, 'rs-test', $2)`, [s.tenantId, `rs-test-${s.tenantId.slice(0, 8)}`]);
  await db.query(`INSERT INTO staff (staff_id, tenant_id, name_ar, name_fr, role, pin_hash) VALUES ($1, $2, 'اختبار', 'Test', 'CASHIER', 'x')`, [s.staffId, s.tenantId]);
  await db.query(`INSERT INTO shifts (shift_id, tenant_id, register_id, cashier_id, opened_at, status, opening_float) VALUES ($1, $2, $3, $4, now(), 'open', 0)`,
    [s.shiftId, s.tenantId, s.registerId, s.staffId]);
  const prod = (id: string, track: boolean, stock: number): Promise<unknown> => db.query(
    `INSERT INTO products (product_id, tenant_id, name_ar, name_fr, price_cents, stock_quantity, track_stock) VALUES ($1, $2, 'م', 'P', 1000, $3, $4)`,
    [id, s.tenantId, stock, track]);
  await prod(s.pA, true, stockA);   // tracked, small stock
  await prod(s.pB, false, 0);       // not tracked
  await prod(s.pC, true, 100);      // tracked, plenty
  return s;
}

function sale(s: Seed, over: Partial<RecordSaleInput> = {}, qtyA = 2): RecordSaleInput {
  const lines = [{ productId: s.pA, quantity: qtyA, unitPricePiastres: 1000, lineTotalPiastres: 1000 * qtyA, taxAmountPiastres: 0 }];
  return {
    shiftId: s.shiftId, lines, canonicalLines: lines.map(normalizeLineItem), cartDiscount: null, paymentMethod: 'cash',
    tenders: [{ method: 'cash', amountPiastres: 1000 * qtyA }], grandTotalPiastres: 1000 * qtyA,
    cartDiscountAmountPiastres: 0, totalDiscountPiastres: 0, discountApprovedBy: null, soldAt: null,
    approvalCode: null, maskedPan: null, clientTxId: null, deviceId: null, localReceiptRef: null,
    ...over,
  };
}

const one = async <T>(db: SqlRunner, sql: string, p: unknown[] = []): Promise<T> => (await db.query<T>(sql, p)).rows[0]!;
const count = async (db: SqlRunner, table: string, where: string, p: unknown[]): Promise<number> =>
  Number((await one<{ n: string }>(db, `select count(*)::int n from ${table} where ${where}`, p)).n);
const stockOf = async (db: SqlRunner, id: string): Promise<number> =>
  Number((await one<{ s: string }>(db, `select stock_quantity s from products where product_id=$1`, [id])).s);
const shiftTotal = async (db: SqlRunner, id: string): Promise<number> =>
  Number((await one<{ t: string }>(db, `select total_sales_piastres t from shifts where shift_id=$1`, [id])).t);
const lastSeq = async (db: SqlRunner, t: string): Promise<number> =>
  Number((await db.query<{ s: string }>(`select last_seq s from tenant_receipt_counters where tenant_id=$1`, [t])).rows[0]?.s ?? 0);

describe.skipIf(!dbOk)('recordSale on greengo_dev (each test rolled back)', () => {
  let c: pg.PoolClient;
  let s: Seed;
  beforeEach(async () => { c = await pool.connect(); await c.query('BEGIN'); s = await seed(c); });
  afterEach(async () => { await c.query('ROLLBACK').catch(() => undefined); c.release(); });

  test('creates the sale and every dependent write together', async () => {
    const id = randomUUID();
    const r = await recordSaleInTx(c, sale(s, { clientTxId: id, deviceId: 'DEV-1', localReceiptRef: 'LOCAL-ABCD1234' }));
    expect(r.kind).toBe('created');
    if (r.kind !== 'created') return;
    expect(r.sale.receiptNumber).toBe('R-000001');
    expect(r.variances).toEqual([]);
    const row = await one<{ client_tx_id: string; device_id: string; local_receipt_ref: string; receipt_number: string; total_amount_cents: number }>(c,
      `select client_tx_id, device_id, local_receipt_ref, receipt_number, total_amount_cents from transactions where transaction_id=$1`, [r.sale.transactionId]);
    expect(row).toMatchObject({ client_tx_id: id, device_id: 'DEV-1', local_receipt_ref: 'LOCAL-ABCD1234', receipt_number: 'R-000001', total_amount_cents: 2000 });
    expect(await shiftTotal(c, s.shiftId)).toBe(2000);
    expect(await count(c, 'payment_transactions', 'sale_transaction_id=$1', [r.sale.transactionId])).toBe(1);
    expect(await count(c, 'sale_tenders', 'transaction_id=$1', [r.sale.transactionId])).toBe(1);
    expect(await stockOf(c, s.pA)).toBe(3);
    expect(await lastSeq(c, s.tenantId)).toBe(1);
  });

  test('duplicate clientTxId: the original comes back, nothing is written twice', async () => {
    const id = randomUUID();
    const first = await recordSaleInTx(c, sale(s, { clientTxId: id }));
    const again = await recordSaleInTx(c, sale(s, { clientTxId: id }));
    expect(first.kind).toBe('created');
    expect(again.kind).toBe('replayed');
    if (first.kind !== 'created' || again.kind !== 'replayed') return;
    expect(again.sale.transactionId).toBe(first.sale.transactionId);
    expect(again.sale.receiptNumber).toBe(first.sale.receiptNumber);
    expect(await count(c, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(1);
    expect(await shiftTotal(c, s.shiftId)).toBe(2000);
    expect(await stockOf(c, s.pA)).toBe(3);
    expect(await count(c, 'payment_transactions', 'shift_id=$1', [s.shiftId])).toBe(1);
    expect(await lastSeq(c, s.tenantId)).toBe(1); // no receipt number burned by the duplicate
  });

  test('same clientTxId with a different body is a conflict and changes nothing', async () => {
    const id = randomUUID();
    await recordSaleInTx(c, sale(s, { clientTxId: id }, 2));
    const r = await recordSaleInTx(c, sale(s, { clientTxId: id }, 3));
    expect(r.kind).toBe('conflict');
    expect(await count(c, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(1);
    expect(await shiftTotal(c, s.shiftId)).toBe(2000);
    expect(await stockOf(c, s.pA)).toBe(3);
  });

  test('the same clientTxId in another tenant is a different sale', async () => {
    const id = randomUUID();
    const other = await seed(c);
    const a = await recordSaleInTx(c, sale(s, { clientTxId: id }));
    const b = await recordSaleInTx(c, sale(other, { clientTxId: id }));
    expect(a.kind).toBe('created');
    expect(b.kind).toBe('created');
  });

  test('without clientTxId every request is a new sale (backward compatible), receipt numbers run on', async () => {
    const a = await recordSaleInTx(c, sale(s));
    const b = await recordSaleInTx(c, sale(s));
    expect(a.kind === 'created' && b.kind === 'created').toBe(true);
    if (a.kind !== 'created' || b.kind !== 'created') return;
    expect([a.sale.receiptNumber, b.sale.receiptNumber]).toEqual(['R-000001', 'R-000002']);
    expect(await stockOf(c, s.pA)).toBe(1);
    expect(await shiftTotal(c, s.shiftId)).toBe(4000);
  });

  test('missing stock never rejects the sale: stock goes to 0 and a variance row is written', async () => {
    const r = await recordSaleInTx(c, sale(s, { clientTxId: randomUUID() }, 8)); // stock was 5
    expect(r.kind).toBe('created');
    if (r.kind !== 'created') return;
    expect(await stockOf(c, s.pA)).toBe(0);
    expect(r.variances).toHaveLength(1);
    const v = await one<{ expected_qty: string; actual_qty: string; variance_qty: string; reason: string; register_id: string; transaction_id: string }>(c,
      `select expected_qty, actual_qty, variance_qty, reason, register_id, transaction_id from stock_variances where tenant_id=$1`, [s.tenantId]);
    expect(Number(v.expected_qty)).toBe(8);
    expect(Number(v.actual_qty)).toBe(5);
    expect(Number(v.variance_qty)).toBe(-3);
    expect(v.reason).toBe('count_mismatch');
    expect(v.register_id).toBe(s.registerId);
    expect(v.transaction_id).toBe(r.sale.transactionId);
    expect(await shiftTotal(c, s.shiftId)).toBe(8000); // the sale itself stands
  });

  test('variance reasons: offline marker, late arrival, on-time shortage', async () => {
    const reasonFor = async (over: Partial<RecordSaleInput>): Promise<string> => {
      await c.query(`update products set stock_quantity = 1 where product_id=$1`, [s.pA]);
      await c.query(`delete from stock_variances where tenant_id=$1`, [s.tenantId]);
      await recordSaleInTx(c, sale(s, over, 2));
      return (await one<{ reason: string }>(c, `select reason from stock_variances where tenant_id=$1`, [s.tenantId])).reason;
    };
    expect(await reasonFor({ localReceiptRef: 'LOCAL-ABCD1234' })).toBe('oversell_offline');
    expect(await reasonFor({ soldAt: new Date(Date.now() - 15 * 60_000) })).toBe('late_sync');
    expect(await reasonFor({})).toBe('count_mismatch');
  });

  test('stock already 0: variance has actual 0, and the alert is high severity', async () => {
    await c.query(`update products set stock_quantity = 0 where product_id=$1`, [s.pA]);
    const r = await recordSaleInTx(c, sale(s, {}, 2));
    expect(r.kind).toBe('created');
    if (r.kind !== 'created') return;
    expect(r.variances[0]).toMatchObject({ expectedQty: 2, actualQty: 0, varianceQty: -2 });
    await raiseVarianceAlerts(c, { tenantId: s.tenantId, shiftId: s.shiftId, cashierId: s.staffId, transactionId: r.sale.transactionId }, r.variances);
    const a = await one<{ alert_type: string; severity: string; details: { product_id: string; reason: string } }>(c,
      `select alert_type, severity, details from anomaly_alerts where tenant_id=$1`, [s.tenantId]);
    expect(a.alert_type).toBe('stock_variance');
    expect(a.severity).toBe('high');
    expect(a.details.product_id).toBe(s.pA);
  });

  test('untracked and unknown products are not deducted and raise no variance', async () => {
    const lines = [
      { productId: s.pB, quantity: 4, unitPricePiastres: 500, lineTotalPiastres: 2000, taxAmountPiastres: 0 },
      { productId: randomUUID(), quantity: 1, unitPricePiastres: 500, lineTotalPiastres: 500, taxAmountPiastres: 0 },
    ];
    const r = await recordSaleInTx(c, { ...sale(s), lines, canonicalLines: lines.map(normalizeLineItem), grandTotalPiastres: 2500, tenders: [{ method: 'cash', amountPiastres: 2500 }] });
    expect(r.kind).toBe('created');
    expect(await count(c, 'stock_variances', 'tenant_id=$1', [s.tenantId])).toBe(0);
  });

  test('two lines of the same product are summed before the stock check', async () => {
    const lines = [
      { productId: s.pA, quantity: 3, unitPricePiastres: 1000, lineTotalPiastres: 3000, taxAmountPiastres: 0 },
      { productId: s.pA, quantity: 4, unitPricePiastres: 1000, lineTotalPiastres: 4000, taxAmountPiastres: 0 },
    ];
    const r = await recordSaleInTx(c, { ...sale(s), lines, canonicalLines: lines.map(normalizeLineItem), grandTotalPiastres: 7000, tenders: [{ method: 'cash', amountPiastres: 7000 }] });
    expect(r.kind === 'created' && r.variances.length === 1).toBe(true);
    const v = await one<{ expected_qty: string; actual_qty: string }>(c, `select expected_qty, actual_qty from stock_variances where tenant_id=$1`, [s.tenantId]);
    expect([Number(v.expected_qty), Number(v.actual_qty)]).toEqual([7, 5]);
  });

  test('a failure half-way rolls back EVERY write, and the receipt sequence has no gap', async () => {
    // The sale row, shift total and payment row are written before the tender insert fails
    // (amount_piastres must be > 0), so this fails after three real writes.
    await c.query('SAVEPOINT attempt');
    let threw = false;
    try {
      await recordSaleInTx(c, sale(s, { clientTxId: randomUUID(), tenders: [{ method: 'cash', amountPiastres: 0 }] }, 8));
    } catch { threw = true; }
    await c.query('ROLLBACK TO SAVEPOINT attempt');
    expect(threw).toBe(true);
    expect(await count(c, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(0);
    expect(await count(c, 'payment_transactions', 'shift_id=$1', [s.shiftId])).toBe(0);
    expect(await count(c, 'sale_tenders', 'shift_id=$1', [s.shiftId])).toBe(0);
    expect(await count(c, 'stock_variances', 'tenant_id=$1', [s.tenantId])).toBe(0);
    expect(await shiftTotal(c, s.shiftId)).toBe(0);
    expect(await stockOf(c, s.pA)).toBe(5);
    expect(await lastSeq(c, s.tenantId)).toBe(0);
    // The next sale after the failure takes receipt 1, not 2.
    const next = await recordSaleInTx(c, sale(s));
    expect(next.kind === 'created' && next.sale.receiptNumber === 'R-000001').toBe(true);
  });

  test('a failure while writing the variance (late in the sequence) also rolls back the stock change', async () => {
    // Point the shift at a register that does not exist: payment_transactions has no such foreign key,
    // but stock_variances.register_id does, so the variance insert fails AFTER the stock update.
    await c.query(`update shifts set register_id = $1 where shift_id = $2`, [randomUUID(), s.shiftId]);
    await c.query('SAVEPOINT attempt');
    let threw = false;
    try { await recordSaleInTx(c, sale(s, { clientTxId: randomUUID() }, 8)); } catch { threw = true; }
    await c.query('ROLLBACK TO SAVEPOINT attempt');
    expect(threw).toBe(true);
    expect(await count(c, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(0);
    expect(await count(c, 'payment_transactions', 'shift_id=$1', [s.shiftId])).toBe(0);
    expect(await stockOf(c, s.pA)).toBe(5);
    expect(await shiftTotal(c, s.shiftId)).toBe(0);
    expect(await lastSeq(c, s.tenantId)).toBe(0);
  });

  test('closed shift and unknown shift are reported and write nothing', async () => {
    await c.query(`update shifts set status='closed' where shift_id=$1`, [s.shiftId]);
    expect(await recordSaleInTx(c, sale(s))).toEqual({ kind: 'shift_not_open', status: 'closed' });
    expect(await recordSaleInTx(c, sale(s, { shiftId: randomUUID() }))).toEqual({ kind: 'shift_not_found' });
    expect(await count(c, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(0);
    expect(await lastSeq(c, s.tenantId)).toBe(0);
  });
});

/** Removes everything a seed created (committed data, tests below only). */
async function cleanup(s: Seed): Promise<void> {
  await pool.query(`delete from anomaly_alerts where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from stock_variances where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from sale_tenders where shift_id=$1`, [s.shiftId]);
  await pool.query(`delete from payment_transactions where shift_id=$1`, [s.shiftId]);
  await pool.query(`delete from transactions where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from tenant_receipt_counters where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from shifts where shift_id=$1`, [s.shiftId]);
  await pool.query(`delete from products where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from staff where tenant_id=$1`, [s.tenantId]);
  await pool.query(`delete from tenants where id=$1`, [s.tenantId]);
}

describe.skipIf(!dbOk)('recordSale concurrency (real commits on a throwaway tenant, deleted afterwards)', () => {
  test('concurrent identical requests: exactly one sale, one replay', { timeout: 120_000 }, async () => {
    const s = await seed(pool);
    try {
      const input = sale(s, { clientTxId: randomUUID(), deviceId: 'DEV-RACE' });
      const results = await Promise.all([recordSale(pool, input), recordSale(pool, input), recordSale(pool, input)]);
      const kinds = results.map((r) => r.kind).sort();
      expect(kinds).toEqual(['created', 'replayed', 'replayed']);
      const created = results.find((r) => r.kind === 'created');
      for (const r of results) {
        if (r.kind === 'created' || r.kind === 'replayed') expect(r.sale.transactionId).toBe((created as { sale: { transactionId: string } }).sale.transactionId);
      }
      expect(await count(pool, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(1);
      expect(await shiftTotal(pool, s.shiftId)).toBe(2000);
      expect(await stockOf(pool, s.pA)).toBe(3);
      expect(await lastSeq(pool, s.tenantId)).toBe(1);
      expect(await count(pool, 'payment_transactions', 'shift_id=$1', [s.shiftId])).toBe(1);
    } finally {
      await cleanup(s);
    }
  });

  test('concurrent different sales of the same scarce product: all stand, exactly the shortfall is recorded', { timeout: 120_000 }, async () => {
    const s = await seed(pool, 5); // stock 5
    try {
      const sales = [0, 1, 2].map(() => recordSale(pool, sale(s, { clientTxId: randomUUID() }, 2))); // wants 6 in total
      const results = await Promise.all(sales);
      expect(results.every((r) => r.kind === 'created')).toBe(true);
      expect(await stockOf(pool, s.pA)).toBe(0);
      expect(await count(pool, 'transactions', 'tenant_id=$1', [s.tenantId])).toBe(3);
      expect(await shiftTotal(pool, s.shiftId)).toBe(6000);
      const v = (await pool.query<{ variance_qty: string }>(`select variance_qty from stock_variances where tenant_id=$1`, [s.tenantId])).rows;
      expect(v).toHaveLength(1);
      expect(Number(v[0]!.variance_qty)).toBe(-1); // 6 wanted, 5 on hand
      const numbers = results.map((r) => (r.kind === 'created' ? r.sale.receiptNumber : '')).sort();
      expect(numbers).toEqual(['R-000001', 'R-000002', 'R-000003']); // sequential, no gaps
    } finally {
      await cleanup(s);
    }
  });
});
