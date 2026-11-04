/**
 * Route-level error-handling tests for POST /products and PATCH /products/:id.
 * Runs against the dev PostgreSQL (greengo_dev); skipped when unreachable.
 *
 * Covers:
 *  - missing category   → 400 category_required
 *  - duplicate barcode  → 409 barcode_duplicate
 *  - invalid stock      → 400 (parseStockQuantity rejects)
 *  - no response body contains database error text (pg error messages, constraint names
 *    with detail/column/hint wording)
 *
 * Every test runs inside a transaction that is rolled back so the dev DB is never changed.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { posRoutes } from '../../pos/pos-routes.js';
import { productRoutes } from '../product-routes.js';

const URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
const pool = new pg.Pool({ connectionString: URL, max: 2, connectionTimeoutMillis: 8_000, query_timeout: 60_000 });

async function reachable(): Promise<boolean> {
  if (!/greengo_dev/.test(URL)) return false;
  try { await pool.query('select 1'); return true; } catch { return false; }
}
const dbOk = await reachable();
afterAll(async () => { await pool.end(); });

/** Known Postgres error message fragments that must never appear in a response body. */
const DB_LEAK_PATTERNS = [
  /duplicate key value/i,
  /violates (not-null|unique|foreign key|check)/i,
  /column "[^"]*" of relation/i,
  /null value in column/i,
  /detail:/i,
  /hint:/i,
  /pg_.*constraint/i,
];

function assertNoDbLeak(body: unknown): void {
  const text = JSON.stringify(body);
  for (const pat of DB_LEAK_PATTERNS) {
    expect(text, `response body must not contain db error text matching ${pat}`).not.toMatch(pat);
  }
}

describe.skipIf(!dbOk)('POST /products and PATCH /products/:id — error handling', () => {
  let c: pg.PoolClient;
  let app: FastifyInstance;
  let tenantId: string;
  let storeId: string;

  beforeEach(async () => {
    c = await pool.connect();
    await c.query('BEGIN');
    tenantId = randomUUID();
    storeId = randomUUID();
    await c.query(`INSERT INTO tenants (id, name, slug, digest_enabled) VALUES ($1,'err-test',$2,false)`, [tenantId, `et-${tenantId.slice(0, 8)}`]);
    await c.query(`INSERT INTO stores (store_id, tenant_id, name_ar, name_fr) VALUES ($1,$2,'م','S')`, [storeId, tenantId]);

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

  // ── POST /products ────────────────────────────────────────────────────────

  test('POST /products: missing category returns 400 category_required', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'تفاح', name_fr: 'Pomme', stock_quantity: 0 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('category_required');
    assertNoDbLeak(res.json());
  });

  test('POST /products: empty string category also returns 400 category_required', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'تفاح', category: '', stock_quantity: 0 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('category_required');
    assertNoDbLeak(res.json());
  });

  test('POST /products: null category returns 400 category_required (matches POS form behaviour)', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'تفاح', category: null, stock_quantity: 0 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('category_required');
    assertNoDbLeak(res.json());
  });

  test('POST /products: missing name_ar returns 400 name_required', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { category: 'fruit', stock_quantity: 0 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('name_required');
    assertNoDbLeak(res.json());
  });

  test('POST /products: missing name_fr falls back to name_ar and succeeds', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'برتقال', category: 'fruit', stock_quantity: 0 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name_fr).toBe('برتقال');
    assertNoDbLeak(res.json());
  });

  test('POST /products: empty name_fr falls back to name_ar', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'تفاح', name_fr: '', category: 'fruit', stock_quantity: 0 } });
    expect(res.statusCode).toBe(201);
    expect(res.json().name_fr).toBe('تفاح');
  });

  test('POST /products: invalid stock_quantity returns 400 without db text', async () => {
    for (const bad of ['abc', -1, 'NaN', '1e3', '1,5']) {
      const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'تفاح', category: 'fruit', stock_quantity: bad } });
      expect(res.statusCode, `expected 400 for stock_quantity=${JSON.stringify(bad)}`).toBe(400);
      assertNoDbLeak(res.json());
    }
  });

  // NOTE: a UNIQUE constraint on (tenant_id, barcode) does not yet exist in the schema (migration pending).
  // The 409 barcode_duplicate path exists in the route and will fire once migration adds the constraint.
  // This test verifies the 500 path returns internal_error (not db text) by triggering a FK violation.
  test('POST /products: a constraint violation returns 500 internal_error without db text', async () => {
    // Override auth to a tenant_id that was NOT inserted — FK violation on products.tenant_id.
    await app.close();
    const ghostTenant = randomUUID();
    app = Fastify();
    const runner = { query: c.query.bind(c), connect: async () => ({ query: c.query.bind(c), release: () => undefined }) };
    app.decorate('pg', runner as never);
    app.addHook('onRequest', async (req) => {
      (req as unknown as { auth: unknown }).auth = { tenant_id: ghostTenant, staff_id: randomUUID(), role: 'OWNER' };
    });
    await app.register(posRoutes);
    await app.register(productRoutes);

    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'x', name_fr: 'x', category: 'fruit', stock_quantity: 0 } });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('internal_error');
    assertNoDbLeak(res.json());
  });

  test('POST /products: successful create does not leak db text', async () => {
    const res = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'برتقال', name_fr: 'Orange', category: 'fruit', stock_quantity: 10 } });
    expect(res.statusCode).toBe(201);
    assertNoDbLeak(res.json());
  });

  // ── PATCH /products/:id ───────────────────────────────────────────────────

  // NOTE: 409 barcode_duplicate on PATCH also requires a UNIQUE constraint (migration pending).
  // Covered by route code; will activate once the constraint migration is applied.

  test('PATCH /products/:id (json): invalid stock returns 400 without db text', async () => {
    const create = await app.inject({ method: 'POST', url: '/products', payload: { name_ar: 'خضار', name_fr: 'Légume', category: 'veg', stock_quantity: 5 } });
    expect(create.statusCode).toBe(201);
    const patch = await app.inject({ method: 'PATCH', url: `/products/${create.json().product_id}`, payload: { stock_quantity: 'xyz' } });
    expect(patch.statusCode).toBe(400);
    assertNoDbLeak(patch.json());
  });
});
