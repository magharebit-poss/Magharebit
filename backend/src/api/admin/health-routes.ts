import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '../../monitoring/logger';

const log = createLogger({ service: 'health-routes' });

// ─── Types ───────────────────────────────────────────────────────────────────

interface RegisterHeartbeat {
  registerId: string;
  hardwareStatus: {
    scale: 'connected' | 'disconnected';
    printer: 'connected' | 'disconnected';
  };
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

function requireAdminRole(request: FastifyRequest, reply: FastifyReply): boolean {
  const role = (request as FastifyRequest & { role?: string }).role;
  if (role && role !== 'SUPER_ADMIN' && role !== 'SUPPORT_AGENT') {
    reply.status(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * GET /admin/health/registers
   * Returns all registers with online status, sync stats, hw status, active shift.
   */
  fastify.get('/admin/health/registers', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;

    try {
      const { rows } = await fastify.pg.query<{
        register_id: string;
        name: string;
        last_seen: string;
        scale_status: string;
        printer_status: string;
        cashier_name_ar: string | null;
        shift_started_at: string | null;
        pending_count: number;
        accepted_count: number;
        total_count: number;
      }>(`
        SELECT
          r.register_id,
          r.name,
          COALESCE(rh.updated_at, r.created_at)::text AS last_seen,
          COALESCE(rh.scale_status, 'disconnected')   AS scale_status,
          COALESCE(rh.printer_status, 'disconnected') AS printer_status,
          st.cashier_name_ar,
          st.opened_at::text                          AS shift_started_at,
          COALESCE(pq.pending_count, 0)::int          AS pending_count,
          COALESCE(sb.accepted_count, 0)::int         AS accepted_count,
          COALESCE(sb.total_count, 0)::int            AS total_count
        FROM registers r
        LEFT JOIN register_heartbeats rh ON rh.register_id = r.register_id
        LEFT JOIN LATERAL (
          SELECT cashier_name_ar, opened_at
          FROM shifts
          WHERE register_id = r.register_id AND closed_at IS NULL
          ORDER BY opened_at DESC LIMIT 1
        ) st ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS pending_count
          FROM pending_deductions_queue
          WHERE register_id = r.register_id AND sync_status = 'pending'
        ) pq ON true
        LEFT JOIN LATERAL (
          SELECT
            SUM(accepted_count)::int AS accepted_count,
            SUM(total_count)::int    AS total_count
          FROM processed_batches
          WHERE register_id = r.register_id
            AND processed_at > NOW() - INTERVAL '24 hours'
        ) sb ON true
        ORDER BY r.name
      `);

      const registers = rows.map((row) => ({
        registerId: row.register_id,
        name: row.name,
        lastSeen: row.last_seen,
        isOnline: (Date.now() - new Date(row.last_seen).getTime()) < 5 * 60_000,
        hardwareStatus: {
          scale: row.scale_status as 'connected' | 'disconnected',
          printer: row.printer_status as 'connected' | 'disconnected',
        },
        activeShift: row.cashier_name_ar
          ? { cashierNameAr: row.cashier_name_ar, startedAt: row.shift_started_at ?? '' }
          : null,
        pendingDeductionsCount: row.pending_count,
        syncStats: { accepted: row.accepted_count, total: row.total_count },
      }));

      return reply.status(200).send({ registers });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'health/registers query failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  /**
   * GET /admin/health/errors
   * Returns last 50 HARDWARE_ERROR events from audit_log.
   */
  fastify.get('/admin/health/errors', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;

    try {
      const { rows } = await fastify.pg.query<{
        id: string;
        created_at: string;
        register_name: string;
        device: string;
        error_code: string;
        recoverable: boolean;
      }>(`
        SELECT
          al.id::text,
          al.created_at::text,
          r.name AS register_name,
          al.metadata->>'device'    AS device,
          al.metadata->>'code'      AS error_code,
          (al.metadata->>'recoverable')::boolean AS recoverable
        FROM audit_log al
        JOIN registers r ON r.register_id = al.register_id
        WHERE al.event_type = 'HARDWARE_ERROR'
        ORDER BY al.created_at DESC
        LIMIT 50
      `);

      const events = rows.map((row) => ({
        id: row.id,
        timestamp: row.created_at,
        registerName: row.register_name,
        device: row.device ?? '',
        errorCode: row.error_code ?? '',
        recoverable: row.recoverable ?? false,
      }));

      return reply.status(200).send({ events });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'health/errors query failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  /**
   * GET /admin/health/floor-exceeded
   * Returns floor-exceeded events from last 24h.
   */
  fastify.get('/admin/health/floor-exceeded', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;

    try {
      const { rows } = await fastify.pg.query<{
        id: string;
        register_name: string;
        attempted_amount_cents: number;
        floor_limit_cents: number;
        created_at: string;
        shift_id: string;
      }>(`
        SELECT
          al.id::text,
          r.name AS register_name,
          (al.metadata->>'attemptedAmountCents')::int AS attempted_amount_cents,
          (al.metadata->>'floorLimitCents')::int      AS floor_limit_cents,
          al.created_at::text,
          al.metadata->>'shiftId' AS shift_id
        FROM audit_log al
        JOIN registers r ON r.register_id = al.register_id
        WHERE al.action = 'OFFLINE_FLOOR_EXCEEDED'
          AND al.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY al.created_at DESC
      `);

      const events = rows.map((row) => ({
        id: row.id,
        registerName: row.register_name,
        attemptedAmountCents: row.attempted_amount_cents,
        floorLimitCents: row.floor_limit_cents,
        timestamp: row.created_at,
        shiftId: row.shift_id ?? '',
      }));

      return reply.status(200).send({ events });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'health/floor-exceeded query failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  /**
   * GET /admin/health/sync-stats
   * Per-register sync success rates over last 24h.
   */
  fastify.get('/admin/health/sync-stats', async (request, reply) => {
    if (!requireAdminRole(request, reply)) return;

    try {
      const { rows } = await fastify.pg.query<{
        register_name: string;
        accepted_count: number;
        total_count: number;
      }>(`
        SELECT
          r.name AS register_name,
          SUM(pb.accepted_count)::int AS accepted_count,
          SUM(pb.total_count)::int    AS total_count
        FROM processed_batches pb
        JOIN registers r ON r.register_id = pb.register_id
        WHERE pb.processed_at > NOW() - INTERVAL '24 hours'
        GROUP BY r.register_id, r.name
        ORDER BY r.name
      `);

      const stats = rows.map((row) => ({
        registerName: row.register_name,
        successRate: row.total_count > 0
          ? (row.accepted_count / row.total_count) * 100
          : 100,
      }));

      return reply.status(200).send({ stats });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'health/sync-stats query failed');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });

  /**
   * POST /registers/heartbeat
   * Called by LicensePollWorker every 5 minutes.
   * Upserts hardware status into register_heartbeats.
   *
   * register_heartbeats table (create in migration):
   *   CREATE TABLE register_heartbeats (
   *     register_id   UUID PRIMARY KEY REFERENCES registers(register_id),
   *     tenant_id     UUID NOT NULL,
   *     last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   *     scale_status  TEXT NOT NULL DEFAULT 'disconnected',
   *     printer_status TEXT NOT NULL DEFAULT 'disconnected',
   *     updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
   *   );
   */
  fastify.post<{ Body: RegisterHeartbeat }>(
    '/registers/heartbeat',
    async (request, reply) => {
      const { body } = request;
      const tenantId = (request as FastifyRequest & { tenantId?: string }).tenantId;
      if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

      try {
        await fastify.pg.query(
          `INSERT INTO register_heartbeats
             (register_id, tenant_id, last_seen, scale_status, printer_status, updated_at)
           VALUES ($1, $2, NOW(), $3, $4, NOW())
           ON CONFLICT (register_id) DO UPDATE SET
             last_seen      = NOW(),
             scale_status   = EXCLUDED.scale_status,
             printer_status = EXCLUDED.printer_status,
             updated_at     = NOW()`,
          [
            body.registerId,
            tenantId,
            body.hardwareStatus.scale,
            body.hardwareStatus.printer,
          ],
        );
        return reply.status(200).send({ ok: true });
      } catch (err: unknown) {
        log.error({ err: err instanceof Error ? err : undefined }, 'heartbeat upsert failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );
}
