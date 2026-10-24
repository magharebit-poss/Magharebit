import { beforeEach, describe, expect, test, vi } from 'vitest';
import Fastify from 'fastify';

// Hashing is slow and irrelevant here: a predictable stand-in.
vi.mock('../../../services/pin-hash.js', () => ({
  hashPin: async (pin: string) => `hash(${pin})`,
}));

import { staffManageRoutes } from '../staff-manage-routes';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';

interface Row {
  staff_id: string; tenant_id: string; name_ar: string; name_fr: string;
  role: string; is_active: boolean; pin_hash: string;
}
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const person = (n: number, role: string, extra: Partial<Row> = {}): Row => ({
  staff_id: id(n), tenant_id: TENANT, name_ar: `ar${n}`, name_fr: `fr${n}`, role, is_active: true, pin_hash: 'hash(0000)', ...extra,
});

// Staff used by the tests.
const OWNER = person(1, 'OWNER');
const SUPERVISOR = person(2, 'SUPERVISOR');
const MANAGER = person(3, 'MANAGER');
const MANAGER2 = person(4, 'MANAGER');
const CASHIER = person(5, 'CASHIER');
const FOREIGN = person(6, 'CASHIER', { tenant_id: OTHER_TENANT });
const DEACTIVATED = person(7, 'MANAGER', { is_active: false });

/** An in-memory stand-in for the three statements shapes the routes use. */
function fakePg(initial: Row[]) {
  const rows = initial.map((r) => ({ ...r }));
  const statements: string[] = [];
  const audit: Array<{ action: string; actor: string; metadata: Record<string, unknown> }> = [];
  let failInsertStaff: Error | null = null;

  const query = async (sql: string, params: unknown[] = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    statements.push(q.split(' ').slice(0, 3).join(' '));
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(q)) return { rows: [] };
    if (q.startsWith('SELECT staff_id, role FROM staff WHERE staff_id = $1 AND tenant_id = $2 AND is_active = true')) {
      return { rows: rows.filter((r) => r.staff_id === params[0] && r.tenant_id === params[1] && r.is_active) };
    }
    if (q.startsWith('SELECT staff_id, role FROM staff WHERE staff_id = $1 AND tenant_id = $2 FOR UPDATE')) {
      return { rows: rows.filter((r) => r.staff_id === params[0] && r.tenant_id === params[1]) };
    }
    if (q.startsWith('SELECT staff_id, name_ar, name_fr, role, is_active, created_at FROM staff WHERE tenant_id = $1')) {
      return { rows: rows.filter((r) => r.tenant_id === params[0]) };
    }
    if (q.startsWith('INSERT INTO staff')) {
      if (failInsertStaff) throw failInsertStaff;
      const row = { staff_id: id(100 + rows.length), tenant_id: params[0] as string, name_ar: params[1] as string,
        name_fr: params[2] as string, role: params[3] as string, pin_hash: params[4] as string, is_active: true };
      rows.push(row);
      return { rows: [{ staff_id: row.staff_id, name_ar: row.name_ar, name_fr: row.name_fr, role: row.role, is_active: true }] };
    }
    if (q.startsWith('UPDATE staff SET')) {
      const set = q.match(/SET (.*) WHERE/)![1]!.split(', ').map((s) => s.split(' = '));
      const target = rows.find((r) => r.staff_id === params[params.length - 2] && r.tenant_id === params[params.length - 1]);
      if (!target) return { rows: [] };
      for (const [col, ph] of set) (target as unknown as Record<string, unknown>)[col!] = params[parseInt(ph!.slice(1), 10) - 1];
      return { rows: [{ staff_id: target.staff_id, name_ar: target.name_ar, name_fr: target.name_fr, role: target.role, is_active: target.is_active }] };
    }
    if (q.startsWith('INSERT INTO audit_log')) {
      audit.push({ action: params[1] === undefined ? '' : q.includes("'create'") ? 'create' : 'update', actor: params[1] as string,
        metadata: JSON.parse(params[2] as string) });
      return { rows: [] };
    }
    throw new Error(`unexpected SQL in test: ${q.slice(0, 70)}`);
  };
  const pool = { query, connect: async () => ({ query, release: () => undefined }) };
  return { pool, rows, statements, audit, failNextInsert: (e: Error) => { failInsertStaff = e; } };
}

async function appAs(caller: Row, db: ReturnType<typeof fakePg>) {
  const app = Fastify();
  app.decorate('pg', db.pool as never);
  app.addHook('onRequest', async (req) => {
    (req as unknown as { auth: unknown }).auth = { tenant_id: TENANT, staff_id: caller.staff_id, role: caller.role };
  });
  await app.register(staffManageRoutes);
  return app;
}
const writes = (db: ReturnType<typeof fakePg>) =>
  db.statements.filter((s) => s.startsWith('INSERT INTO staff') || s.startsWith('UPDATE staff')).length;

