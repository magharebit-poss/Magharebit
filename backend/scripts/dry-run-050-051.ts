// Dry run of migrations 050 and 051 and their rollbacks on the dev database.
// Everything runs inside transactions that are ALWAYS rolled back: this script never makes a change
// permanent. It refuses to run against any database that is not greengo_dev.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8');

const url = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';
if (!/greengo_dev/.test(url)) { console.error('STOP: refusing to run against a database that is not greengo_dev.'); process.exit(1); }

const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, query_timeout: 60_000 });
let failures = 0;
const ok = (cond: boolean, label: string, extra = ''): void => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

/** Run a statement that must fail with the given SQLSTATE; the savepoint keeps the transaction usable. */
async function expectError(label: string, code: string, sql: string, params: unknown[] = []): Promise<void> {
  await client.query('SAVEPOINT s');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT s');
    ok(false, label, 'expected an error but the statement succeeded');
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT s');
    await client.query('RELEASE SAVEPOINT s');
    const got = (e as { code?: string }).code;
    ok(got === code, label, `(SQLSTATE ${got}, expected ${code})`);
  }
}

const objects = async (): Promise<string> => {
  const r = await client.query<{ what: string }>(
    `SELECT 'col:' || column_name AS what FROM information_schema.columns
       WHERE table_schema='public' AND table_name='transactions' AND column_name IN ('client_tx_id','device_id','local_receipt_ref')
     UNION ALL SELECT 'table:' || table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='stock_variances'
     UNION ALL SELECT 'index:' || indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN
       ('idx_transactions_client_tx_per_tenant','idx_stock_variances_tenant_detected','idx_stock_variances_unacknowledged')
     ORDER BY 1`);
  return r.rows.map((x) => x.what).join(', ') || '(none)';
};

