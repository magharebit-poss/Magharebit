import type { FastifyInstance } from 'fastify';

/**
 * Manager view of stock shortfalls (table stock_variances, migration 051).
 *
 *   GET   /stock-variances                  list, unacknowledged first
 *   PATCH /stock-variances/:id/acknowledge  mark one as seen
 *
 * The tenant and the acknowledging person always come from the token, never from the query or the
 * body. Errors are fixed codes: no database text ever reaches the client.
 */

const MGMT_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_OFFSET = 1_000_000;
const DAY_MS = 86_400_000;

export interface VarianceQuery {
  acknowledged?: unknown;
  product?: unknown;
  from?: unknown;
  to?: unknown;
  limit?: unknown;
  offset?: unknown;
}

export interface ParsedVarianceQuery {
  /** true = only acknowledged, false = only open, undefined = both. */
  acknowledged: boolean | undefined;
  product: string | undefined;
  /** Inclusive lower bound on detected_at. */
  from: Date | undefined;
  /** Exclusive upper bound on detected_at. */
  toExclusive: Date | undefined;
  limit: number;
  offset: number;
}

export type VarianceQueryResult =
  | { ok: true; value: ParsedVarianceQuery }
  | { ok: false; error: 'invalid_acknowledged' | 'invalid_product' | 'invalid_date' | 'invalid_limit' | 'invalid_offset' };

function intInRange(raw: unknown, min: number, max: number): number | null {
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

/**
 * A date alone ("2026-11-04") is a whole UTC day: from = its start, to = its end. A full timestamp
 * must carry a time zone. Anything else is rejected rather than guessed.
 */
function parseBound(raw: string, kind: 'from' | 'to'): Date | null {
  if (DATE_ONLY_RE.test(raw)) {
    const start = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== raw) return null;
    return kind === 'from' ? start : new Date(start.getTime() + DAY_MS);
  }
  if (DATE_TIME_RE.test(raw)) {
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) return null;
    return kind === 'from' ? at : new Date(at.getTime() + 1);
  }
  return null;
}

export function parseVarianceQuery(q: VarianceQuery): VarianceQueryResult {
  let acknowledged: boolean | undefined;
  if (q.acknowledged !== undefined) {
    if (q.acknowledged === 'true') acknowledged = true;
    else if (q.acknowledged === 'false') acknowledged = false;
    else return { ok: false, error: 'invalid_acknowledged' };
  }

  let product: string | undefined;
  if (q.product !== undefined) {
    if (typeof q.product !== 'string' || !UUID_RE.test(q.product)) return { ok: false, error: 'invalid_product' };
    product = q.product.toLowerCase();
  }

  let from: Date | undefined;
  if (q.from !== undefined) {
    const d = typeof q.from === 'string' ? parseBound(q.from, 'from') : null;
    if (!d) return { ok: false, error: 'invalid_date' };
    from = d;
  }
  let toExclusive: Date | undefined;
  if (q.to !== undefined) {
    const d = typeof q.to === 'string' ? parseBound(q.to, 'to') : null;
    if (!d) return { ok: false, error: 'invalid_date' };
    toExclusive = d;
  }
  if (from && toExclusive && from.getTime() >= toExclusive.getTime()) return { ok: false, error: 'invalid_date' };

  const limit = q.limit === undefined ? DEFAULT_LIMIT : intInRange(q.limit, 1, MAX_LIMIT);
  if (limit === null) return { ok: false, error: 'invalid_limit' };
  const offset = q.offset === undefined ? 0 : intInRange(q.offset, 0, MAX_OFFSET);
  if (offset === null) return { ok: false, error: 'invalid_offset' };

  return { ok: true, value: { acknowledged, product, from, toExclusive, limit, offset } };
}