let db: ReturnType<typeof fakePg>;
beforeEach(() => { db = fakePg([OWNER, SUPERVISOR, MANAGER, MANAGER2, CASHIER, FOREIGN, DEACTIVATED]); });

describe('POST /staff/manage', () => {
  test('MANAGER cannot create a SUPERVISOR or an OWNER (nothing is written)', async () => {
    const app = await appAs(MANAGER, db);
    for (const role of ['SUPERVISOR', 'OWNER']) {
      const res = await app.inject({ method: 'POST', url: '/staff/manage', payload: { name_ar: 'x', role, pin: '1234' } });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'role_not_assignable' });
    }
    expect(writes(db)).toBe(0);
  });

  test('MANAGER can create a CASHIER; French name falls back to the Arabic name; audit has no PIN', async () => {
    const app = await appAs(MANAGER, db);
    const res = await app.inject({ method: 'POST', url: '/staff/manage', payload: { name_ar: ' سارة ', name_fr: null, role: 'CASHIER', pin: '4321' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name_ar: 'سارة', name_fr: 'سارة', role: 'CASHIER' });
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0]!.actor).toBe(MANAGER.staff_id);
    expect(JSON.stringify(db.audit)).not.toContain('4321');
    expect(JSON.stringify(db.audit)).not.toContain('hash(');
  });

  test('invalid or missing role: 400 with a fixed code', async () => {
    const app = await appAs(OWNER, db);
    for (const role of ['ROOT', 'supervisor', undefined]) {
      const res = await app.inject({ method: 'POST', url: '/staff/manage', payload: { name_ar: 'x', role, pin: '1234' } });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid_role' });
    }
    expect(writes(db)).toBe(0);
  });

  test('database errors never reach the client', async () => {
    db.failNextInsert(new Error('duplicate key value violates unique constraint "secret_internal_name"'));
    const app = await appAs(OWNER, db);
    const res = await app.inject({ method: 'POST', url: '/staff/manage', payload: { name_ar: 'x', role: 'CASHIER', pin: '1234' } });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'Internal error' });
    expect(res.body).not.toContain('secret_internal_name');
  });

  test('a deactivated caller is refused even with a valid token', async () => {
    const app = await appAs(DEACTIVATED, db);
    const res = await app.inject({ method: 'POST', url: '/staff/manage', payload: { name_ar: 'x', role: 'CASHIER', pin: '1234' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'caller_not_found' });
  });
});

