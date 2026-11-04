/**
 * GET /stock-variances and PATCH /stock-variances/:id/acknowledge.
 *
 * - parseVarianceQuery tests are pure and always run.
 * - The route tests run against the dev PostgreSQL (greengo_dev) and are skipped when it is unreachable.
 *   Every one runs in a transaction that is ALWAYS rolled back, with the REAL auth middleware and signed
 *   tokens, so the role rules and the tenant-from-token rule are exercised for real.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { authMiddleware } from '../../../middleware/index';
import { parseVarianceQuery, stockVarianceRoutes } from '../stock-variance-routes';

const URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
const pool = new pg.Pool({ connectionString: URL, max: 2, connectionTimeoutMillis: 8_000, query_timeout: 60_000 });
async function reachable(): Promise<boolean> {
  if (!/greengo_dev/.test(URL)) return false; // never run against anything else
  try { await pool.query('select 1'); return true; } catch { return false; }
}
const dbOk = await reachable();
afterAll(async () => { await pool.end(); });

/** Wording that would show a database error reached the client. */
const DB_LEAK = [/duplicate key/i, /violates/i, /foreign key/i, /null value in column/i, /relation "/i, /column "/i, /detail:/i, /constraint/i, /syntax error/i];
const assertNoDbText = (body: unknown): void => {
  const text = JSON.stringify(body);
  for (const pat of DB_LEAK) expect(text, `body must not match ${pat}`).not.toMatch(pat);
};

