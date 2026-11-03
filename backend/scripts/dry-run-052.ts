// Dry run of migration 052 and its rollback on the dev database.
// Everything runs inside a transaction that is ALWAYS rolled back: this script never makes a change
// permanent. It refuses to run against any database that is not greengo_dev.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

const url = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
if (!/greengo_dev/.test(url)) { console.error('STOP: refusing to run against a database that is not greengo_dev.'); process.exit(1); }

const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, query_timeout: 300_000 });
let failures = 0;
const ok = (cond: boolean, label: string, extra = ''): void => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};
const colInfo = async (): Promise<{ data_type: string; numeric_precision: number | null; numeric_scale: number | null; is_nullable: string; column_default: string | null }> =>
  (await client.query(`SELECT data_type, numeric_precision, numeric_scale, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='products' AND column_name='stock_quantity'`)).rows[0];
const totals = async (): Promise<string> => {
  const r = (await client.query<{ n: string; s: string }>(`SELECT count(*)::text n, coalesce(sum(stock_quantity),0)::text s FROM products`)).rows[0]!;
  return `${r.n} rows, sum ${r.s}`;
};

await client.connect();
try {
  const before = await colInfo();
  const totalsBefore = await totals();
  console.log('before:', JSON.stringify(before), '|', totalsBefore);
  ok(before.data_type === 'integer', 'starting point: stock_quantity is INTEGER');

  await client.query('BEGIN');

  // ── Lock-impact measurement on a temporary table of realistic size (dropped by the rollback) ───────────────
  console.log('\n== Timing: ALTER TYPE on a temporary copy of the products table');
  await client.query(`CREATE TEMP TABLE bench_products (LIKE products INCLUDING DEFAULTS INCLUDING INDEXES INCLUDING CONSTRAINTS)`);
  const tenant = (await client.query<{ id: string }>(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`)).rows[0]!.id;
  const bench = async (rows: number): Promise<number> => {
    await client.query(`TRUNCATE bench_products`);
    await client.query(
      `INSERT INTO bench_products (tenant_id, name_ar, name_fr, price_cents, stock_quantity, is_weighted, track_stock)
       SELECT $1, 'م', 'bench ' || g, 1000, (random()*1000)::int, (g % 7 = 0), true FROM generate_series(1, $2::int) g`, [tenant, rows]);
    await client.query(`ALTER TABLE bench_products ALTER COLUMN stock_quantity TYPE INTEGER`); // make sure it is integer
    const t0 = performance.now();
    await client.query(`ALTER TABLE bench_products ALTER COLUMN stock_quantity TYPE NUMERIC(14,3) USING stock_quantity::numeric`);
    const ms = performance.now() - t0;
    await client.query(`ALTER TABLE bench_products ALTER COLUMN stock_quantity TYPE INTEGER USING ROUND(stock_quantity)::integer`);
    return ms;
  };
  const sizes = [10_000, 100_000, 300_000];
  const results: Array<[number, number]> = [];
  for (const n of sizes) { const ms = await bench(n); results.push([n, ms]); console.log(`  ${n.toLocaleString('en-US')} rows (5 indexes): ${ms.toFixed(0)} ms`); }
  const per1k = results[results.length - 1]![1] / (results[results.length - 1]![0] / 1000);
  console.log(`  ~${per1k.toFixed(1)} ms per 1,000 rows on this machine => about ${(per1k * 10 / 1000).toFixed(1)} s for 10,000 rows is NOT how to read it: use the per-row rate above x your row count`);
  console.log(`  e.g. 50,000 rows ~ ${(per1k * 50).toFixed(0)} ms, 500,000 rows ~ ${(per1k * 500 / 1000).toFixed(1)} s (all of it under ACCESS EXCLUSIVE)`);
  await client.query(`DROP TABLE bench_products`);

  // ── Apply 052 to the real table ───────────────────────────────────────────────────────────────────────────────
  console.log('\n== Apply 052');
  const t0 = performance.now();
  await client.query(read('migrations/052_products_stock_numeric.sql'));
  console.log(`  052 applied on the dev products table (${totalsBefore.split(',')[0]}) in ${(performance.now() - t0).toFixed(0)} ms`);
  const after = await colInfo();
  ok(after.data_type === 'numeric' && after.numeric_precision === 14 && after.numeric_scale === 3, 'type is now NUMERIC(14,3)', JSON.stringify(after));
  ok(after.is_nullable === 'NO', 'NOT NULL is kept');
  ok(/^0(::numeric)?$/.test(String(after.column_default)), 'DEFAULT 0 is kept', String(after.column_default));
  const totalsAfter = await totals();
  ok(totalsAfter.replace(/\.0+$/, '') === totalsBefore || Number(totalsAfter.split('sum ')[1]) === Number(totalsBefore.split('sum ')[1]), 'existing values are unchanged', `${totalsBefore} -> ${totalsAfter}`);
  const lock = await client.query<{ mode: string }>(
    `SELECT mode FROM pg_locks WHERE pid = pg_backend_pid() AND locktype='relation' AND relation = 'products'::regclass AND mode = 'AccessExclusiveLock'`);
  ok(lock.rows.length === 1, 'the migration holds ACCESS EXCLUSIVE on products until commit (as documented)');

  // ── Decimals are kept and arithmetic is exact ─────────────────────────────────────────────────────────────────
  console.log('\n== Decimals');
  const mk = async (stock: string): Promise<string> => (await client.query<{ product_id: string }>(
    `INSERT INTO products (tenant_id, name_ar, name_fr, price_cents, is_weighted, uom, stock_quantity, track_stock)
     VALUES ($1,'م','dry52',1000,true,'kg',$2,true) RETURNING product_id`, [tenant, stock])).rows[0]!.product_id;
  const stockOf = async (id: string): Promise<string> => (await client.query<{ s: string }>(`SELECT stock_quantity::text s FROM products WHERE product_id=$1`, [id])).rows[0]!.s;
  const pA = await mk('5000'), pB = await mk('5000'), pC = await mk('1');
  for (const q of [1.2, 0.4, 2.5]) {
    await client.query(`UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1::numeric, 0) WHERE product_id=$2`, [q, pA]); // record-sale.ts form
    await client.query(`UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1, 0) WHERE product_id=$2`, [q, pB]);          // old form, no cast
  }
  ok((await stockOf(pA)) === '4995.900', 'GREATEST(stock - $1::numeric, 0): 5000 - 1.2 - 0.4 - 2.5 = 4995.900 exactly', await stockOf(pA));
  ok((await stockOf(pB)) === '4995.900', 'the UNCAST form also works now (no 22P02): 4995.900', await stockOf(pB));
  await client.query(`UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1::numeric, 0) WHERE product_id=$2`, [2.5, pC]);
  ok((await stockOf(pC)) === '0.000', 'a shortfall still clamps at zero: 1 - 2.5 = 0.000', await stockOf(pC));
  await client.query(`UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id=$2`, [12.5, pC]);
  ok((await stockOf(pC)) === '12.500', 'supplier-style "stock_quantity + $1" with a fractional kg quantity works: 12.500', await stockOf(pC));
  const raw = (await client.query<{ a: unknown; b: unknown }>(`SELECT stock_quantity AS a, stock_quantity::float8 AS b FROM products WHERE product_id=$1`, [pA])).rows[0]!;
  ok(typeof raw.a === 'string' && typeof raw.b === 'number', 'pg returns NUMERIC as a STRING; ::float8 gives a number (clients need the cast)', `typeof plain=${typeof raw.a}, typeof ::float8=${typeof raw.b}`);

  // ── Rollback SQL ──────────────────────────────────────────────────────────────────────────────────────────────
  console.log('\n== Rollback SQL (precision is lost, as documented)');
  await client.query(read('migrations/rollback/052_rollback.sql'));
  const rolled = await colInfo();
  ok(rolled.data_type === 'integer', 'rollback SQL returns the column to INTEGER', rolled.data_type);
  ok((await stockOf(pA)) === '4996', 'rollback rounds decimals: 4995.900 becomes 4996', await stockOf(pA));

  await client.query('ROLLBACK');
  const end = await colInfo();
  ok(end.data_type === 'integer' && (await totals()) === totalsBefore, 'everything rolled back: column is INTEGER and the table is exactly as before', `${end.data_type} | ${await totals()}`);
  const leftovers = (await client.query<{ n: string }>(`SELECT count(*)::text n FROM products WHERE name_fr = 'dry52'`)).rows[0]!.n;
  ok(leftovers === '0', 'no dry-run products left');
} catch (e) {
  failures++;
  console.error('FAILED:', e instanceof Error ? e.message : String(e));
  await client.query('ROLLBACK').catch(() => undefined);
} finally {
  await client.end().catch(() => undefined);
}
console.log(failures === 0 ? '\nDRY RUN OK: all checks passed, nothing was applied.' : `\nDRY RUN FAILED: ${failures} check(s) failed. Nothing was applied.`);
process.exit(failures === 0 ? 0 : 1);
