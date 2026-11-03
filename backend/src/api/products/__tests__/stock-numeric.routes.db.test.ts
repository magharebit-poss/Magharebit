/**
 * Route-level tests for NUMERIC stock, against the dev PostgreSQL (greengo_dev). Skipped when unreachable.
 *
 * The real routes run on a single connection inside a transaction, then everything is ROLLED BACK.
 * Two modes, so the code is proven safe to ship BEFORE the migration as well as after it:
 *   default                      the DRAFT migration 052 is applied inside the transaction: the column is
 *                                NUMERIC(14,3) and pg returns strings (the case the casts exist for);
 *   STOCK_TEST_PRE052=1          052 is NOT applied: the column is still INTEGER, values are whole.
 * In both modes every route must return stock_quantity as a JSON number. Applying 052 takes ACCESS EXCLUSIVE
 * on products until the rollback, for a moment. The dev database is never changed.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { posRoutes } from '../../pos/pos-routes';
import { productRoutes } from '../product-routes';

const URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
const pool = new pg.Pool({ connectionString: URL, max: 2, connectionTimeoutMillis: 8_000, query_timeout: 60_000 });
async function reachable(): Promise<boolean> {
  if (!/greengo_dev/.test(URL)) return false;
  try { await pool.query('select 1'); return true; } catch { return false; }
}
const dbOk = await reachable();
afterAll(async () => { await pool.end(); });

const PRE_052 = process.env['STOCK_TEST_PRE052'] === '1';
// Values that exist in the column in each mode (INTEGER cannot hold decimals).
const V = PRE_052
  ? { seed: '4996', num: 4996, rawText: undefined, patch: 12, patchText: '12', create: 2, createText: '2' }
  : { seed: '4995.9', num: 4995.9, rawText: '4995.900', patch: 12.345, patchText: '12.345', create: 2.5, createText: '2.500' };

describe.skipIf(!dbOk)(`stock_quantity is a JSON number from every route (${PRE_052 ? 'column still INTEGER, before 052' : 'column NUMERIC(14,3), after 052'})`, () => {
  let c: pg.PoolClient;
  let app: FastifyInstance;
  let tenantId: string;
  let weighted: string;   // 4995.900 kg
  let empty: string;      // 0.000
  let storeId: string;

  beforeEach(async () => {
    c = await pool.connect();
    await c.query('BEGIN');
    if (!PRE_052) await c.query(readFileSync(resolve(process.cwd(), 'migrations/052_products_stock_numeric.sql'), 'utf8'));
    tenantId = randomUUID();
    weighted = randomUUID();
    empty = randomUUID();
    storeId = randomUUID();
    await c.query(`INSERT INTO tenants (id, name, slug, digest_enabled) VALUES ($1,'route-test',$2,false)`, [tenantId, `rt-${tenantId.slice(0, 8)}`]);
    await c.query(`INSERT INTO stores (store_id, tenant_id, name_ar, name_fr) VALUES ($1,$2,'م','S')`, [storeId, tenantId]);
    const ins = (id: string, stock: string): Promise<unknown> => c.query(
      `INSERT INTO products (product_id, tenant_id, name_ar, name_fr, price_cents, is_weighted, uom, stock_quantity, track_stock)
       VALUES ($1,$2,'م','P',1000,true,'kg',$3,true)`, [id, tenantId, stock]);
    await ins(weighted, V.seed);
    await ins(empty, '0');

    // The real route plugins on the transaction's connection. Auth is faked the same way as the staff route tests.
    app = Fastify();
    const runner = { query: c.query.bind(c), connect: async () => ({ query: c.query.bind(c), release: () => undefined }) };
    app.decorate('pg', runner as never);
    app.addHook('onRequest', async (req) => {
      (req as unknown as { auth: unknown }).auth = { tenant_id: tenantId, staff_id: randomUUID(), role: 'OWNER' };
    });
    await app.register(posRoutes);
    await app.register(productRoutes);
  });
  afterEach(async () => {
    await app?.close();
    await c.query('ROLLBACK').catch(() => undefined);
    c.release();
  });

  const find = <T extends { product_id: string }>(rows: T[], id: string): T => rows.find((r) => r.product_id === id)!;

  test('sanity: the column type is what this mode says (NUMERIC gives a string from a plain SELECT, INTEGER a number)', async () => {
    const raw = (await c.query(`select stock_quantity from products where product_id=$1`, [weighted])).rows[0];
    if (PRE_052) {
      expect(typeof raw.stock_quantity).toBe('number');
    } else {
      expect(typeof raw.stock_quantity).toBe('string');
      expect(raw.stock_quantity).toBe(V.rawText);
    }
  });

  test('GET /products (the POS catalogue): numbers, and a strict "=== 0" check works', async () => {
    const res = await app.inject({ method: 'GET', url: '/products' });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<{ product_id: string; stock_quantity: unknown }>;
    expect(find(rows, weighted).stock_quantity).toBe(V.num);
    expect(typeof find(rows, weighted).stock_quantity).toBe('number');
    expect(find(rows, empty).stock_quantity === 0).toBe(true);
  });

  test('GET /products/manage and GET /products/:id: numbers', async () => {
    const list = await app.inject({ method: 'GET', url: '/products/manage' });
    expect(list.statusCode).toBe(200);
    expect(find(list.json() as Array<{ product_id: string; stock_quantity: unknown }>, weighted).stock_quantity).toBe(V.num);
    const one = await app.inject({ method: 'GET', url: `/products/${weighted}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().stock_quantity).toBe(V.num);
    expect(typeof one.json().stock_quantity).toBe('number');
  });

  test('POST /products: a fractional stock is stored exactly and returned as a number', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'جديد', name_fr: 'New', category: 'fruit', stock_quantity: V.create, uom: 'kg', is_weighted: true, track_stock: true } });
    expect(res.statusCode).toBe(201);
    expect(res.json().stock_quantity).toBe(V.create);
    expect(typeof res.json().stock_quantity).toBe('number');
    const stored = (await c.query(`select stock_quantity::text s from products where product_id=$1`, [res.json().product_id])).rows[0].s;
    expect(stored).toBe(V.createText);
  });

  test('POST /products rejects a bad stock_quantity with 400 and writes nothing', async () => {
    const before = (await c.query(`select count(*)::int n from products where tenant_id=$1`, [tenantId])).rows[0].n;
    for (const bad of ['abc', -1, 'NaN']) {
      const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'x', stock_quantity: bad } });
      expect(res.statusCode).toBe(400);
    }
    expect((await c.query(`select count(*)::int n from products where tenant_id=$1`, [tenantId])).rows[0].n).toBe(before);
  });

  test('PATCH /products/:id (JSON): decimals are stored exactly, the response is a number (RETURNING *)', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/products/${weighted}`, payload: { stock_quantity: V.patch } });
    expect(res.statusCode).toBe(200);
    expect(res.json().stock_quantity).toBe(V.patch);
    expect(typeof res.json().stock_quantity).toBe('number');
    expect((await c.query(`select stock_quantity::text s from products where product_id=$1`, [weighted])).rows[0].s).toBe(V.patchText);
  });

  test('PATCH /products/:id: an invalid or negative stock_quantity is a 400 and the stock is untouched', async () => {
    for (const bad of ['abc', -5, 'x1']) {
      const res = await app.inject({ method: 'PATCH', url: `/products/${weighted}`, payload: { stock_quantity: bad } });
      expect(res.statusCode).toBe(400);
    }
    expect((await c.query(`select stock_quantity::text s from products where product_id=$1`, [weighted])).rows[0].s).toBe(PRE_052 ? '4996' : '4995.900');
  });

  test('GET /branches/stock-comparison: the top-level stock_quantity is a number', async () => {
    const res = await app.inject({ method: 'GET', url: '/branches/stock-comparison' });
    expect(res.statusCode).toBe(200);
    const rows = res.json() as Array<{ product_id: string; stock_quantity: unknown; stores: Array<{ stock: unknown }> }>;
    const row = find(rows, weighted);
    expect(row.stock_quantity).toBe(V.num);
    expect(typeof row.stock_quantity).toBe('number');
    expect(Number(row.stores[0]!.stock)).toBe(V.num);
  });
});