await client.connect();
try {
  const before = await objects();
  console.log('objects before:', before);

  // ── Phase A: apply 050 and 051, then exercise them ─────────────────────────────────────────────
  console.log('\n== Phase A: apply 050 + 051 (rolled back at the end)');
  await client.query('BEGIN');
  let t0 = Date.now();
  await client.query(read('migrations/050_transactions_client_tx_id.sql'));
  console.log(`050 applied in ${Date.now() - t0} ms`);
  t0 = Date.now();
  await client.query(read('migrations/051_stock_variances.sql'));
  console.log(`051 applied in ${Date.now() - t0} ms`);

  const cols = await client.query<{ column_name: string; data_type: string; column_default: string | null }>(
    `SELECT column_name, data_type, column_default FROM information_schema.columns
      WHERE table_name='transactions' AND column_name IN ('client_tx_id','device_id','local_receipt_ref') ORDER BY 1`);
  ok(cols.rows.length === 3, '050: three new columns exist', cols.rows.map((c) => `${c.column_name}:${c.data_type}`).join(' '));
  ok(cols.rows.find((c) => c.column_name === 'client_tx_id')?.column_default === null, '050: client_tx_id has NO default');
  const nonNull = await client.query<{ n: number }>(`SELECT count(*)::int n FROM transactions WHERE client_tx_id IS NOT NULL OR device_id IS NOT NULL OR local_receipt_ref IS NOT NULL`);
  ok(nonNull.rows[0]!.n === 0, '050: existing rows are untouched (all new columns NULL)');
  const ix = await client.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE indexname='idx_transactions_client_tx_per_tenant'`);
  ok(/UNIQUE/.test(ix.rows[0]?.indexdef ?? '') && /WHERE \(client_tx_id IS NOT NULL\)/.test(ix.rows[0]?.indexdef ?? ''), '050: partial UNIQUE index on (tenant_id, client_tx_id)');

  const tenantA = '00000000-0000-4000-8000-0000000000a1';
  const tenantB = '00000000-0000-4000-8000-0000000000b2';
  const txId = '00000000-0000-4000-8000-0000000000c3';
  const insertTx = (tenant: string, c: string | null): Promise<unknown> => client.query(
    `INSERT INTO transactions (tenant_id, register_id, shift_id, cashier_id, total_amount_cents, payment_method, client_timestamp, client_tx_id)
     VALUES ($1, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 100, 'cash', now(), $2)`, [tenant, c]);
  await insertTx(tenantA, txId);
  ok(true, '050: first sale with (tenant A, client_tx_id) is accepted');
  await expectError('050: same (tenant, client_tx_id) is rejected (replay-safe)', '23505',
    `INSERT INTO transactions (tenant_id, register_id, shift_id, cashier_id, total_amount_cents, payment_method, client_timestamp, client_tx_id)
     VALUES ($1, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 100, 'cash', now(), $2)`, [tenantA, txId]);
  await insertTx(tenantB, txId);
  ok(true, '050: the same client_tx_id under another tenant is accepted');
  await insertTx(tenantA, null);
  await insertTx(tenantA, null);
  ok(true, '050: several legacy rows with NULL client_tx_id are accepted (partial index)');

  // 051
  const tenant = await client.query<{ id: string }>(`SELECT id FROM tenants ORDER BY created_at LIMIT 1`);
  const prod = await client.query<{ product_id: string }>(`SELECT product_id FROM products WHERE tenant_id = $1 LIMIT 1`, [tenant.rows[0]!.id]);
  const T = tenant.rows[0]!.id;
  const P = prod.rows[0]!.product_id;
  const v = await client.query<{ variance_qty: string; acknowledged_at: string | null }>(
    `INSERT INTO stock_variances (tenant_id, product_id, expected_qty, actual_qty, reason)
     VALUES ($1, $2, 5, 3, 'oversell_clamped') RETURNING variance_qty, acknowledged_at`, [T, P]);
  ok(Number(v.rows[0]!.variance_qty) === -2, '051: variance_qty is generated as actual - expected (5 expected, 3 actual = -2)');
  ok(v.rows[0]!.acknowledged_at === null, '051: a new variance is unacknowledged');
  await expectError('051: unknown product is rejected (FK)', '23503',
    `INSERT INTO stock_variances (tenant_id, product_id, expected_qty, actual_qty, reason) VALUES ($1, gen_random_uuid(), 1, 1, 'x')`, [T]);
  await expectError('051: empty reason is rejected', '23514',
    `INSERT INTO stock_variances (tenant_id, product_id, expected_qty, actual_qty, reason) VALUES ($1, $2, 1, 1, '')`, [T, P]);
  await expectError('051: acknowledged_by without acknowledged_at is rejected', '23514',
    `INSERT INTO stock_variances (tenant_id, product_id, expected_qty, actual_qty, reason, acknowledged_by)
     VALUES ($1, $2, 1, 1, 'x', (SELECT staff_id FROM staff LIMIT 1))`, [T, P]);
  await expectError('051: variance_qty cannot be written directly (generated column)', '428C9',
    `INSERT INTO stock_variances (tenant_id, product_id, expected_qty, actual_qty, variance_qty, reason) VALUES ($1, $2, 1, 1, 9, 'x')`, [T, P]);
  await expectError('051: deleting a product that has variances is blocked (RESTRICT)', '23503',
    `DELETE FROM products WHERE product_id = $1`, [P]);
  const idx51 = await client.query<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE tablename='stock_variances' ORDER BY 1`);
  ok(idx51.rows.length === 3, '051: primary key + two indexes exist', idx51.rows.map((r) => r.indexname).join(', '));
  const partial = await client.query<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE indexname='idx_stock_variances_unacknowledged'`);
  ok(/WHERE \(acknowledged_at IS NULL\)/.test(partial.rows[0]?.indexdef ?? ''), '051: unacknowledged index is partial (acknowledged_at IS NULL)');

  // Lock evidence: what this transaction now holds (these are the locks other sessions would wait on).
  const locks = await client.query<{ rel: string; mode: string }>(
    `SELECT relation::regclass::text AS rel, mode FROM pg_locks
      WHERE pid = pg_backend_pid() AND locktype = 'relation' AND granted
        AND relation::regclass::text IN ('transactions','tenants','products','registers','staff','stock_variances')
        AND mode IN ('AccessExclusiveLock','ShareLock','ShareRowExclusiveLock','ShareUpdateExclusiveLock')
      ORDER BY 1, 2`);
  console.log('locks held after applying 050 + 051 (heavy modes only):');
  locks.rows.forEach((l) => console.log(`   ${l.rel}: ${l.mode}`));
  await client.query('ROLLBACK');
  ok((await objects()) === before, 'Phase A rolled back: database is exactly as before', await objects());

  // ── Phase B: apply, then run the rollback SQL, prove it removes everything ────────────────────
  console.log('\n== Phase B: apply 050 + 051, then their rollbacks (rolled back at the end)');
  await client.query('BEGIN');
  await client.query(read('migrations/050_transactions_client_tx_id.sql'));
  await client.query(read('migrations/051_stock_variances.sql'));
  ok((await objects()) !== before, 'applied: objects exist');
  await client.query(read('migrations/rollback/051_rollback.sql'));
  await client.query(read('migrations/rollback/050_rollback.sql'));
  ok((await objects()) === '(none)', 'rollback SQL removed every object', await objects());
  // Re-apply after rollback proves the pair is repeatable (idempotent IF NOT EXISTS guards).
  await client.query(read('migrations/050_transactions_client_tx_id.sql'));
  await client.query(read('migrations/050_transactions_client_tx_id.sql'));
  ok(true, '050 applied twice in a row without error (IF NOT EXISTS guards)');
  await client.query('ROLLBACK');
  ok((await objects()) === before, 'Phase B rolled back: database is exactly as before', await objects());
} catch (e) {
  failures++;
  console.error('FAILED:', e instanceof Error ? e.message : String(e));
  await client.query('ROLLBACK').catch(() => undefined);
} finally {
  await client.end().catch(() => undefined);
}
console.log(failures === 0 ? '\nDRY RUN OK: all checks passed, nothing was applied.' : `\nDRY RUN FAILED: ${failures} check(s) failed. Nothing was applied.`);
process.exit(failures === 0 ? 0 : 1);