export async function stockVarianceRoutes(fastify: FastifyInstance): Promise<void> {
  // The SQLSTATE and constraint name are logged, never the message (it can echo row values).
  const logDbError = (err: unknown, what: string): void => {
    const pg = err as { code?: string; constraint?: string };
    fastify.log.error(
      { errName: (err as Error)?.name, pgCode: pg.code, pgConstraint: pg.constraint },
      `[stock-variances] ${what} failed`,
    );
  };

  // ── GET /stock-variances ────────────────────────────────────────────────────
  fastify.get<{ Querystring: VarianceQuery }>(
    '/stock-variances',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant_claim_missing' });

      const parsed = parseVarianceQuery(request.query ?? {});
      if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
      const q = parsed.value;

      const params: unknown[] = [tenantId];
      const where: string[] = ['sv.tenant_id = $1'];
      if (q.acknowledged !== undefined) {
        where.push(q.acknowledged ? 'sv.acknowledged_at IS NOT NULL' : 'sv.acknowledged_at IS NULL');
      }
      if (q.product) {
        params.push(q.product);
        where.push(`sv.product_id = $${params.length}`);
      }
      if (q.from) {
        params.push(q.from.toISOString());
        where.push(`sv.detected_at >= $${params.length}`);
      }
      if (q.toExclusive) {
        params.push(q.toExclusive.toISOString());
        where.push(`sv.detected_at < $${params.length}`);
      }
      const whereSql = where.join(' AND ');

      try {
        const count = await fastify.pg.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM stock_variances sv WHERE ${whereSql}`,
          params,
        );
        const { rows } = await fastify.pg.query(
          `SELECT sv.variance_id, sv.product_id,
                  p.name_ar AS product_name_ar, p.name_fr AS product_name_fr,
                  p.uom, p.is_weighted,
                  sv.expected_qty::float8 AS expected_qty,
                  sv.actual_qty::float8   AS actual_qty,
                  sv.variance_qty::float8 AS variance_qty,
                  (sv.expected_qty - sv.actual_qty)::float8 AS missing_qty,
                  sv.reason, sv.register_id, r.name AS register_name, sv.transaction_id,
                  sv.detected_at, sv.acknowledged_by,
                  a.name_ar AS acknowledged_by_name_ar, a.name_fr AS acknowledged_by_name_fr,
                  sv.acknowledged_at
           FROM stock_variances sv
           JOIN products p ON p.product_id = sv.product_id AND p.tenant_id = sv.tenant_id
           LEFT JOIN registers r ON r.register_id = sv.register_id AND r.tenant_id = sv.tenant_id
           LEFT JOIN staff a ON a.staff_id = sv.acknowledged_by AND a.tenant_id = sv.tenant_id
           WHERE ${whereSql}
           ORDER BY (sv.acknowledged_at IS NOT NULL) ASC, sv.detected_at DESC, sv.variance_id ASC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, q.limit, q.offset],
        );
        return reply.send({ items: rows, total: count.rows[0]?.n ?? 0, limit: q.limit, offset: q.offset });
      } catch (err: unknown) {
        logDbError(err, 'list');
        return reply.status(500).send({ error: 'internal_error' });
      }
    },
  );

  // ── PATCH /stock-variances/:id/acknowledge ──────────────────────────────────
  // One statement: the update and its audit row succeed or fail together. The request body is never
  // read, so a client cannot choose who acknowledged. Repeating the call changes nothing.
  fastify.patch<{ Params: { id: string } }>(
    '/stock-variances/:id/acknowledge',
    { config: { allowedRoles: MGMT_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const staffId = request.auth?.staff_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant_claim_missing' });
      if (!staffId) return reply.status(400).send({ error: 'staff_claim_missing' });

      const { id } = request.params;
      if (!UUID_RE.test(id)) return reply.status(400).send({ error: 'invalid_id' });

      try {
        const first = await fastify.pg.query<{ variance_id: string; acknowledged_by: string; acknowledged_at: string }>(
          `WITH upd AS (
             UPDATE stock_variances
                SET acknowledged_by = $3, acknowledged_at = now()
              WHERE variance_id = $1 AND tenant_id = $2 AND acknowledged_at IS NULL
          RETURNING variance_id, product_id, register_id, acknowledged_by, acknowledged_at
           ), audit AS (
             INSERT INTO audit_log (tenant_id, register_id, event_type, action, actor_id, metadata)
             SELECT $2, upd.register_id, 'stock_variance', 'acknowledge', $3,
                    jsonb_build_object('variance_id', upd.variance_id, 'product_id', upd.product_id)
               FROM upd
          RETURNING 1
           )
           SELECT variance_id, acknowledged_by, acknowledged_at FROM upd`,
          [id, tenantId, staffId],
        );
        if (first.rows[0]) {
          return reply.send({ ...first.rows[0], already_acknowledged: false });
        }

        // Nothing was updated: it is either already acknowledged (fine, report it) or not this tenant's.
        const existing = await fastify.pg.query<{ variance_id: string; acknowledged_by: string | null; acknowledged_at: string | null }>(
          `SELECT variance_id, acknowledged_by, acknowledged_at
             FROM stock_variances WHERE variance_id = $1 AND tenant_id = $2`,
          [id, tenantId],
        );
        if (!existing.rows[0]) return reply.status(404).send({ error: 'variance_not_found' });
        return reply.send({ ...existing.rows[0], already_acknowledged: true });
      } catch (err: unknown) {
        logDbError(err, 'acknowledge');
        return reply.status(500).send({ error: 'internal_error' });
      }
    },
  );
}