describe('PATCH /staff/manage/:id', () => {
  test('MANAGER cannot change a SUPERVISOR\'s PIN, deactivate them, or rename them', async () => {
    const app = await appAs(MANAGER, db);
    for (const payload of [{ pin: '9999' }, { is_active: false }, { name_ar: 'x' }]) {
      const res = await app.inject({ method: 'PATCH', url: `/staff/manage/${SUPERVISOR.staff_id}`, payload });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'target_not_modifiable' });
    }
    expect(writes(db)).toBe(0);
    expect(db.rows.find((r) => r.staff_id === SUPERVISOR.staff_id)!.pin_hash).toBe('hash(0000)');
  });

  test('MANAGER cannot change their own role', async () => {
    const app = await appAs(MANAGER, db);
    for (const role of ['SUPERVISOR', 'OWNER']) {
      const res = await app.inject({ method: 'PATCH', url: `/staff/manage/${MANAGER.staff_id}`, payload: { role } });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'cannot_change_own_role' });
    }
    expect(db.rows.find((r) => r.staff_id === MANAGER.staff_id)!.role).toBe('MANAGER');
  });

  test('nobody can deactivate themselves or change their own PIN', async () => {
    const app = await appAs(SUPERVISOR, db);
    const a = await app.inject({ method: 'PATCH', url: `/staff/manage/${SUPERVISOR.staff_id}`, payload: { is_active: false } });
    expect(a.json()).toEqual({ error: 'cannot_deactivate_self' });
    const b = await app.inject({ method: 'PATCH', url: `/staff/manage/${SUPERVISOR.staff_id}`, payload: { pin: '1111' } });
    expect(b.json()).toEqual({ error: 'cannot_change_own_pin' });
    expect(writes(db)).toBe(0);
  });

  test('MANAGER cannot promote a CASHIER to SUPERVISOR; can promote to SENIOR_CASHIER', async () => {
    const app = await appAs(MANAGER, db);
    const bad = await app.inject({ method: 'PATCH', url: `/staff/manage/${CASHIER.staff_id}`, payload: { role: 'SUPERVISOR' } });
    expect(bad.statusCode).toBe(403);
    expect(bad.json()).toEqual({ error: 'role_not_assignable' });
    const ok = await app.inject({ method: 'PATCH', url: `/staff/manage/${CASHIER.staff_id}`, payload: { role: 'SENIOR_CASHIER' } });
    expect(ok.statusCode).toBe(200);
    expect(db.rows.find((r) => r.staff_id === CASHIER.staff_id)!.role).toBe('SENIOR_CASHIER');
    expect(db.audit.at(-1)!.metadata).toMatchObject({ fields: ['role'], role_from: 'CASHIER', role_to: 'SENIOR_CASHIER' });
  });

  test('SUPERVISOR can manage a MANAGER; the audit records field names, never the PIN', async () => {
    const app = await appAs(SUPERVISOR, db);
    const res = await app.inject({ method: 'PATCH', url: `/staff/manage/${MANAGER2.staff_id}`, payload: { pin: '4321', is_active: false } });
    expect(res.statusCode).toBe(200);
    expect(db.rows.find((r) => r.staff_id === MANAGER2.staff_id)).toMatchObject({ is_active: false, pin_hash: 'hash(4321)' });
    expect(db.audit.at(-1)!.metadata).toMatchObject({ target_id: MANAGER2.staff_id, fields: ['is_active', 'pin'] });
    expect(JSON.stringify(db.audit)).not.toContain('4321');
  });

  test('SUPERVISOR cannot touch another SUPERVISOR or an OWNER', async () => {
    const app = await appAs(SUPERVISOR, db);
    const res = await app.inject({ method: 'PATCH', url: `/staff/manage/${OWNER.staff_id}`, payload: { pin: '4321' } });
    expect(res.statusCode).toBe(403);
    expect(writes(db)).toBe(0);
  });

  test('an invalid role is rejected with a fixed code; an unknown id is 404; another tenant\'s staff is 404', async () => {
    const app = await appAs(OWNER, db);
    const bad = await app.inject({ method: 'PATCH', url: `/staff/manage/${CASHIER.staff_id}`, payload: { role: 'ROOT' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'invalid_role' });
    const none = await app.inject({ method: 'PATCH', url: `/staff/manage/${id(999)}`, payload: { name_ar: 'x' } });
    expect(none.statusCode).toBe(404);
    const foreign = await app.inject({ method: 'PATCH', url: `/staff/manage/${FOREIGN.staff_id}`, payload: { name_ar: 'x' } });
    expect(foreign.statusCode).toBe(404);
  });

  test('bad shapes get fixed messages (short PIN, non-boolean flag)', async () => {
    const app = await appAs(OWNER, db);
    const pin = await app.inject({ method: 'PATCH', url: `/staff/manage/${CASHIER.staff_id}`, payload: { pin: '12' } });
    expect(pin.json()).toEqual({ error: 'invalid_pin' });
    const flag = await app.inject({ method: 'PATCH', url: `/staff/manage/${CASHIER.staff_id}`, payload: { is_active: 'no' } });
    expect(flag.json()).toEqual({ error: 'invalid_request' });
  });
});

describe('GET routes', () => {
  test('can_modify tells the page what this caller may touch', async () => {
    const app = await appAs(MANAGER, db);
    const res = await app.inject({ method: 'GET', url: '/staff/manage' });
    expect(res.statusCode).toBe(200);
    const byId = Object.fromEntries((res.json() as Array<{ staff_id: string; can_modify: boolean }>).map((r) => [r.staff_id, r.can_modify]));
    expect(byId[CASHIER.staff_id]).toBe(true);
    expect(byId[MANAGER.staff_id]).toBe(false);   // self
    expect(byId[MANAGER2.staff_id]).toBe(false);  // same rank
    expect(byId[SUPERVISOR.staff_id]).toBe(false);
    expect(byId[OWNER.staff_id]).toBe(false);
    expect(byId[FOREIGN.staff_id]).toBeUndefined(); // other tenant never listed
  });

  test('assignable-roles per caller', async () => {
    const asManager = await (await appAs(MANAGER, db)).inject({ method: 'GET', url: '/staff/assignable-roles' });
    expect(asManager.json()).toEqual({ role: 'MANAGER', assignable_roles: ['CASHIER', 'SENIOR_CASHIER', 'INVENTORY'] });
    const asOwner = await (await appAs(OWNER, db)).inject({ method: 'GET', url: '/staff/assignable-roles' });
    expect((asOwner.json() as { assignable_roles: string[] }).assignable_roles).toContain('OWNER');
  });
});
