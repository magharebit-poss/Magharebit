import type { FastifyRequest, FastifyReply } from 'fastify';
import { hasPermission, type Permission, type StaffRole } from './permissions.js';

/**
 * Fastify preHandler that asserts the JWT-authenticated staff has
 * the given permission via their role in ROLE_PERMISSIONS.
 *
 * Loads per-staff overrides from the staff_permissions table when
 * fastify.pg is available (additively grants or revokes permissions).
 *
 * Usage:
 *   fastify.post('/path', {
 *     preHandler: requirePermission('reports:export'),
 *   }, handler)
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = request.auth;
    const role = auth?.role as StaffRole | undefined;

    if (!role) {
      return reply.status(401).send({ error: 'Unauthorized: no role in token' });
    }

    // Check role-level grant first (cheap — no DB).
    let granted = hasPermission(role, permission);

    // Apply per-staff overrides when the fastify instance has a PG pool.
    const pg = (request.server as { pg?: { query: (...args: unknown[]) => Promise<{ rows: unknown[] }> } }).pg;
    if (pg && auth?.staff_id && auth.tenant_id) {
      try {
        const { rows } = await pg.query(
          `SELECT granted
           FROM staff_permissions
           WHERE tenant_id = $1
             AND staff_id  = $2
             AND permission = $3
           LIMIT 1`,
          [auth.tenant_id, auth.staff_id, permission],
        );
        if (rows.length > 0 && rows[0] !== undefined) {
          granted = (rows[0] as { granted: boolean }).granted;
        }
      } catch {
        // Best-effort: if the table doesn't exist yet, fall back to role-level.
      }
    }

    if (!granted) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Permission required: ${permission}`,
      });
    }
  };
}