// ── Pure: query parsing ─────────────────────────────────────────────────────────────────────────
describe('parseVarianceQuery', () => {
  const ok = (q: Record<string, unknown>) => {
    const r = parseVarianceQuery(q);
    if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
    return r.value;
  };
  const err = (q: Record<string, unknown>) => {
    const r = parseVarianceQuery(q);
    return r.ok ? 'ok' : r.error;
  };

  test('defaults: both statuses, limit 50, offset 0', () => {
    expect(ok({})).toEqual({ acknowledged: undefined, product: undefined, from: undefined, toExclusive: undefined, limit: 50, offset: 0 });
  });

  test('acknowledged accepts only true or false', () => {
    expect(ok({ acknowledged: 'true' }).acknowledged).toBe(true);
    expect(ok({ acknowledged: 'false' }).acknowledged).toBe(false);
    for (const bad of ['yes', '1', 'TRUE', '', ['true', 'false']]) expect(err({ acknowledged: bad })).toBe('invalid_acknowledged');
  });

  test('product must be a UUID', () => {
    expect(ok({ product: '5B0F6D8E-2F4B-4C1A-9D3E-7A1B2C3D4E5F' }).product).toBe('5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f');
    for (const bad of ['abc', "x' OR 1=1 --", '', ['a']]) expect(err({ product: bad })).toBe('invalid_product');
  });

  test('a date alone is a whole UTC day; "to" includes that day', () => {
    const v = ok({ from: '2026-11-04', to: '2026-11-04' });
    expect(v.from?.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    expect(v.toExclusive?.toISOString()).toBe('2026-11-05T00:00:00.000Z');
  });

  test('a timestamp must carry a time zone; "to" includes its own instant', () => {
    const v = ok({ from: '2026-11-04T09:30:00+01:00', to: '2026-11-04T12:00:00Z' });
    expect(v.from?.toISOString()).toBe('2026-11-04T08:30:00.000Z');
    expect(v.toExclusive?.toISOString()).toBe('2026-11-04T12:00:00.001Z');
  });

  test('bad or impossible dates and a reversed range are refused', () => {
    for (const bad of ['yesterday', '2026-02-30', '2026-13-01', '2026-11-04T10:00:00', '04/11/2026', '', ['2026-11-04']]) {
      expect(err({ from: bad }), String(bad)).toBe('invalid_date');
    }
    expect(err({ from: '2026-11-05', to: '2026-11-04' })).toBe('invalid_date');
  });

  test('limit is 1..200 and offset is 0..1,000,000, whole numbers only', () => {
    expect(ok({ limit: '200', offset: '40' })).toMatchObject({ limit: 200, offset: 40 });
    for (const bad of ['0', '201', '-1', '1.5', 'abc', '1e2', '']) expect(err({ limit: bad }), bad).toBe('invalid_limit');
    for (const bad of ['-1', '1000001', '2.5', 'x']) expect(err({ offset: bad }), bad).toBe('invalid_offset');
  });
});

// ── Routes against the dev database ──────────────────────────────────────────────────────────────
describe.skipIf(!dbOk)('stock variance routes', () => {
  let c: pg.PoolClient;
  let app: FastifyInstance;

  let T: string;          // the caller's tenant
  let OTHER: string;      // another tenant
  let M: string;          // manager of T (real staff row)
  let M2: string;         // second manager of T
  let P1: string;         // weighted product (kg)
  let P2: string;         // unit product
  let REG: string;
  let v1: string;         // open, 3 h ago, P1
  let v2: string;         // open, 1 h ago, P2
  let v3: string;         // acknowledged by M, 1 min ago, P1
  let vOther: string;     // belongs to OTHER

  const ago = (ms: number): string => new Date(Date.now() - ms).toISOString();
  const HOUR = 3_600_000;

  const token = (role: string, over: { tenant?: string; staff?: string } = {}): string =>
    app.jwt.sign({ tenant_id: over.tenant ?? T, staff_id: over.staff ?? M, role });
  const as = (role: string, over: { tenant?: string; staff?: string } = {}) =>
    ({ authorization: `Bearer ${token(role, over)}` });
  const get = (qs = '', role = 'MANAGER') =>
    app.inject({ method: 'GET', url: `/stock-variances${qs}`, headers: as(role) });
  const ack = (id: string, role = 'MANAGER', over: { tenant?: string; staff?: string } = {}) =>
    app.inject({ method: 'PATCH', url: `/stock-variances/${id}/acknowledge`, headers: as(role, over) });
  const q = async <R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, p: unknown[] = []) => (await c.query<R>(sql, p)).rows;

  beforeEach(async () => {
    c = await pool.connect();
    await c.query('BEGIN');
    T = randomUUID(); OTHER = randomUUID(); M = randomUUID(); M2 = randomUUID();
    P1 = randomUUID(); P2 = randomUUID(); REG = randomUUID();
    v1 = randomUUID(); v2 = randomUUID(); v3 = randomUUID(); vOther = randomUUID();
    const store = randomUUID(); const storeO = randomUUID(); const POther = randomUUID();

    for (const [id, slug] of [[T, 'a'], [OTHER, 'b']] as const) {
      await c.query(`INSERT INTO tenants (id, name, slug, digest_enabled) VALUES ($1,'sv-test',$2,false)`, [id, `sv-${slug}-${id.slice(0, 8)}`]);
    }
    await c.query(`INSERT INTO stores (store_id, tenant_id, name_ar, name_fr) VALUES ($1,$2,'م','S'), ($3,$4,'م','S')`, [store, T, storeO, OTHER]);
    await c.query(`INSERT INTO registers (register_id, store_id, tenant_id, name) VALUES ($1,$2,$3,'Caisse 1')`, [REG, store, T]);
    for (const id of [M, M2]) {
      await c.query(`INSERT INTO staff (staff_id, tenant_id, name_ar, name_fr, role, pin_hash) VALUES ($1,$2,'مدير','Manager','MANAGER','x')`, [id, T]);
    }
    await c.query(`INSERT INTO products (product_id, tenant_id, name_ar, name_fr, price_cents, is_weighted, uom, stock_quantity, track_stock) VALUES ($1,$2,'تفاح','Pomme',1000,true,'kg',0,true)`, [P1, T]);
    await c.query(`INSERT INTO products (product_id, tenant_id, name_ar, name_fr, price_cents, stock_quantity, track_stock) VALUES ($1,$2,'خبز','Pain',200,0,true)`, [P2, T]);
    await c.query(`INSERT INTO products (product_id, tenant_id, name_ar, name_fr, price_cents, stock_quantity, track_stock) VALUES ($1,$2,'م','Autre',100,0,true)`, [POther, OTHER]);

    const insertVar = (id: string, tenant: string, product: string, exp: string, act: string, reason: string, detected: string, ackBy: string | null, ackAt: string | null) =>
      c.query(
        `INSERT INTO stock_variances (variance_id, tenant_id, product_id, register_id, expected_qty, actual_qty, reason, detected_at, acknowledged_by, acknowledged_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9,$10::timestamptz)`,
        [id, tenant, product, tenant === T ? REG : null, exp, act, reason, detected, ackBy, ackAt]);
    await insertVar(v1, T, P1, '5000', '4995.9', 'oversell_online', ago(3 * HOUR), null, null);
    await insertVar(v2, T, P2, '3', '1', 'late_sync', ago(1 * HOUR), null, null);
    await insertVar(v3, T, P1, '2', '0', 'oversell_offline', ago(60_000), M, ago(30_000));
    await insertVar(vOther, OTHER, POther, '9', '1', 'oversell_online', ago(2 * HOUR), null, null);

    app = Fastify();
    const runner = { query: c.query.bind(c), connect: async () => ({ query: c.query.bind(c), release: () => undefined }) };
    app.decorate('pg', runner as never);
    await app.register(jwt, { secret: 'test-secret-not-for-production' });
    await authMiddleware(app);
    await app.register(stockVarianceRoutes);
  });
  afterEach(async () => {
    await app?.close();
    await c.query('ROLLBACK').catch(() => undefined);
    c.release();
  });

  // ── access ──
  test('no token is 401; a cashier is 403; manager, supervisor and owner are allowed', async () => {
    expect((await app.inject({ method: 'GET', url: '/stock-variances' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: `/stock-variances/${v1}/acknowledge` })).statusCode).toBe(401);
    expect((await get('', 'CASHIER')).statusCode).toBe(403);
    expect((await ack(v1, 'CASHIER')).statusCode).toBe(403);
    for (const role of ['MANAGER', 'SUPERVISOR', 'OWNER']) expect((await get('', role)).statusCode, role).toBe(200);
    // The forbidden attempt changed nothing.
    expect((await q(`SELECT acknowledged_at FROM stock_variances WHERE variance_id=$1`, [v1]))[0]!['acknowledged_at']).toBeNull();
  });

  // ── list ──
  test('lists this tenant only: another tenant never appears, and a tenant in the query string is ignored', async () => {
    const res = await get(`?tenant_id=${OTHER}&tenantId=${OTHER}`);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ variance_id: string }>; total: number };
    expect(body.total).toBe(3);
    expect(body.items.map((i) => i.variance_id)).not.toContain(vOther);
    // The same call as the other tenant's manager sees only its own row.
    const mine = await app.inject({ method: 'GET', url: '/stock-variances', headers: as('MANAGER', { tenant: OTHER }) });
    expect((mine.json() as { items: Array<{ variance_id: string }> }).items.map((i) => i.variance_id)).toEqual([vOther]);
  });

  test('unacknowledged first (newest first), then acknowledged', async () => {
    const body = (await get()).json() as { items: Array<{ variance_id: string; acknowledged_at: string | null }> };
    expect(body.items.map((i) => i.variance_id)).toEqual([v2, v1, v3]);
    expect(body.items.map((i) => i.acknowledged_at !== null)).toEqual([false, false, true]);
  });

  test('every field the page needs, with real numbers', async () => {
    const body = (await get(`?product=${P1}&acknowledged=false`)).json() as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    const row = body.items[0]!;
    expect(row).toMatchObject({
      variance_id: v1, product_id: P1, product_name_ar: 'تفاح', product_name_fr: 'Pomme', uom: 'kg', is_weighted: true,
      expected_qty: 5000, actual_qty: 4995.9, variance_qty: -4.1, missing_qty: 4.1,
      reason: 'oversell_online', register_id: REG, register_name: 'Caisse 1', acknowledged_by: null, acknowledged_at: null,
    });
    for (const k of ['expected_qty', 'actual_qty', 'variance_qty', 'missing_qty']) expect(typeof row[k], k).toBe('number');
    expect(typeof row['detected_at']).toBe('string');
  });

  test('an acknowledged row carries who acknowledged it', async () => {
    const row = ((await get('?acknowledged=true')).json() as { items: Array<Record<string, unknown>> }).items[0]!;
    expect(row).toMatchObject({ variance_id: v3, acknowledged_by: M, acknowledged_by_name_fr: 'Manager' });
    expect(row['acknowledged_at']).not.toBeNull();
  });

  test('filters: acknowledged, product, date range', async () => {
    const ids = async (qs: string) => ((await get(qs)).json() as { items: Array<{ variance_id: string }> }).items.map((i) => i.variance_id);
    expect(await ids('?acknowledged=false')).toEqual([v2, v1]);
    expect(await ids('?acknowledged=true')).toEqual([v3]);
    expect(await ids(`?product=${P1}`)).toEqual([v1, v3]);
    expect(await ids(`?from=${encodeURIComponent(ago(2 * HOUR))}`)).toEqual([v2, v3]);
    expect(await ids(`?to=${encodeURIComponent(ago(2 * HOUR))}`)).toEqual([v1]);
    expect(await ids(`?from=${encodeURIComponent(ago(2 * HOUR))}&to=${encodeURIComponent(ago(30 * 60_000))}`)).toEqual([v2]);
  });

  test('limit and offset page through the same order; total is the full count', async () => {
    const page = async (qs: string) => (await get(qs)).json() as { items: Array<{ variance_id: string }>; total: number; limit: number; offset: number };
    expect((await page('?limit=1&offset=0')).items.map((i) => i.variance_id)).toEqual([v2]);
    const second = await page('?limit=1&offset=1');
    expect(second.items.map((i) => i.variance_id)).toEqual([v1]);
    expect(second).toMatchObject({ total: 3, limit: 1, offset: 1 });
    expect((await page('?limit=1&offset=3')).items).toEqual([]);
  });

  test('bad parameters are fixed codes with no database text', async () => {
    const cases: Array<[string, string]> = [
      ['?acknowledged=maybe', 'invalid_acknowledged'],
      ['?product=not-a-uuid', 'invalid_product'],
      ["?product=x'%20OR%201=1", 'invalid_product'],
      ['?from=garbage', 'invalid_date'],
      ['?limit=0', 'invalid_limit'],
      ['?limit=1000', 'invalid_limit'],
      ['?offset=-1', 'invalid_offset'],
    ];
    for (const [qs, code] of cases) {
      const res = await get(qs);
      expect(res.statusCode, qs).toBe(400);
      expect(res.json(), qs).toEqual({ error: code });
      assertNoDbText(res.json());
    }
  });

  // ── acknowledge ──
  test('acknowledging records the caller from the token, not from the body', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/stock-variances/${v1}/acknowledge`, headers: as('MANAGER', { staff: M }),
      payload: { acknowledged_by: M2, acknowledgedBy: M2, staff_id: M2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ variance_id: v1, acknowledged_by: M, already_acknowledged: false });
    const row = (await q(`SELECT acknowledged_by, acknowledged_at FROM stock_variances WHERE variance_id=$1`, [v1]))[0]!;
    expect(row['acknowledged_by']).toBe(M);
    expect(row['acknowledged_at']).not.toBeNull();
  });

  test('it is idempotent: a second call (even by someone else) changes nothing and adds no second audit row', async () => {
    const first = (await ack(v1, 'MANAGER', { staff: M })).json() as { acknowledged_at: string };
    const second = await ack(v1, 'SUPERVISOR', { staff: M2 });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ variance_id: v1, acknowledged_by: M, already_acknowledged: true });
    expect(new Date((second.json() as { acknowledged_at: string }).acknowledged_at).getTime()).toBe(new Date(first.acknowledged_at).getTime());
    const audit = await q(`SELECT 1 FROM audit_log WHERE tenant_id=$1 AND event_type='stock_variance' AND metadata->>'variance_id'=$2`, [T, v1]);
    expect(audit).toHaveLength(1);
  });

  test('acknowledging an already acknowledged row (from the seed) is a no-op that reports the original', async () => {
    const res = await ack(v3, 'MANAGER', { staff: M2 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ acknowledged_by: M, already_acknowledged: true });
    expect(await q(`SELECT 1 FROM audit_log WHERE tenant_id=$1 AND metadata->>'variance_id'=$2`, [T, v3])).toHaveLength(0);
  });

  test('the audit row names the actor and the variance, and nothing sensitive', async () => {
    await ack(v1, 'MANAGER', { staff: M });
    const rows = await q<{ event_type: string; action: string; actor_id: string; register_id: string; metadata: Record<string, unknown> }>(
      `SELECT event_type, action, actor_id, register_id, metadata FROM audit_log WHERE tenant_id=$1 AND metadata->>'variance_id'=$2`, [T, v1]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event_type: 'stock_variance', action: 'acknowledge', actor_id: M, register_id: REG });
    expect(rows[0]!.metadata).toEqual({ variance_id: v1, product_id: P1 });
  });

  test("another tenant's variance is 404 and stays untouched", async () => {
    const res = await ack(vOther);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'variance_not_found' });
    expect((await q(`SELECT acknowledged_at FROM stock_variances WHERE variance_id=$1`, [vOther]))[0]!['acknowledged_at']).toBeNull();
    expect(await q(`SELECT 1 FROM audit_log WHERE metadata->>'variance_id'=$1`, [vOther])).toHaveLength(0);
  });

  test('a bad id is 400 invalid_id and an unknown id is 404, both with fixed codes', async () => {
    const bad = await ack('not-a-uuid');
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'invalid_id' });
    const unknown = await ack(randomUUID());
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'variance_not_found' });
    assertNoDbText(bad.json());
    assertNoDbText(unknown.json());
  });

  test('a database failure becomes a fixed internal_error with no database text', async () => {
    // A token whose staff id has no staff row: acknowledged_by violates its foreign key.
    const res = await ack(v1, 'MANAGER', { staff: randomUUID() });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal_error' });
    assertNoDbText(res.json());
  });
});
