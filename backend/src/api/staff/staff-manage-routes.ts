import type { FastifyInstance } from 'fastify';
import {
  assignableRoles,
  authorizeCreate,
  authorizeUpdate,
  canModifyTarget,
  type StaffErrorCode,
} from '../../services/staff-access.js';

// Who may open staff management at all. WHAT each of them may do is decided by the
// rank rules in services/staff-access.ts, never by this list.
const MGMT_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;

const MIN_PIN_LENGTH = 4;

type RouteError = StaffErrorCode | 'name_ar required' | 'invalid_pin' | 'nothing to update' | 'not found'
  | 'tenant claim missing' | 'invalid_request';

/**
 * Staff management: list, create, edit. Privilege-escalation rules live in
 * services/staff-access.ts. Every change is written to audit_log (actor, target,
 * field NAMES only; PINs are never recorded) in the same transaction.
 */
export async function staffManageRoutes(fastify: FastifyInstance): Promise<void> {
  /** The caller as stored NOW (not only as in the token): a demoted or deactivated user loses power at once. */
  async function loadCaller(tenantId: string, staffId: string | undefined) {
    if (!staffId) return null;
    const { rows } = await fastify.pg.query<{ staff_id: string; role: string }>(
      `SELECT staff_id, role FROM staff WHERE staff_id = $1 AND tenant_id = $2 AND is_active = true`,
      [staffId, tenantId],
    );
    return rows[0] ?? null;
  }

  // ── GET /staff/assignable-roles ──────────────────────────────────────────
  // What the caller may assign. The /staff page offers exactly these buttons.
  fastify.get('/staff/assignable-roles', { config: { allowedRoles: MGMT_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' satisfies RouteError });
    try {
      const caller = await loadCaller(tenantId, request.auth?.staff_id);
      if (!caller) return reply.status(403).send({ error: 'caller_not_found' satisfies RouteError });
      return reply.send({ role: caller.role, assignable_roles: assignableRoles(caller.role) });
    } catch (err: unknown) {
      request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'staff: assignable-roles failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── GET /staff/manage ────────────────────────────────────────────────────
  // Same rows as before, plus can_modify: whether THIS caller may edit/deactivate the row.
  fastify.get('/staff/manage', { config: { allowedRoles: MGMT_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' satisfies RouteError });
    try {
      const caller = await loadCaller(tenantId, request.auth?.staff_id);
      if (!caller) return reply.status(403).send({ error: 'caller_not_found' satisfies RouteError });
      const r = await fastify.pg.query<{ staff_id: string; role: string }>(
        `SELECT staff_id, name_ar, name_fr, role, is_active, created_at
         FROM staff WHERE tenant_id = $1 ORDER BY role, name_ar`,
        [tenantId],
      );
      return reply.send(r.rows.map((row) => ({
        ...row,
        can_modify: row.staff_id !== caller.staff_id && canModifyTarget(caller.role, row.role),
      })));
    } catch (err: unknown) {
      request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'staff: list failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  // ── POST /staff/manage ───────────────────────────────────────────────────
  fastify.post<{ Body: { name_ar?: string; name_fr?: string | null; role?: string; pin?: string } }>(
    '/staff/manage',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' satisfies RouteError });

      const { name_ar, name_fr, role, pin } = request.body ?? {};
      if (typeof name_ar !== 'string' || !name_ar.trim()) {
        return reply.status(400).send({ error: 'name_ar required' satisfies RouteError });
      }
      if (typeof pin !== 'string' || pin.length < MIN_PIN_LENGTH) {
        return reply.status(400).send({ error: 'invalid_pin' satisfies RouteError });
      }

      let client;
      try {
        const caller = await loadCaller(tenantId, request.auth?.staff_id);
        if (!caller) return reply.status(403).send({ error: 'caller_not_found' satisfies RouteError });

        const decision = authorizeCreate({ callerRole: caller.role, role });
        if (!decision.ok) return reply.status(decision.status).send({ error: decision.error });

        const { hashPin } = await import('../../services/pin-hash.js');
        const pinHash = await hashPin(pin);
        // name_fr is NOT NULL in the database: fall back to the Arabic name.
        const frName = typeof name_fr === 'string' && name_fr.trim() ? name_fr.trim() : name_ar.trim();

        client = await fastify.pg.connect();
        await client.query('BEGIN');
        const ins = await client.query<{ staff_id: string; name_ar: string; name_fr: string; role: string; is_active: boolean }>(
          `INSERT INTO staff (tenant_id, name_ar, name_fr, role, pin_hash, is_active)
           VALUES ($1,$2,$3,$4,$5,true)
           RETURNING staff_id, name_ar, name_fr, role, is_active`,
          [tenantId, name_ar.trim(), frName, role, pinHash],
        );
        const created = ins.rows[0]!;
        await client.query(
          `INSERT INTO audit_log (tenant_id, event_type, action, actor_id, metadata)
           VALUES ($1, 'STAFF_CHANGE', 'create', $2, $3::jsonb)`,
          [tenantId, caller.staff_id, JSON.stringify({ target_id: created.staff_id, role_to: created.role })],
        );
        await client.query('COMMIT');
        return reply.status(201).send(created);
      } catch (err: unknown) {
        if (client) await client.query('ROLLBACK').catch(() => undefined);
        // Fixed message: never the database's text.
        request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'staff: create failed');
        return reply.status(500).send({ error: 'Internal error' });
      } finally {
        client?.release();
      }
    },
  );

  // ── PATCH /staff/manage/:id ──────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: { name_ar?: string; name_fr?: string; role?: string; pin?: string; is_active?: boolean };
  }>(
    '/staff/manage/:id',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' satisfies RouteError });
      const { id } = request.params;
      const body = request.body ?? {};

      // Shape checks first (fixed messages).
      if (body.name_ar !== undefined && (typeof body.name_ar !== 'string' || !body.name_ar.trim())) {
        return reply.status(400).send({ error: 'name_ar required' satisfies RouteError });
      }
      if (body.name_fr !== undefined && body.name_fr !== null && typeof body.name_fr !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' satisfies RouteError });
      }
      if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
        return reply.status(400).send({ error: 'invalid_request' satisfies RouteError });
      }
      if (body.pin !== undefined && (typeof body.pin !== 'string' || body.pin.length < MIN_PIN_LENGTH)) {
        return reply.status(400).send({ error: 'invalid_pin' satisfies RouteError });
      }

      let client;
      try {
        const caller = await loadCaller(tenantId, request.auth?.staff_id);
        if (!caller) return reply.status(403).send({ error: 'caller_not_found' satisfies RouteError });

        client = await fastify.pg.connect();
        await client.query('BEGIN');

        // Lock the target row so its role cannot change between the check and the update.
        const found = await client.query<{ staff_id: string; role: string }>(
          `SELECT staff_id, role FROM staff WHERE staff_id = $1 AND tenant_id = $2 FOR UPDATE`,
          [id, tenantId],
        );
        const target = found.rows[0];
        if (!target) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'not found' satisfies RouteError });
        }

        // Captured now: the audit record must show the role BEFORE this change.
        const roleBefore = target.role;
        const decision = authorizeUpdate({
          callerId: caller.staff_id,
          callerRole: caller.role,
          targetId: target.staff_id,
          targetRole: roleBefore,
          change: body,
        });
        if (!decision.ok) {
          await client.query('ROLLBACK');
          return reply.status(decision.status).send({ error: decision.error });
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        const fields: string[] = [];
        let idx = 1;
        if (body.name_ar !== undefined) { updates.push(`name_ar = $${idx++}`); values.push(body.name_ar.trim()); fields.push('name_ar'); }
        if (typeof body.name_fr === 'string') { updates.push(`name_fr = $${idx++}`); values.push(body.name_fr); fields.push('name_fr'); }
        if (body.role !== undefined && body.role !== roleBefore) { updates.push(`role = $${idx++}`); values.push(body.role); fields.push('role'); }
        if (body.is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(body.is_active); fields.push('is_active'); }
        if (body.pin !== undefined) {
          const { hashPin } = await import('../../services/pin-hash.js');
          updates.push(`pin_hash = $${idx++}`);
          values.push(await hashPin(body.pin));
          fields.push('pin');
        }
        if (updates.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'nothing to update' satisfies RouteError });
        }

        values.push(id, tenantId);
        const upd = await client.query(
          `UPDATE staff SET ${updates.join(', ')}
           WHERE staff_id = $${idx} AND tenant_id = $${idx + 1}
           RETURNING staff_id, name_ar, name_fr, role, is_active`,
          values,
        );
        await client.query(
          `INSERT INTO audit_log (tenant_id, event_type, action, actor_id, metadata)
           VALUES ($1, 'STAFF_CHANGE', 'update', $2, $3::jsonb)`,
          [tenantId, caller.staff_id, JSON.stringify({
            target_id: id, fields,
            ...(fields.includes('role') ? { role_from: roleBefore, role_to: body.role } : {}),
          })],
        );
        await client.query('COMMIT');
        return reply.send(upd.rows[0]);
      } catch (err: unknown) {
        if (client) await client.query('ROLLBACK').catch(() => undefined);
        request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'staff: update failed');
        return reply.status(500).send({ error: 'Internal error' });
      } finally {
        client?.release();
      }
    },
  );
}
