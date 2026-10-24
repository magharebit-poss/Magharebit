import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomUUID } from 'crypto';
import { verifyPin } from '../../services/pin-hash.js';
import { normalizeLineItem } from '../../services/sales/line-items.js';
import { staffManageRoutes } from '../staff/staff-manage-routes.js';
import {
  checkDiscount,
  checkCashVariance,
} from '../../services/analytics/anomaly-detector.js';

interface OpenShiftBody {
  staffId: string;
  pin: string;
  openingFloat?: number;
}

interface ApiDiscount {
  type: 'percentage' | 'fixed';
  value: number; // pct (0-100) or piastres
  managerApprovedBy?: string | null;
}

interface TransactionLine {
  productId: string;
  quantity: number;
  unitPricePiastres: number;
  lineTotalPiastres: number;
  taxRate?: number;
  taxAmountPiastres: number;
  discount?: ApiDiscount | null;
}

interface Tender {
  method: string;
  amountPiastres: number;
  reference?: string | null;
}

interface TransactionBody {
  shiftId: string;
  lines: TransactionLine[];
  cartDiscount?: ApiDiscount | null;
  // Required for single-tender (backward compat). Omit when tenders is provided.
  paymentMethod?: 'cash' | 'card' | 'lana';
  tenders?: Tender[];
  grandTotalPiastres: number;
  cashPaidPiastres?: number;
  // ISO 8601 timestamp of when the sale was made (captures offline sale time).
  soldAt?: string | null;
  // Card terminal fields — present only when paymentMethod is 'card'.
  approvalCode?: string | null;
  maskedPan?: string | null;
}

const TENDER_METHODS = new Set([
  'cash', 'card_cmi', 'card_visa', 'card_mastercard',
  'mobile_cih', 'mobile_cih_pay', 'mobile_orange_money',
  'mobile_inwi_money', 'credit', 'voucher', 'other',
]);

function tenderToLegacy(method: string): 'cash' | 'card' | 'lana' {
  if (method === 'cash' || method === 'credit' || method === 'voucher' || method === 'other') return 'cash';
  if (method.startsWith('card_')) return 'card';
  return 'lana';
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// ── Discount math (mirrors apps/pos-web/src/lib/cart.ts; integer piastres,
//    round half-up, clamp at 0, tax recomputed on the discounted HT base) ────
const DEFAULT_TAX_RATE = 0.2;

function discountValid(d: ApiDiscount | null | undefined): boolean {
  if (!d) return true; // absent is valid (no discount)
  if (!Number.isFinite(d.value)) return false;
  if (d.type === 'percentage') return d.value >= 0 && d.value <= 100;
  if (d.type === 'fixed') return d.value >= 0;
  return false;
}

function discountAmount(base: number, d: ApiDiscount | null | undefined): number {
  if (!d || base <= 0 || !discountValid(d)) return 0;
  const raw =
    d.type === 'percentage' ? Math.round((base * d.value) / 100) : Math.round(d.value);
  return Math.min(Math.max(0, raw), base);
}

/** Server-side recomputation of the discounted, tax-inclusive total. */
function recomputeTransaction(lines: TransactionLine[], cartDiscount?: ApiDiscount | null): {
  totalPiastres: number;
  totalDiscountPiastres: number;
  cartDiscountAmountPiastres: number;
} {
  let lineDiscounts = 0;
  const perLine = lines.map((l) => {
    const rate = typeof l.taxRate === 'number' ? l.taxRate : DEFAULT_TAX_RATE;
    const baseHT = l.unitPricePiastres * l.quantity;
    const newHT = Math.max(0, baseHT - discountAmount(baseHT, l.discount));
    lineDiscounts += baseHT - newHT;
    return { ht: newHT, rate };
  });

  const subtotalAfterLine = perLine.reduce((s, x) => s + x.ht, 0);
  const cartDisc = discountAmount(subtotalAfterLine, cartDiscount);

  let allocated = 0;
  let tax = 0;
  let finalHT = 0;
  perLine.forEach((x, i) => {
    let share = 0;
    if (cartDisc > 0 && subtotalAfterLine > 0) {
      share =
        i === perLine.length - 1
          ? cartDisc - allocated
          : Math.round((cartDisc * x.ht) / subtotalAfterLine);
      allocated += i === perLine.length - 1 ? 0 : share;
    }
    const ht = Math.max(0, x.ht - Math.max(0, share));
    finalHT += ht;
    tax += Math.round(ht * x.rate);
  });

  return {
    totalPiastres: finalHT + tax,
    totalDiscountPiastres: lineDiscounts + cartDisc,
    cartDiscountAmountPiastres: cartDisc,
  };
}

// ── Role sets (mirror the former client-side gating) ──────────────────────
const STAFF_ROLES = [
  'CASHIER', 'SENIOR_CASHIER', 'INVENTORY',
  'MANAGER', 'SUPERVISOR', 'OWNER',
] as const;
const MANAGER_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;
// Order-taking and KDS routes: every staff role except INVENTORY.
const ORDER_TAKING_ROLES = STAFF_ROLES.filter((r) => r !== 'INVENTORY');
// Token-issuing PIN endpoints: public but rate-limited to 5 req/min per IP.
const PIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

export async function posRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /products — all active products for the caller's tenant ─────────
  fastify.get('/products', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'tenant claim missing from token' });
    }
    // Optional ?q= text filter (name_ar / name_fr / plu_code / barcode), used by voice input.
    const { q } = request.query as { q?: string };
    const term = q?.trim().slice(0, 100) || null;
    const canSeeCost = ['INVENTORY', 'MANAGER', 'SUPERVISOR', 'OWNER'].includes(request.auth?.role ?? '');
    try {
      const { rows } = await fastify.pg.query<{
        cost_price_cents: number | null;
        product_id: string; tenant_id: string; plu_code: string | null; barcode: string | null;
        name_ar: string; name_fr: string; category: string; price_cents: number;
        is_bom: boolean; is_weighted: boolean; uom: string; stock_quantity: number;
        low_stock_threshold: number; track_stock: boolean; is_perishable: boolean;
        current_markdown_percent: number | null; effective_price_cents: number;
        image_thumb_path: string | null;
      }>(`
        SELECT
          product_id,
          tenant_id,
          plu_code,
          barcode,
          name_ar,
          name_fr,
          category,
          price_cents,
          is_bom,
          is_weighted,
          uom,
          stock_quantity,
          low_stock_threshold,
          track_stock,
          COALESCE(is_perishable, false)        AS is_perishable,
          current_markdown_percent,
          CASE
            WHEN current_markdown_percent IS NOT NULL
            THEN GREATEST(
              ROUND(price_cents * (1 - current_markdown_percent / 100.0))::integer,
              1
            )
            ELSE price_cents
          END AS effective_price_cents,
          image_thumb_path,
          -- Cost is only visible to roles that can edit products (not cashiers).
          CASE WHEN $3::boolean THEN cost_price_cents END AS cost_price_cents
        FROM products
        WHERE is_active = true
          AND tenant_id = $1
          AND (
            $2::text IS NULL
            OR name_ar   ILIKE '%' || $2 || '%'
            OR name_fr   ILIKE '%' || $2 || '%'
            OR plu_code  ILIKE '%' || $2 || '%'
            OR barcode   ILIKE '%' || $2 || '%'
          )
        ORDER BY
          CASE
            WHEN $2::text IS NULL THEN 0
            WHEN lower(name_ar) = lower($2) OR lower(name_fr) = lower($2) THEN 0
            WHEN name_ar ILIKE $2 || '%' OR name_fr ILIKE $2 || '%' THEN 1
            ELSE 2
          END,
          category, name_ar
      `, [tenantId, term, canSeeCost]);
      const base = (process.env['IMAGES_BASE_URL'] ?? 'http://localhost:3001/images').replace(/\/$/, '');
      return reply.send(rows.map((r) => ({
        ...r,
        thumb_url: r.image_thumb_path ? `${base}/${r.image_thumb_path}` : null,
      })));
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'Internal error',
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // ── GET /staff — active staff, scoped to the caller's tenant ────────────
  // Tenant comes ONLY from the verified JWT claim (request.auth.tenant_id),
  // never from client input. Prevents cross-tenant staff enumeration.
  fastify.get('/staff', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) {
      return reply.status(400).send({ error: 'tenant claim missing from token' });
    }
    try {
      const { rows } = await fastify.pg.query(
        `SELECT staff_id, tenant_id, name_ar, name_fr, role
         FROM staff
         WHERE is_active = true AND tenant_id = $1
         ORDER BY role DESC, name_ar`,
        [tenantId],
      );
      return reply.send(rows);
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'Internal error',
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // ── GET /staff/login-options — PUBLIC, pre-auth cashier picker ──────────
  // Minimal read-only projection for the login screen, which must render the
  // cashier list BEFORE any token exists. Returns ONLY what the login UI shows
  // (staff_id, name_ar, name_fr, role). Never exposes pin_hash or any secret.
  // The full GET /staff route stays protected by STAFF_ROLES (unchanged).
  fastify.get<{ Querystring: { tenantId?: string } }>(
    '/staff/login-options',
    { config: { public: true } },
    async (request, reply) => {
    const tenantId = request.query.tenantId;
    if (!tenantId) {
      // No tenant fallback — refusing to leak all tenants' staff.
      return reply.status(400).send({ error: 'tenantId query param required' });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(tenantId)) {
      return reply.status(400).send({ error: 'tenantId must be a valid UUID' });
    }
    try {
      const { rows } = await fastify.pg.query(
        `SELECT staff_id, name_ar, name_fr, role
         FROM staff
         WHERE is_active = true AND tenant_id = $1
         ORDER BY role DESC, name_ar`,
        [tenantId],
      );
      return reply.send(rows);
    } catch (err: unknown) {
      request.log.error(
        { err, tenantId },
        'staff/login-options: query failed',
      );
      return reply.status(500).send({
        error: 'Internal error',
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // ── GET /categories — distinct categories from products ─────────────────
  fastify.get('/categories', { config: { allowedRoles: STAFF_ROLES } }, async (_request, reply) => {
    try {
      const { rows } = await fastify.pg.query<{ category: string; count: number }>(`
        SELECT category, COUNT(*)::int AS count
        FROM products
        WHERE is_active = true
        GROUP BY category
        ORDER BY category
      `);
      return reply.send(rows);
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'Internal error',
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // ── POST /shifts/open — verify PIN + create new shift ───────────────────
  fastify.post<{ Body: OpenShiftBody }>(
    '/shifts/open',
    { config: { public: true, rateLimit: PIN_RATE_LIMIT } },
    async (request: FastifyRequest<{ Body: OpenShiftBody }>, reply) => {
      const { staffId, pin, openingFloat } = request.body;

      if (!staffId || !pin || pin.length !== 4) {
        return reply.status(400).send({ error: 'staffId and 4-digit pin required' });
      }

      try {
        // Verify staff + PIN
        const { rows: staffRows } = await fastify.pg.query<{
          staff_id: string;
          tenant_id: string;
          name_ar: string;
          role: string;
          pin_hash: string;
        }>(
          `SELECT staff_id, tenant_id, name_ar, role, pin_hash
           FROM staff
           WHERE staff_id = $1 AND is_active = true`,
          [staffId],
        );

        const staffRow = staffRows[0];
        if (!staffRow) {
          return reply.status(401).send({ error: 'الكاشير غير موجود' });
        }

        const pinResult = await verifyPin(pin, staffRow.pin_hash);
        if (!pinResult.matched) {
          return reply.status(401).send({ error: 'رمز PIN غير صحيح' });
        }
        // Transparent migration: persist the upgraded Argon2id hash on success.
        if (pinResult.needsRehash) {
          await fastify.pg.query(
            `UPDATE staff SET pin_hash = $1 WHERE staff_id = $2`,
            [pinResult.newHash, staffRow.staff_id],
          );
        }

        // Find any register for this tenant (POS-web doesn't bind to a register)
        const { rows: regRows } = await fastify.pg.query<{ register_id: string }>(
          `SELECT register_id FROM registers
           WHERE tenant_id = $1 AND status = 'active'
           ORDER BY name LIMIT 1`,
          [staffRow.tenant_id],
        );

        if (regRows.length === 0) {
          return reply.status(400).send({ error: 'لا توجد أجهزة نشطة لهذا المتجر' });
        }
        const registerId = regRows[0].register_id;

        // Create shift
        const shiftId = randomUUID();
        await fastify.pg.query(
          `INSERT INTO shifts
             (shift_id, tenant_id, register_id, cashier_id,
              cashier_name_ar, opened_at, status, opening_float)
           VALUES ($1, $2, $3, $4, $5, NOW(), 'open', $6)`,
          [
            shiftId,
            staffRow.tenant_id,
            registerId,
            staffRow.staff_id,
            staffRow.name_ar,
            openingFloat ?? 0,
          ],
        );

        // Issue an 8h HS256 token. Payload carries no PIN/secret material.
        const token = fastify.jwt.sign(
          {
            staff_id: staffRow.staff_id,
            tenant_id: staffRow.tenant_id,
            role: staffRow.role,
            shift_id: shiftId,
          },
          { expiresIn: '8h' },
        );

        return reply.send({
          token,
          shiftId,
          registerId,
          tenantId: staffRow.tenant_id,
          cashierName: staffRow.name_ar,
        });
      } catch (err: unknown) {
        // Log the real DB error so it's visible in the backend console/log drain.
        // Does not include PIN values or any secret material.
        request.log.error(
          {
            err,
            handler: 'POST /shifts/open',
            staffId: request.body?.staffId ?? null,
          },
          'shifts/open: unhandled error',
        );
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── POST /transactions — record completed sale ──────────────────────────
  fastify.post<{ Body: TransactionBody }>(
    '/transactions',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request: FastifyRequest<{ Body: TransactionBody }>, reply) => {
      const {
        shiftId,
        lines,
        cartDiscount,
        paymentMethod: paymentMethodRaw,
        tenders: tendersRaw,
        grandTotalPiastres,
        soldAt: rawSoldAt,
        approvalCode,
        maskedPan,
      } = request.body;

      // Resolve the real sale time. Accept the client's soldAt only when it is
      // within a sane window: not more than 5 minutes in the future (clock
      // skew) and not older than 30 days (stale offline queue).
      // Offline sales queued while disconnected carry the time of the original
      // sale; online sales send the moment the cashier confirmed.
      const FIVE_MIN_MS  = 5 * 60 * 1000;
      const THIRTY_DAY_MS = 30 * 24 * 60 * 60 * 1000;
      let soldAtValue: Date | null = null;
      if (rawSoldAt) {
        const parsed = new Date(rawSoldAt);
        if (!isNaN(parsed.getTime())) {
          const now = Date.now();
          if (parsed.getTime() > now + FIVE_MIN_MS) {
            request.log.warn({ rawSoldAt }, 'transactions: soldAt rejected — too far in the future');
          } else if (now - parsed.getTime() > THIRTY_DAY_MS) {
            request.log.warn({ rawSoldAt }, 'transactions: soldAt rejected — older than 30 days');
          } else {
            soldAtValue = parsed;
          }
        }
      }

      // ── Strict validation ──────────────────────────────────────────────
      if (!shiftId) {
        return reply.status(400).send({ error: 'shiftId is required' });
      }
      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return reply.status(400).send({
          error: 'lines array is required and must not be empty',
        });
      }
      if (
        typeof grandTotalPiastres !== 'number' ||
        !Number.isFinite(grandTotalPiastres) ||
        grandTotalPiastres <= 0
      ) {
        return reply.status(400).send({
          error: 'grandTotalPiastres must be a positive integer',
        });
      }
      // ── Tenders / paymentMethod resolution ────────────────────────────────
      // Split-payment path: tenders array provided with sum == grandTotal.
      // Backward-compat path: no tenders — use paymentMethod, synthesise a
      //   single tender row.
      let paymentMethod: 'cash' | 'card' | 'lana';
      let resolvedTenders: Tender[];

      const hasTenders = Array.isArray(tendersRaw) && tendersRaw.length > 0;

      if (hasTenders) {
        for (const t of tendersRaw!) {
          if (!TENDER_METHODS.has(t.method)) {
            return reply.status(400).send({ error: `Unknown tender method: ${t.method}` });
          }
          if (!Number.isInteger(t.amountPiastres) || t.amountPiastres <= 0) {
            return reply.status(400).send({ error: `Tender amountPiastres must be a positive integer` });
          }
        }
        const tenderSum = tendersRaw!.reduce((s, t) => s + t.amountPiastres, 0);
        if (Math.abs(tenderSum - grandTotalPiastres) > 2) {
          return reply.status(400).send({
            error: `Tender sum (${tenderSum}) does not match grandTotalPiastres (${grandTotalPiastres})`,
          });
        }
        // Dominant method = largest tender; used as the legacy transaction-level field.
        const dominant = tendersRaw!.reduce((a, b) => (a.amountPiastres >= b.amountPiastres ? a : b));
        paymentMethod = tenderToLegacy(dominant.method);
        resolvedTenders = tendersRaw!;
      } else {
        if (!paymentMethodRaw || !['cash', 'card', 'lana'].includes(paymentMethodRaw)) {
          return reply.status(400).send({
            error: `paymentMethod must be one of cash | card | lana (got: ${paymentMethodRaw ?? 'undefined'})`,
          });
        }
        paymentMethod = paymentMethodRaw;
        resolvedTenders = [{ method: paymentMethod, amountPiastres: grandTotalPiastres }];
      }

      // ── Discount validation (bounds) ───────────────────────────────────
      for (const l of lines) {
        if (!discountValid(l.discount)) {
          return reply.status(400).send({
            error: 'invalid line discount (percentage must be 0-100, fixed non-negative)',
          });
        }
      }
      if (!discountValid(cartDiscount)) {
        return reply.status(400).send({
          error: 'invalid cart discount (percentage must be 0-100, fixed non-negative)',
        });
      }

      // ── Anti-tamper: recompute the total from prices + discounts and reject
      //    if the client-submitted grand total disagrees beyond a 2-piastre
      //    rounding tolerance. Never trust the client total blindly. ─────────
      const recomputed = recomputeTransaction(lines, cartDiscount);
      if (Math.abs(recomputed.totalPiastres - grandTotalPiastres) > 2) {
        return reply.status(400).send({
          error: 'grand total mismatch — recomputed total does not match submitted total',
          recomputedPiastres: recomputed.totalPiastres,
          submittedPiastres: grandTotalPiastres,
        });
      }

      // Audit: the manager (if any) who approved an over-threshold discount.
      const discountApprovedBy =
        (cartDiscount && cartDiscount.managerApprovedBy) ||
        lines.find((l) => l.discount && l.discount.managerApprovedBy)?.discount
          ?.managerApprovedBy ||
        null;

      try {
        // ── Verify shift exists and is open (separate 404/400) ───────────
        const { rows: shiftRows } = await fastify.pg.query<{
          tenant_id: string;
          register_id: string;
          cashier_id: string;
          status: string;
        }>(
          `SELECT tenant_id, register_id, cashier_id, status
           FROM shifts WHERE shift_id = $1`,
          [shiftId],
        );

        const shiftRow = shiftRows[0];
        if (!shiftRow) {
          return reply.status(404).send({ error: `Shift ${shiftId} not found` });
        }
        if (shiftRow.status !== 'open') {
          return reply.status(400).send({
            error: `Shift ${shiftId} is not open (status: ${shiftRow.status})`,
          });
        }

        const transactionId = randomUUID();

        // Allocate a per-tenant sequential receipt number. Single atomic
        // statement (row-locked on conflict) → race-safe across concurrent sales.
        const { rows: seqRows } = await fastify.pg.query<{ last_seq: string }>(
          `INSERT INTO tenant_receipt_counters (tenant_id, last_seq, updated_at)
           VALUES ($1, 1, NOW())
           ON CONFLICT (tenant_id) DO UPDATE
             SET last_seq = tenant_receipt_counters.last_seq + 1, updated_at = NOW()
           RETURNING last_seq`,
          [shiftRow.tenant_id],
        );
        const receiptSeq = parseInt(seqRows[0]?.last_seq ?? '0', 10);
        const receiptNumber = `R-${String(receiptSeq).padStart(6, '0')}`;

        // Normalise line items to the canonical shape before storing.
        const canonicalLines = lines.map(normalizeLineItem);

        const insertResult = await fastify.pg.query<{
          transaction_id: string;
          created_at: string;
        }>(
          `INSERT INTO transactions
             (transaction_id, tenant_id, register_id, shift_id, cashier_id,
              items, total_amount_cents, payment_method, receipt_number, client_timestamp,
              sold_at,
              cart_discount_type, cart_discount_value, cart_discount_amount_cents,
              total_discount_cents, discount_approved_by,
              card_approval_code, card_masked_pan)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW(),
                   COALESCE($17, NOW()),
                   $10, $11, $12, $13, $14,
                   $15, $16)
           RETURNING transaction_id, created_at::text AS created_at`,
          [
            transactionId,
            shiftRow.tenant_id,
            shiftRow.register_id,
            shiftId,
            shiftRow.cashier_id,
            JSON.stringify(canonicalLines),
            grandTotalPiastres,
            paymentMethod,
            receiptNumber,
            cartDiscount?.type ?? null,
            cartDiscount ? Math.round(cartDiscount.value) : null,
            recomputed.cartDiscountAmountPiastres,
            recomputed.totalDiscountPiastres,
            discountApprovedBy,
            approvalCode ?? null,
            maskedPan ?? null,
            soldAtValue,
          ],
        );

        if (insertResult.rowCount === 0 || !insertResult.rows[0]) {
          return reply.status(500).send({ error: 'Transaction insert returned no rows' });
        }

        // Update shift running total
        await fastify.pg.query(
          `UPDATE shifts
             SET total_sales_piastres = total_sales_piastres + $1
           WHERE shift_id = $2`,
          [grandTotalPiastres, shiftId],
        );

        // ── payment_transactions row (best-effort, logged on failure) ─────
        // Handler does not use a DB transaction, so this insert is fire-and-
        // forget. A failure here never fails the sale.
        try {
          const paymentStatus =
            paymentMethod === 'card'
              ? (approvalCode ? 'approved' : 'offline_auth')
              : 'approved';
          await fastify.pg.query(
            `INSERT INTO payment_transactions
               (payment_tx_id, sale_transaction_id, shift_id, register_id,
                amount, payment_method, status,
                cmi_token_ref, terminal_response)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              randomUUID(),
              transactionId,
              shiftId,
              shiftRow.register_id,
              grandTotalPiastres,
              paymentMethod,
              paymentStatus,
              approvalCode ?? null,
              maskedPan ?? null,
            ],
          );
        } catch (payErr: unknown) {
          request.log.warn(
            { transactionId, err: payErr },
            'transactions: payment_transactions insert failed — sale committed',
          );
        }

        // ── sale_tenders rows (best-effort) ───────────────────────────────
        try {
          for (const tender of resolvedTenders) {
            await fastify.pg.query(
              `INSERT INTO sale_tenders
                 (transaction_id, shift_id, method, amount_piastres, reference)
               VALUES ($1, $2, $3, $4, $5)`,
              [transactionId, shiftId, tender.method, tender.amountPiastres, tender.reference ?? null],
            );
          }
        } catch (tenderErr: unknown) {
          request.log.warn(
            { transactionId, err: tenderErr },
            'transactions: sale_tenders insert failed — sale committed',
          );
        }

        // ── Stock deduction (best-effort) ─────────────────────────────────
        // Runs after the sale is committed to the pool. A failure here logs
        // a warning but does NOT fail the sale — sale accuracy is paramount;
        // stock accuracy is secondary.  GREATEST ensures we never go negative.
        for (const line of lines) {
          try {
            await fastify.pg.query(
              `UPDATE products
               SET stock_quantity = GREATEST(stock_quantity - $1, 0)
               WHERE product_id = $2
                 AND tenant_id = $3
                 AND track_stock = true`,
              [line.quantity, line.productId, shiftRow.tenant_id],
            );
          } catch (stockErr: unknown) {
            request.log.warn(
              { productId: line.productId, err: stockErr },
              'transactions: stock deduction failed — sale committed, stock may be inaccurate',
            );
          }
        }

        // Margin Guardian — async discount anomaly check, never blocks sale.
        if (cartDiscount && cartDiscount.type === 'percentage' && cartDiscount.value > 0) {
          checkDiscount(
            {
              tenantId:  shiftRow.tenant_id,
              shiftId,
              cashierId: shiftRow.cashier_id,
              pool:      fastify.pg,
            },
            transactionId,
            cartDiscount.value,
            recomputed.totalDiscountPiastres,
          ).catch((e: unknown) => console.error('[guardian]', e));
        }

        // Return the authoritative data the customer receipt renders from
        // (server-issued receipt number + timestamp, not client-guessed).
        return reply.send({
          ok: true,
          success: true,
          transactionId: insertResult.rows[0].transaction_id,
          receiptNumber,
          serverTimestamp: insertResult.rows[0].created_at,
          totalPiastres: grandTotalPiastres,
          paymentMethod,
          items: lines,
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: build the full shift summary (used by both summary + close)
  // ─────────────────────────────────────────────────────────────────────────
  async function buildShiftSummary(shiftId: string): Promise<unknown | null> {
    // Query 1 — shift row
    const { rows: shiftRows } = await fastify.pg.query<{
      shift_id: string;
      cashier_name_ar: string | null;
      opened_at: string;
      closed_at: string | null;
      status: string;
      opening_float: number;
      closing_cash_counted: number | null;
      expected_cash: number | null;
      cash_variance: number | null;
    }>(
      `SELECT shift_id, cashier_name_ar, opened_at::text, closed_at::text,
              status, opening_float, closing_cash_counted, expected_cash, cash_variance
       FROM shifts WHERE shift_id = $1`,
      [shiftId],
    );
    const shift = shiftRows[0];
    if (!shift) return null;

    // Query 2 — transaction aggregates
    const { rows: aggRows } = await fastify.pg.query<{
      tx_count: string;
      total_sales: string;
      cash_count: string;
      cash_total: string;
      card_count: string;
      card_total: string;
    }>(
      `SELECT
         COUNT(*)                                                          AS tx_count,
         COALESCE(SUM(total_amount_cents), 0)                              AS total_sales,
         COUNT(*) FILTER (WHERE payment_method='cash')                     AS cash_count,
         COALESCE(SUM(total_amount_cents) FILTER (WHERE payment_method='cash'), 0) AS cash_total,
         COUNT(*) FILTER (WHERE payment_method='card')                     AS card_count,
         COALESCE(SUM(total_amount_cents) FILTER (WHERE payment_method='card'), 0) AS card_total
       FROM transactions WHERE shift_id = $1`,
      [shiftId],
    );
    const agg = aggRows[0];

    // Query 3 — total tax from JSONB items
    const { rows: taxRows } = await fastify.pg.query<{ total_tax: string }>(
      `SELECT COALESCE(SUM((item->>'taxAmountPiastres')::int), 0) AS total_tax
       FROM transactions, jsonb_array_elements(items) AS item
       WHERE shift_id = $1`,
      [shiftId],
    );
    const totalTax = parseInt(taxRows[0]?.total_tax ?? '0', 10);

    // Query 4 — top 5 products
    const { rows: topRows } = await fastify.pg.query<{
      product_id: string;
      name_ar: string;
      qty: string;
      total: string;
    }>(
      `SELECT
         x."productId"             AS product_id,
         p.name_ar                 AS name_ar,
         SUM(x."quantity")         AS qty,
         SUM(x."lineTotalPiastres") AS total
       FROM transactions,
         jsonb_to_recordset(items) AS x("productId" text, "quantity" int, "lineTotalPiastres" int)
       JOIN products p ON p.product_id::text = x."productId"
       WHERE transactions.shift_id = $1
       GROUP BY x."productId", p.name_ar
       ORDER BY qty DESC
       LIMIT 5`,
      [shiftId],
    );

    // Query 5 — tender breakdown from sale_tenders
    const { rows: tenderRows } = await fastify.pg.query<{
      method: string;
      tx_count: string;
      total_piastres: string;
    }>(
      `SELECT method, COUNT(*) AS tx_count, COALESCE(SUM(amount_piastres), 0) AS total_piastres
       FROM sale_tenders
       WHERE shift_id = $1
       GROUP BY method
       ORDER BY total_piastres DESC`,
      [shiftId],
    );

    return {
      shiftId: shift.shift_id,
      cashierNameAr: shift.cashier_name_ar,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      status: shift.status,
      openingFloatPiastres: shift.opening_float,
      closingCashCounted: shift.closing_cash_counted,
      expectedCash: shift.expected_cash,
      cashVariance: shift.cash_variance,
      txCount: parseInt(agg?.tx_count ?? '0', 10),
      totalSalesPiastres: parseInt(agg?.total_sales ?? '0', 10),
      cashCount: parseInt(agg?.cash_count ?? '0', 10),
      cashTotalPiastres: parseInt(agg?.cash_total ?? '0', 10),
      cardCount: parseInt(agg?.card_count ?? '0', 10),
      cardTotalPiastres: parseInt(agg?.card_total ?? '0', 10),
      totalTaxPiastres: totalTax,
      topProducts: topRows.map((r) => ({
        productId: r.product_id,
        nameAr: r.name_ar,
        qty: parseInt(r.qty, 10),
        total: parseInt(r.total, 10),
      })),
      tenderSummary: tenderRows.map((r) => ({
        method: r.method,
        txCount: parseInt(r.tx_count, 10),
        totalPiastres: parseInt(r.total_piastres, 10),
      })),
    };
  }

  // ── GET /shifts/:shiftId/summary ────────────────────────────────────────
  fastify.get<{ Params: { shiftId: string } }>(
    '/shifts/:shiftId/summary',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      try {
        const summary = await buildShiftSummary(request.params.shiftId);
        if (!summary) {
          return reply.status(404).send({ error: 'Shift not found' });
        }
        return reply.send(summary);
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── POST /shifts/:shiftId/close ─────────────────────────────────────────
  fastify.post<{
    Params: { shiftId: string };
    Body: { closingFloat: number };
  }>(
    '/shifts/:shiftId/close',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { shiftId } = request.params;
      const { closingFloat } = request.body;

      if (typeof closingFloat !== 'number' || closingFloat < 0 || !Number.isFinite(closingFloat)) {
        return reply.status(400).send({ error: 'closingFloat must be a non-negative integer (piastres)' });
      }

      try {
        // Step 1: validate shift exists and is open
        const { rows: shiftRows } = await fastify.pg.query<{
          opening_float: number;
          status: string;
        }>(
          `SELECT opening_float, status FROM shifts WHERE shift_id = $1`,
          [shiftId],
        );
        const shift = shiftRows[0];
        if (!shift) {
          return reply.status(400).send({ error: 'Shift not found' });
        }
        if (shift.status !== 'open') {
          return reply.status(400).send({ error: 'Shift already closed' });
        }

        // Step 2: fetch cash sales total for this shift
        const { rows: cashRows } = await fastify.pg.query<{ cash_total: string }>(
          `SELECT COALESCE(SUM(total_amount_cents)
                           FILTER (WHERE payment_method='cash'), 0) AS cash_total
           FROM transactions WHERE shift_id = $1`,
          [shiftId],
        );
        const cashSales = parseInt(cashRows[0]?.cash_total ?? '0', 10);

        // Step 3-4: compute expected and variance
        const expectedCash = shift.opening_float + cashSales;
        const variance = Math.round(closingFloat) - expectedCash;

        // Step 5: atomic close (only if still open — prevents race)
        const { rowCount } = await fastify.pg.query(
          `UPDATE shifts SET
             status = 'closed',
             closed_at = NOW(),
             closing_cash_counted = $1,
             expected_cash = $2,
             cash_variance = $3
           WHERE shift_id = $4 AND status = 'open'`,
          [Math.round(closingFloat), expectedCash, variance, shiftId],
        );

        if (rowCount === 0) {
          return reply.status(400).send({ error: 'Shift already closed' });
        }

        // Margin Guardian — async cash variance check, never blocks close.
        checkCashVariance(
          {
            tenantId:  request.auth?.tenant_id ?? '',
            shiftId,
            cashierId: request.auth?.staff_id  ?? '',
            pool:      fastify.pg,
          },
          expectedCash,
          Math.round(closingFloat),
        ).catch((e: unknown) => console.error('[guardian cash]', e));

        // Step 7-8: re-fetch full summary
        const summary = await buildShiftSummary(shiftId);
        if (!summary) {
          return reply.status(500).send({ error: 'Failed to fetch closed shift summary' });
        }
        return reply.send(summary);
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /payment-methods ───────────────────────────────────────────────
  fastify.get(
    '/payment-methods',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth!.tenant_id;
      try {
        const { rows } = await fastify.pg.query<{
          method: string;
          label_ar: string;
          label_fr: string;
          label_en: string | null;
          sort_order: number;
        }>(
          `SELECT method, label_ar, label_fr, label_en, sort_order
           FROM payment_method_config
           WHERE tenant_id = $1 AND is_enabled = true
           ORDER BY sort_order, method`,
          [tenantId],
        );
        if (rows.length === 0) {
          return reply.send([
            { method: 'cash',     label_ar: 'نقد',   label_fr: 'Espèces', label_en: 'Cash',     sort_order: 1 },
            { method: 'card_cmi', label_ar: 'بطاقة', label_fr: 'Carte',   label_en: 'CMI Card', sort_order: 2 },
            { method: 'lana',     label_ar: 'لانا',  label_fr: 'Lana',    label_en: 'Lana Cash',sort_order: 3 },
          ]);
        }
        return reply.send(rows);
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /shifts/:shiftId/tender-summary ───────────────────────────────
  fastify.get<{ Params: { shiftId: string } }>(
    '/shifts/:shiftId/tender-summary',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { shiftId } = request.params;
      try {
        const { rows } = await fastify.pg.query<{
          method: string;
          tx_count: string;
          total_piastres: string;
        }>(
          `SELECT method, COUNT(*) AS tx_count, COALESCE(SUM(amount_piastres), 0) AS total_piastres
           FROM sale_tenders
           WHERE shift_id = $1
           GROUP BY method
           ORDER BY total_piastres DESC`,
          [shiftId],
        );
        return reply.send(rows.map((r) => ({
          method: r.method,
          txCount: parseInt(r.tx_count, 10),
          totalPiastres: parseInt(r.total_piastres, 10),
        })));
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════
  // WASTE RECORDING (S2-006 module)
  // ═══════════════════════════════════════════════════════════════════════

  // ── POST /staff/validate-pin — manager PIN check for waste approval ─────
  fastify.post<{ Body: { staffId: string; pin: string } }>(
    '/staff/validate-pin',
    { config: { public: true, rateLimit: PIN_RATE_LIMIT } },
    async (request, reply) => {
      const { staffId, pin } = request.body;
      if (!staffId || !pin) {
        return reply.status(400).send({ valid: false, error: 'staffId and pin required' });
      }

      try {
        const { rows } = await fastify.pg.query<{
          staff_id: string;
          role: string;
          pin_hash: string;
          name_ar: string;
        }>(
          `SELECT staff_id, role, pin_hash, name_ar
           FROM staff WHERE staff_id = $1 AND is_active = true`,
          [staffId],
        );

        const row = rows[0];
        if (!row) {
          return reply.status(404).send({ valid: false, error: 'Staff not found' });
        }

        // Only managers (or supervisors) can approve waste over threshold
        if (row.role !== 'MANAGER' && row.role !== 'SUPERVISOR') {
          return reply.status(403).send({
            valid: false,
            error: 'Staff member is not a manager',
          });
        }

        const pinResult = await verifyPin(pin, row.pin_hash);
        if (!pinResult.matched) {
          return reply.status(200).send({ valid: false });
        }
        // Transparent migration: persist the upgraded Argon2id hash on success.
        if (pinResult.needsRehash) {
          await fastify.pg.query(
            `UPDATE staff SET pin_hash = $1 WHERE staff_id = $2`,
            [pinResult.newHash, row.staff_id],
          );
        }

        return reply.send({
          valid: true,
          managerId: row.staff_id,
          managerNameAr: row.name_ar,
          role: row.role,
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          valid: false,
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── POST /auth/manager-override — authorize a restricted POS action ──────
  // Any authenticated staff member can call this; the manager PIN in the body
  // must match an active MANAGER / SUPERVISOR / OWNER for the same tenant.
  fastify.post<{
    Body: {
      managerPin: string;
      action: string;
      referenceId?: string;
      note?: string;
    };
  }>(
    '/auth/manager-override',
    {
      config: {
        allowedRoles: STAFF_ROLES,
        rateLimit: PIN_RATE_LIMIT,
      },
    },
    async (request, reply) => {
      const tenantId  = request.auth?.tenant_id;
      const cashierId = request.auth?.staff_id;
      const shiftId   = request.auth?.shift_id;
      const { managerPin, action, referenceId, note } = request.body;

      if (!managerPin || !action) {
        return reply.status(400).send({ error: 'managerPin and action required' });
      }

      // Find all active managers/supervisors/owners for this tenant and try each PIN.
      const { rows } = await fastify.pg.query<{
        staff_id: string;
        pin_hash: string;
      }>(
        `SELECT staff_id, pin_hash
         FROM staff
         WHERE tenant_id = $1
           AND role IN ('MANAGER', 'SUPERVISOR', 'OWNER')
           AND is_active = true`,
        [tenantId],
      );

      let managerId: string | null = null;
      for (const s of rows) {
        const pinResult = await verifyPin(managerPin, s.pin_hash);
        if (pinResult.matched) {
          managerId = s.staff_id;
          if (pinResult.needsRehash) {
            await fastify.pg.query(
              `UPDATE staff SET pin_hash = $1 WHERE staff_id = $2`,
              [pinResult.newHash, s.staff_id],
            );
          }
          break;
        }
      }

      if (!managerId) {
        return reply.status(401).send({
          error: 'invalid_manager_pin',
          message: 'رمز PIN غير صحيح أو غير مخول',
        });
      }

      // Audit log
      await fastify.pg.query(
        `INSERT INTO manager_overrides
           (tenant_id, shift_id, manager_id, cashier_id, action, reference_id, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          shiftId   ?? null,
          managerId,
          cashierId ?? null,
          action,
          referenceId ?? null,
          note        ?? null,
        ],
      );

      return reply.send({ authorized: true, manager_id: managerId, action });
    },
  );

  // ── GET /waste/last-hash?shiftId=X ──────────────────────────────────────
  fastify.get<{ Querystring: { shiftId?: string } }>(
    '/waste/last-hash',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { shiftId } = request.query;
      if (!shiftId) {
        return reply.status(400).send({ error: 'shiftId query param required' });
      }
      try {
        const { rows } = await fastify.pg.query<{ chain_hash: string }>(
          `SELECT chain_hash FROM waste_records
           WHERE shift_id = $1
           ORDER BY server_received_at DESC LIMIT 1`,
          [shiftId],
        );
        return reply.send({ lastHash: rows[0]?.chain_hash ?? null });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /waste?shiftId=X — list records for a shift ─────────────────────
  fastify.get<{ Querystring: { shiftId?: string } }>(
    '/waste',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { shiftId } = request.query;
      if (!shiftId) {
        return reply.status(400).send({ error: 'shiftId query param required' });
      }
      try {
        const { rows } = await fastify.pg.query<{
          waste_record_id: string;
          product_id: string | null;
          product_name_ar: string | null;
          quantity_grams: string;
          reason_code: string;
          notes: string | null;
          chain_hash: string;
          previous_hash: string | null;
          approved_by_manager_id: string | null;
          recorded_at: string;
        }>(
          `SELECT
             wr.waste_record_id,
             wr.product_id,
             p.name_ar              AS product_name_ar,
             wr.weight_grams        AS quantity_grams,
             wr.reason_code,
             wr.notes,
             wr.chain_hash,
             wr.previous_hash,
             wr.approved_by         AS approved_by_manager_id,
             wr.server_received_at::text AS recorded_at
           FROM waste_records wr
           LEFT JOIN products p ON p.product_id = wr.product_id
           WHERE wr.shift_id = $1
           ORDER BY wr.server_received_at DESC`,
          [shiftId],
        );
        const records = rows.map((r) => ({
          wasteRecordId: r.waste_record_id,
          productId: r.product_id,
          productNameAr: r.product_name_ar,
          quantityGrams: parseFloat(r.quantity_grams),
          reasonCode: r.reason_code,
          notes: r.notes,
          chainHash: r.chain_hash,
          previousHash: r.previous_hash,
          approvedByManagerId: r.approved_by_manager_id,
          recordedAt: r.recorded_at,
        }));
        return reply.send(records);
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── POST /waste — create a waste record (server-authoritative hash) ─────
  fastify.post<{
    Body: {
      shiftId: string;
      productId: string;
      quantityGrams: number;
      reasonCode: string;
      notes?: string;
      approvedByManagerId?: string;
      recordedByStaffId: string;
    };
  }>('/waste', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const {
      shiftId,
      productId,
      quantityGrams,
      reasonCode,
      notes,
      approvedByManagerId,
      recordedByStaffId,
    } = request.body;

    // ── Strict validation ─────────────────────────────────────────────────
    if (!shiftId) return reply.status(400).send({ error: 'shiftId is required' });
    if (!productId) return reply.status(400).send({ error: 'productId is required' });
    if (
      typeof quantityGrams !== 'number' ||
      !Number.isFinite(quantityGrams) ||
      quantityGrams <= 0
    ) {
      return reply.status(400).send({ error: 'quantityGrams must be a positive number' });
    }
    const VALID_REASONS = ['SPOILED', 'EXPIRED', 'PREP_DAMAGE', 'OTHER'];
    if (!VALID_REASONS.includes(reasonCode)) {
      return reply.status(400).send({
        error: `reasonCode must be one of: ${VALID_REASONS.join(', ')}`,
      });
    }
    if (!recordedByStaffId) {
      return reply.status(400).send({ error: 'recordedByStaffId is required' });
    }
    if (notes && notes.length > 200) {
      return reply.status(400).send({ error: 'notes max length is 200 chars' });
    }

    try {
      // Verify shift open + get tenant/register
      const { rows: shiftRows } = await fastify.pg.query<{
        tenant_id: string;
        register_id: string;
        status: string;
      }>(
        `SELECT tenant_id, register_id, status FROM shifts WHERE shift_id = $1`,
        [shiftId],
      );
      const shift = shiftRows[0];
      if (!shift) return reply.status(404).send({ error: `Shift ${shiftId} not found` });
      if (shift.status !== 'open') {
        return reply.status(400).send({
          error: `Shift ${shiftId} is not open (status: ${shift.status})`,
        });
      }

      // Verify product exists + read is_weighted for threshold
      const { rows: productRows } = await fastify.pg.query<{
        is_weighted: boolean;
      }>(
        `SELECT is_weighted FROM products WHERE product_id = $1 AND is_active = true`,
        [productId],
      );
      const product = productRows[0];
      if (!product) {
        return reply.status(404).send({ error: `Product ${productId} not found` });
      }

      // Threshold guard (server-side enforcement)
      const requiresApproval = product.is_weighted
        ? quantityGrams > 10000 // 10 kg
        : quantityGrams / 100 > 50; // > 50 unit-equivalents (1 unit = 100g)

      if (requiresApproval && !approvedByManagerId) {
        return reply.status(403).send({
          error: 'manager_approval_required',
          message: 'Quantity exceeds threshold — manager PIN required',
        });
      }

      // If approver supplied, verify they are an active manager/supervisor
      if (approvedByManagerId) {
        const { rows: mgrRows } = await fastify.pg.query<{ role: string }>(
          `SELECT role FROM staff WHERE staff_id = $1 AND is_active = true`,
          [approvedByManagerId],
        );
        const mgr = mgrRows[0];
        if (!mgr || (mgr.role !== 'MANAGER' && mgr.role !== 'SUPERVISOR')) {
          return reply.status(403).send({
            error: 'approver_not_manager',
            message: 'approvedByManagerId must reference an active manager',
          });
        }
      }

      // Build hash chain (server-authoritative)
      const { rows: prevRows } = await fastify.pg.query<{ chain_hash: string }>(
        `SELECT chain_hash FROM waste_records
         WHERE shift_id = $1
         ORDER BY server_received_at DESC LIMIT 1`,
        [shiftId],
      );
      const prevHash = prevRows[0]?.chain_hash ?? null;
      const seed = prevHash ?? sha256('GREENGO-WASTE-GENESIS|' + shiftId);
      const recordedAt = new Date().toISOString();
      const payload = [seed, shiftId, productId, quantityGrams, reasonCode, recordedAt].join('|');
      const chainHash = sha256(payload);

      // Insert
      const { rows: insertRows } = await fastify.pg.query<{ waste_record_id: string }>(
        `INSERT INTO waste_records (
           waste_record_id, tenant_id, register_id, shift_id, product_id,
           weight_grams, reason_code, notes, chain_hash, previous_hash,
           recorded_by, approved_by, manager_pin_verified_at,
           client_timestamp, server_received_at, sync_status, source_type
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4,
           $5, $6, $7, $8, $9,
           $10, $11,
           CASE WHEN $11::uuid IS NOT NULL THEN NOW() ELSE NULL END,
           $12, NOW(), 'synced', 'manual'
         )
         RETURNING waste_record_id`,
        [
          shift.tenant_id,
          shift.register_id,
          shiftId,
          productId,
          quantityGrams,
          reasonCode,
          notes ?? null,
          chainHash,
          seed,
          recordedByStaffId,
          approvedByManagerId ?? null,
          recordedAt,
        ],
      );

      if (insertRows.length === 0) {
        return reply.status(500).send({ error: 'Insert returned no rows' });
      }

      return reply.send({
        ok: true,
        wasteRecordId: insertRows[0].waste_record_id,
        chainHash,
        previousHash: seed,
      });
    } catch (err: unknown) {
      return reply.status(500).send({
        error: 'Internal error',
        detail: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RETURNS & REFUNDS
  // ═══════════════════════════════════════════════════════════════════════

  // ── GET /transactions/by-receipt/:receiptNumber ─────────────────────────
  // Looks up a completed transaction by receipt number, scoped to the caller's
  // tenant. Also returns per-item already-returned quantities so the UI can cap
  // the stepper at (originalQty – alreadyReturned).
  // 404 → receipt not found for this tenant.
  // 422 → receipt found but every item already fully returned.
  fastify.get<{ Params: { receiptNumber: string } }>(
    '/transactions/by-receipt/:receiptNumber',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenant claim missing from token' });
      }
      const { receiptNumber } = request.params;

      try {
        // Fetch transaction header
        const { rows: txRows } = await fastify.pg.query<{
          transaction_id: string;
          receipt_number: string;
          total_amount_cents: number;
          payment_method: string;
          items: string;
          created_at: string;
        }>(
          `SELECT transaction_id, receipt_number, total_amount_cents,
                  payment_method, items::text AS items, created_at::text AS created_at
           FROM transactions
           WHERE tenant_id = $1 AND receipt_number = $2
           LIMIT 1`,
          [tenantId, receiptNumber],
        );

        if (txRows.length === 0) {
          return reply.status(404).send({ error: 'Receipt not found' });
        }
        const tx = txRows[0];

        // Aggregate already-returned quantities for this receipt
        const { rows: retRows } = await fastify.pg.query<{
          product_id: string | null;
          returned_qty: string;
        }>(
          `SELECT ri.product_id, SUM(ri.quantity)::int AS returned_qty
           FROM pos_return_items ri
           JOIN pos_returns r ON r.return_id = ri.return_id
           WHERE r.tenant_id = $1 AND r.original_receipt_number = $2
           GROUP BY ri.product_id`,
          [tenantId, receiptNumber],
        );

        const returnedQtyByProduct = new Map<string, number>();
        for (const r of retRows) {
          if (r.product_id) {
            returnedQtyByProduct.set(r.product_id, parseInt(r.returned_qty, 10));
          }
        }

        // Parse JSONB items array
        type RawItem = {
          productId: string;
          quantity: number;
          unitPricePiastres: number;
          lineTotalPiastres: number;
        };
        const rawItems: RawItem[] = JSON.parse(tx.items) as RawItem[];

        const items = rawItems.map((it) => ({
          productId: it.productId,
          productName: (it as Record<string, unknown>).productName as string ?? it.productId,
          quantity: it.quantity,
          unitPricePiastres: it.unitPricePiastres,
          alreadyReturnedQty: returnedQtyByProduct.get(it.productId) ?? 0,
        }));

        // 422 if every item has been fully returned already
        const hasReturnable = items.some(
          (it) => it.alreadyReturnedQty < it.quantity,
        );
        if (!hasReturnable) {
          return reply
            .status(422)
            .send({ error: 'All items on this receipt have already been returned' });
        }

        return reply.send({
          transactionId: tx.transaction_id,
          receiptNumber: tx.receipt_number,
          totalPiastres: tx.total_amount_cents,
          paymentMethod: tx.payment_method,
          createdAt: tx.created_at,
          items,
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── POST /returns — create a return & optional inventory reversal ────────
  interface ReturnItemBody {
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPricePiastres: number;
    disposition: 'restock' | 'damaged' | 'discard';
  }

  interface ReturnBody {
    originalReceiptNumber?: string | null;
    originalTransactionId?: string | null;
    isFreeform: boolean;
    items: ReturnItemBody[];
    refundMethod: 'cash' | 'card' | 'store_credit';
    approvingManagerId?: string | null;
    approvalPin?: string | null;
    shiftId: string;
    cashierId: string;
    clientTotalPiastres: number;
  }

  fastify.post<{ Body: ReturnBody }>(
    '/returns',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenant claim missing from token' });
      }

      const {
        originalReceiptNumber,
        originalTransactionId,
        isFreeform,
        items,
        refundMethod,
        approvingManagerId,
        approvalPin,
        shiftId,
        cashierId,
        clientTotalPiastres,
      } = request.body;

      // ── Basic validation ────────────────────────────────────────────────
      if (!Array.isArray(items) || items.length === 0) {
        return reply.status(400).send({ error: 'items array must not be empty' });
      }
      if (!['cash', 'card', 'store_credit'].includes(refundMethod)) {
        return reply.status(400).send({ error: 'invalid refundMethod' });
      }
      if (!shiftId || !cashierId) {
        return reply.status(400).send({ error: 'shiftId and cashierId are required' });
      }
      for (const it of items) {
        if (!it.productName || it.quantity <= 0 || it.unitPricePiastres < 0) {
          return reply.status(400).send({
            error: `Invalid item: ${JSON.stringify(it)}`,
          });
        }
        if (!['restock', 'damaged', 'discard'].includes(it.disposition)) {
          return reply.status(400).send({ error: `Invalid disposition: ${it.disposition}` });
        }
      }

      // ── Anti-tamper: recompute total ────────────────────────────────────
      const serverTotal = items.reduce(
        (s, it) => s + it.quantity * it.unitPricePiastres,
        0,
      );
      if (Math.abs(serverTotal - clientTotalPiastres) > 2) {
        return reply.status(400).send({
          error: 'Total mismatch — recomputed total does not match submitted total',
          serverTotal,
          clientTotal: clientTotalPiastres,
        });
      }

      // ── Manager PIN threshold check ─────────────────────────────────────
      const returnThreshold = parseInt(
        process.env['RETURN_THRESHOLD_PIASTRES'] ?? '5000',
        10,
      );
      const requiresApproval = isFreeform || serverTotal > returnThreshold;

      if (requiresApproval) {
        if (!approvingManagerId || !approvalPin) {
          return reply.status(403).send({
            error: 'manager_approval_required',
            message: 'Manager PIN required for freeform returns or amounts over threshold',
          });
        }
        // Verify manager exists, is active, has manager/supervisor role, and PIN matches
        const { rows: mgrRows } = await fastify.pg.query<{
          role: string;
          pin_hash: string;
          name_ar: string;
        }>(
          `SELECT role, pin_hash, name_ar
           FROM staff
           WHERE staff_id = $1 AND tenant_id = $2 AND is_active = true`,
          [approvingManagerId, tenantId],
        );
        const mgr = mgrRows[0];
        if (!mgr) {
          return reply
            .status(403)
            .send({ error: 'manager_not_found', message: 'Manager staff member not found' });
        }
        if (mgr.role !== 'MANAGER' && mgr.role !== 'SUPERVISOR') {
          return reply.status(403).send({
            error: 'not_a_manager',
            message: 'Approving staff member is not a manager or supervisor',
          });
        }
        const pinResult = await verifyPin(approvalPin, mgr.pin_hash);
        if (!pinResult.matched) {
          return reply.status(403).send({ error: 'invalid_pin', message: 'Manager PIN incorrect' });
        }
        // Transparent hash migration on successful PIN verify
        if (pinResult.needsRehash) {
          await fastify.pg.query(
            `UPDATE staff SET pin_hash = $1 WHERE staff_id = $2`,
            [pinResult.newHash, approvingManagerId],
          );
        }
      }

      // ── Receipt-based: validate returned quantities don't exceed original ─
      if (originalReceiptNumber && !isFreeform) {
        // Fetch original quantities
        const { rows: origRows } = await fastify.pg.query<{ items: string }>(
          `SELECT items::text AS items FROM transactions
           WHERE tenant_id = $1 AND receipt_number = $2 LIMIT 1`,
          [tenantId, originalReceiptNumber],
        );
        if (origRows.length > 0) {
          type RawLine = { productId: string; quantity: number };
          const origItems: RawLine[] = JSON.parse(origRows[0].items) as RawLine[];
          const origQtyMap = new Map(origItems.map((x) => [x.productId, x.quantity]));

          // Already returned quantities for this receipt
          const { rows: alreadyRows } = await fastify.pg.query<{
            product_id: string;
            returned_qty: string;
          }>(
            `SELECT ri.product_id, SUM(ri.quantity)::int AS returned_qty
             FROM pos_return_items ri
             JOIN pos_returns r ON r.return_id = ri.return_id
             WHERE r.tenant_id = $1 AND r.original_receipt_number = $2
             GROUP BY ri.product_id`,
            [tenantId, originalReceiptNumber],
          );
          const alreadyMap = new Map(
            alreadyRows.map((r) => [r.product_id, parseInt(r.returned_qty, 10)]),
          );

          for (const it of items) {
            if (!it.productId) continue;
            const orig = origQtyMap.get(it.productId) ?? 0;
            const already = alreadyMap.get(it.productId) ?? 0;
            if (it.quantity + already > orig) {
              return reply.status(422).send({
                error: 'exceeds_original_qty',
                message: `Return qty ${it.quantity} for product ${it.productId} exceeds remaining returnable qty ${orig - already}`,
              });
            }
          }
        }
      }

      // ── Insert: atomic return number + header + items (explicit transaction) ─
      // All writes run inside BEGIN/COMMIT so a mid-flight failure rolls back
      // cleanly — prevents the partial-insert → 422-on-retry bug.
      const pgClient = await (fastify.pg as unknown as { connect: () => Promise<{
        query: typeof fastify.pg.query;
        release: () => void;
      }> }).connect();
      try {
        await pgClient.query('BEGIN');

        // Allocate return number (same atomic pattern as receipt/invoice counters)
        const { rows: seqRows } = await pgClient.query<{ last_number: string }>(
          `INSERT INTO tenant_return_counters (tenant_id, last_number)
           VALUES ($1, 1)
           ON CONFLICT (tenant_id) DO UPDATE
             SET last_number = tenant_return_counters.last_number + 1
           RETURNING last_number`,
          [tenantId],
        );
        const returnSeq = parseInt(seqRows[0]?.last_number ?? '0', 10);
        const returnNumber = `RET-${String(returnSeq).padStart(6, '0')}`;

        // Insert return header
        const { rows: retRows } = await pgClient.query<{ return_id: string; created_at: string }>(
          `INSERT INTO pos_returns (
             return_id, tenant_id, return_number,
             original_transaction_id, original_receipt_number,
             cashier_id, approving_manager_id,
             total_piastres, refund_method, is_freeform, shift_id
           ) VALUES (
             gen_random_uuid(), $1, $2,
             $3, $4,
             $5, $6,
             $7, $8, $9, $10
           ) RETURNING return_id, created_at::text AS created_at`,
          [
            tenantId,
            returnNumber,
            originalTransactionId ?? null,
            originalReceiptNumber ?? null,
            cashierId,
            requiresApproval ? (approvingManagerId ?? null) : null,
            serverTotal,
            refundMethod,
            isFreeform,
            shiftId,
          ],
        );

        const { return_id: returnId, created_at: createdAt } = retRows[0];

        // Insert line items
        for (const it of items) {
          await pgClient.query(
            `INSERT INTO pos_return_items (
               return_item_id, return_id, product_id, product_name,
               quantity, unit_price_piastres, line_total_piastres, disposition
             ) VALUES (
               gen_random_uuid(), $1, $2, $3,
               $4, $5, $6, $7
             )`,
            [
              returnId,
              it.productId ?? null,
              it.productName,
              it.quantity,
              it.unitPricePiastres,
              it.quantity * it.unitPricePiastres,
              it.disposition,
            ],
          );

          // Inventory reversal — increments stock for restocked return items.
          // Only applies to products with track_stock = true.
          // A failure logs a warning but does NOT rollback the return.
          if (it.disposition === 'restock' && it.productId) {
            try {
              await pgClient.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity + $1
                 WHERE product_id = $2
                   AND tenant_id = $3
                   AND track_stock = true`,
                [it.quantity, it.productId, tenantId],
              );
            } catch (stockErr: unknown) {
              request.log.warn(
                { productId: it.productId, err: stockErr },
                'returns: stock_quantity restock failed — return committed, stock may be inaccurate',
              );
            }
          }
        }

        await pgClient.query('COMMIT');

        return reply.send({
          ok: true,
          returnId,
          returnNumber,
          totalPiastres: serverTotal,
          refundMethod,
          createdAt,
        });
      } catch (err: unknown) {
        await pgClient.query('ROLLBACK').catch(() => {/* ignore rollback error */});
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      } finally {
        pgClient.release();
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  fastify.get<{ Querystring: { tenantId?: string; from?: string; to?: string } }>(
    '/analytics/summary',
    { config: { allowedRoles: MANAGER_ROLES } },
    async (request, reply) => {
      const { tenantId, from, to } = request.query;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId required' });
      const fromDate = from ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
      const toDate = to ?? new Date().toISOString();

      try {
        // Q1 — sales summary
        const { rows: sumRows } = await fastify.pg.query<{
          total_transactions: string;
          total_sales_piastres: string;
          cash_sales_piastres: string;
          card_sales_piastres: string;
          total_shifts: string;
          active_days: string;
        }>(
          `SELECT
             COUNT(*)                                                                AS total_transactions,
             COALESCE(SUM(total_amount_cents), 0)                                    AS total_sales_piastres,
             COALESCE(SUM(total_amount_cents) FILTER (WHERE payment_method='cash'),0) AS cash_sales_piastres,
             COALESCE(SUM(total_amount_cents) FILTER (WHERE payment_method='card'),0) AS card_sales_piastres,
             COUNT(DISTINCT shift_id)                                                AS total_shifts,
             COUNT(DISTINCT DATE(created_at))                                        AS active_days
           FROM transactions
           WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
          [tenantId, fromDate, toDate],
        );
        const s = sumRows[0];

        // Q2 — sales by day
        const { rows: dayRows } = await fastify.pg.query<{
          sale_date: string;
          tx_count: string;
          daily_sales: string;
        }>(
          `SELECT DATE(created_at)::text AS sale_date,
                  COUNT(*)               AS tx_count,
                  SUM(total_amount_cents) AS daily_sales
           FROM transactions
           WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
           GROUP BY DATE(created_at) ORDER BY sale_date ASC`,
          [tenantId, fromDate, toDate],
        );

        // Q3 — top 10 products
        const { rows: prodRows } = await fastify.pg.query<{
          product_id: string;
          name_ar: string;
          total_qty: string;
          total_revenue: string;
        }>(
          `SELECT x."productId"              AS product_id,
                  p.name_ar,
                  SUM(x."quantity")           AS total_qty,
                  SUM(x."lineTotalPiastres")  AS total_revenue
           FROM transactions t,
             jsonb_to_recordset(t.items) AS x("productId" text, "quantity" int, "lineTotalPiastres" int)
           JOIN products p ON p.product_id::text = x."productId"
           WHERE t.tenant_id = $1 AND t.created_at BETWEEN $2 AND $3
           GROUP BY x."productId", p.name_ar
           ORDER BY total_revenue DESC LIMIT 10`,
          [tenantId, fromDate, toDate],
        );

        // Q4 — waste summary
        const { rows: wasteRows } = await fastify.pg.query<{
          reason_code: string;
          reason_count: string;
          reason_grams: string;
        }>(
          `SELECT reason_code,
                  COUNT(*)               AS reason_count,
                  COALESCE(SUM(weight_grams),0) AS reason_grams
           FROM waste_records
           WHERE tenant_id = $1 AND server_received_at BETWEEN $2 AND $3
           GROUP BY reason_code`,
          [tenantId, fromDate, toDate],
        );
        const totalWasteRecords = wasteRows.reduce((a, r) => a + parseInt(r.reason_count, 10), 0);
        const totalWasteGrams = wasteRows.reduce((a, r) => a + parseFloat(r.reason_grams), 0);

        // Q5 — shifts performance
        const { rows: shiftRows } = await fastify.pg.query<{
          shift_id: string;
          cashier_name_ar: string | null;
          opened_at: string;
          closed_at: string | null;
          total_sales_piastres: number;
          tx_count: string;
        }>(
          `SELECT s.shift_id, s.cashier_name_ar,
                  s.opened_at::text, s.closed_at::text,
                  s.total_sales_piastres,
                  COUNT(t.transaction_id)::int AS tx_count
           FROM shifts s
           LEFT JOIN transactions t ON t.shift_id = s.shift_id
           WHERE s.tenant_id = $1 AND s.opened_at BETWEEN $2 AND $3
           GROUP BY s.shift_id, s.cashier_name_ar,
                    s.opened_at, s.closed_at, s.total_sales_piastres
           ORDER BY s.opened_at DESC LIMIT 20`,
          [tenantId, fromDate, toDate],
        );

        return reply.send({
          summary: {
            totalTransactions: parseInt(s?.total_transactions ?? '0', 10),
            totalSalesPiastres: parseInt(s?.total_sales_piastres ?? '0', 10),
            cashSalesPiastres: parseInt(s?.cash_sales_piastres ?? '0', 10),
            cardSalesPiastres: parseInt(s?.card_sales_piastres ?? '0', 10),
            totalShifts: parseInt(s?.total_shifts ?? '0', 10),
            activeDays: parseInt(s?.active_days ?? '0', 10),
          },
          salesByDay: dayRows.map((d) => ({
            date: d.sale_date,
            txCount: parseInt(d.tx_count, 10),
            salesPiastres: parseInt(d.daily_sales, 10),
          })),
          topProducts: prodRows.map((p) => ({
            productId: p.product_id,
            nameAr: p.name_ar,
            qty: parseInt(p.total_qty, 10),
            revenuePiastres: parseInt(p.total_revenue, 10),
          })),
          wasteSummary: {
            totalRecords: totalWasteRecords,
            totalGrams: totalWasteGrams,
            byReason: wasteRows.map((w) => ({
              reasonCode: w.reason_code,
              count: parseInt(w.reason_count, 10),
              grams: parseFloat(w.reason_grams),
            })),
          },
          shifts: shiftRows.map((sh) => ({
            shiftId: sh.shift_id,
            cashierNameAr: sh.cashier_name_ar,
            openedAt: sh.opened_at,
            closedAt: sh.closed_at,
            salesPiastres: sh.total_sales_piastres,
            txCount: parseInt(sh.tx_count, 10),
          })),
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /analytics/integrity ───────────────────────────────────────────────
  fastify.get<{ Querystring: { tenantId?: string; from?: string; to?: string } }>(
    '/analytics/integrity',
    { config: { allowedRoles: ['MANAGER', 'SUPERVISOR'] as const } },
    async (request, reply) => {
      const tenantId = request.query.tenantId ?? request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId required' });

      const from = request.query.from ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
      const to   = request.query.to   ?? new Date().toISOString();

      const VOID_RATE_MAX        = parseFloat(process.env['INTEGRITY_VOID_RATE_MAX']               ?? '0.05');
      const DISCOUNT_RATE_MAX    = parseFloat(process.env['INTEGRITY_DISCOUNT_RATE_MAX']           ?? '0.10');
      const RETURN_RATE_MAX      = parseFloat(process.env['INTEGRITY_RETURN_RATE_MAX']             ?? '0.05');
      const TX_SECONDS_MIN       = parseInt(process.env['INTEGRITY_TX_SECONDS_MIN']                ?? '30', 10);
      const CASH_SHARE_MAX       = parseFloat(process.env['INTEGRITY_CASH_SHARE_MAX']              ?? '0.95');
      const CASH_DISCREPANCY_MAX = parseInt(process.env['INTEGRITY_CASH_DISCREPANCY_MAX']          ?? '5000', 10);
      const DISCOUNT_THRESHOLD   = parseInt(process.env['INTEGRITY_DISCOUNT_THRESHOLD_PIASTRES']   ?? '5000', 10);
      const RETURN_THRESHOLD     = parseInt(process.env['RETURN_THRESHOLD_PIASTRES']               ?? '5000', 10);

      try {
        // Q1 — per-cashier transaction metrics
        const q1 = await fastify.pg.query<{
          staff_id: string; name_ar: string; name_fr: string; role: string;
          total_transactions: string; voided: string; large_discounts: string;
          cash_count: string; avg_tx_seconds: string | null;
        }>(
          `SELECT
             s.staff_id,
             s.name_ar,
             s.name_fr,
             s.role,
             COUNT(t.transaction_id)                                          AS total_transactions,
             COUNT(CASE WHEN t.status = 'voided'               THEN 1 END)   AS voided,
             COUNT(CASE WHEN t.total_discount_cents > $4       THEN 1 END)   AS large_discounts,
             COUNT(CASE WHEN t.payment_method = 'cash'         THEN 1 END)   AS cash_count,
             AVG(EXTRACT(EPOCH FROM (t.created_at - sh.opened_at)))           AS avg_tx_seconds
           FROM staff s
           LEFT JOIN transactions t
             ON t.cashier_id  = s.staff_id
            AND t.tenant_id   = $1
            AND t.created_at >= $2
            AND t.created_at <= $3
           LEFT JOIN shifts sh ON sh.shift_id = t.shift_id
           WHERE s.tenant_id = $1
             AND s.is_active  = true
           GROUP BY s.staff_id, s.name_ar, s.name_fr, s.role
           ORDER BY voided DESC, large_discounts DESC`,
          [tenantId, from, to, DISCOUNT_THRESHOLD],
        );

        // Q2 — per-cashier large returns
        const q2 = await fastify.pg.query<{ cashier_id: string; large_return_count: string }>(
          `SELECT cashier_id, COUNT(*) AS large_return_count
           FROM pos_returns
           WHERE tenant_id      = $1
             AND total_piastres > $2
             AND created_at    >= $3
             AND created_at    <= $4
           GROUP BY cashier_id`,
          [tenantId, RETURN_THRESHOLD, from, to],
        );

        // Q3 — per-cashier avg cash discrepancy from closed shifts
        const q3 = await fastify.pg.query<{ cashier_id: string; avg_discrepancy: string | null }>(
          `SELECT cashier_id, AVG(cash_variance) AS avg_discrepancy
           FROM shifts
           WHERE tenant_id                 = $1
             AND status                    = 'closed'
             AND closed_at               >= $2
             AND closed_at               <= $3
             AND closing_cash_counted IS NOT NULL
           GROUP BY cashier_id`,
          [tenantId, from, to],
        );

        const returnsMap     = new Map(q2.rows.map((r) => [r.cashier_id, parseInt(r.large_return_count, 10)]));
        const discrepancyMap = new Map(q3.rows.map((r) => [r.cashier_id, r.avg_discrepancy ? parseFloat(r.avg_discrepancy) : null]));

        const cashiers = q1.rows.map((r) => {
          const total        = parseInt(r.total_transactions, 10);
          const voided       = parseInt(r.voided, 10);
          const largeDis     = parseInt(r.large_discounts, 10);
          const cashCount    = parseInt(r.cash_count, 10);
          const avgSeconds   = r.avg_tx_seconds != null ? parseFloat(r.avg_tx_seconds) : null;
          const largeReturns = returnsMap.get(r.staff_id) ?? 0;
          const avgDiscrep   = discrepancyMap.get(r.staff_id) ?? null;

          const voidRate     = total > 0 ? voided / total : 0;
          const discountRate = total > 0 ? largeDis / total : 0;
          const returnRate   = total > 0 ? largeReturns / total : 0;
          const cashShare    = total > 0 ? cashCount / total : 0;

          let anomalyCount = 0;
          if (voidRate     > VOID_RATE_MAX)                                           anomalyCount++;
          if (discountRate > DISCOUNT_RATE_MAX)                                        anomalyCount++;
          if (returnRate   > RETURN_RATE_MAX)                                          anomalyCount++;
          if (avgSeconds   != null && avgSeconds < TX_SECONDS_MIN)                     anomalyCount++;
          if (cashShare    > CASH_SHARE_MAX)                                           anomalyCount++;
          if (avgDiscrep   != null && Math.abs(avgDiscrep) > CASH_DISCREPANCY_MAX)     anomalyCount++;

          return {
            staffId:            r.staff_id,
            nameAr:             r.name_ar,
            nameFr:             r.name_fr,
            role:               r.role,
            totalTransactions:  total,
            voidedCount:        voided,
            voidRate:           Math.round(voidRate     * 1000) / 10,
            largeDiscounts:     largeDis,
            discountRate:       Math.round(discountRate * 1000) / 10,
            cashCount,
            cashShare:          Math.round(cashShare    * 1000) / 10,
            largeReturns,
            returnRate:         Math.round(returnRate   * 1000) / 10,
            avgTxSeconds:       avgSeconds  != null ? Math.round(avgSeconds)  : null,
            avgCashDiscrepancy: avgDiscrep  != null ? Math.round(avgDiscrep)  : null,
            anomalyCount,
          };
        });

        return reply.send({
          cashiers,
          thresholds: {
            voidRateMax:        VOID_RATE_MAX     * 100,
            discountRateMax:    DISCOUNT_RATE_MAX * 100,
            returnRateMax:      RETURN_RATE_MAX   * 100,
            txSecondsMin:       TX_SECONDS_MIN,
            cashShareMax:       CASH_SHARE_MAX    * 100,
            cashDiscrepancyMax: CASH_DISCREPANCY_MAX,
          },
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /analytics/stores — cross-store comparison ─────────────────────────
  // Gated to MANAGER+SUPERVISOR (matches /analytics/summary and /analytics/
  // integrity). MANAGER is currently the highest live POS role; if a dedicated
  // owner/SUPERVISOR role is later provisioned, tighten this to ['SUPERVISOR'].
  // tenantId comes ONLY from the verified JWT — never from client input —
  // so the caller can never enumerate another tenant's stores.
  fastify.get<{ Querystring: { from?: string; to?: string } }>(
    '/analytics/stores',
    { config: { allowedRoles: ['MANAGER', 'SUPERVISOR'] as const } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });

      // Default window: start of today → now.
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const from = request.query.from ?? startOfToday.toISOString();
      const to   = request.query.to   ?? new Date().toISOString();

      try {
        // Q1 — per-store sales, derived by joining transactions through registers.
        const { rows: salesRows } = await fastify.pg.query<{
          store_id: string;
          name_ar: string;
          name_fr: string;
          transaction_count: string;
          total_sales_piastres: string;
          total_discount_piastres: string;
        }>(
          `SELECT
             st.store_id,
             st.name_ar,
             st.name_fr,
             COUNT(DISTINCT t.transaction_id)              AS transaction_count,
             COALESCE(SUM(t.total_amount_cents), 0)        AS total_sales_piastres,
             COALESCE(SUM(t.total_discount_cents), 0)      AS total_discount_piastres
           FROM stores st
           LEFT JOIN registers r ON r.store_id = st.store_id
           LEFT JOIN transactions t
             ON t.register_id = r.register_id
            AND t.tenant_id   = $1
            AND t.created_at  >= $2
            AND t.created_at  <= $3
            AND t.status       = 'completed'
           WHERE st.tenant_id = $1 AND st.is_active = true
           GROUP BY st.store_id, st.name_ar, st.name_fr
           ORDER BY total_sales_piastres DESC`,
          [tenantId, from, to],
        );

        // Q2 — per-store waste, joined through registers → shifts → waste_records.
        // waste_records has no cost column; waste is reported in grams + record
        // count (mirrors how the Summary tab reports waste).
        const { rows: wasteRows } = await fastify.pg.query<{
          store_id: string;
          total_waste_grams: string;
          waste_record_count: string;
        }>(
          `SELECT
             st.store_id,
             COALESCE(SUM(w.weight_grams), 0) AS total_waste_grams,
             COUNT(w.waste_record_id)          AS waste_record_count
           FROM stores st
           LEFT JOIN registers r ON r.store_id = st.store_id
           LEFT JOIN shifts sh    ON sh.register_id = r.register_id
           LEFT JOIN waste_records w
             ON w.shift_id           = sh.shift_id
            AND w.tenant_id          = $1
            AND w.server_received_at >= $2
            AND w.server_received_at <= $3
           WHERE st.tenant_id = $1 AND st.is_active = true
           GROUP BY st.store_id`,
          [tenantId, from, to],
        );

        const wasteMap = new Map(
          wasteRows.map((w) => [
            w.store_id,
            {
              grams: parseFloat(w.total_waste_grams),
              count: parseInt(w.waste_record_count, 10),
            },
          ]),
        );

        const stores = salesRows.map((s) => {
          const waste = wasteMap.get(s.store_id);
          return {
            storeId: s.store_id,
            storeNameAr: s.name_ar,
            storeNameFr: s.name_fr,
            transactionCount: parseInt(s.transaction_count, 10),
            totalSalesPiastres: parseInt(s.total_sales_piastres, 10),
            totalDiscountPiastres: parseInt(s.total_discount_piastres, 10),
            totalWasteGrams: waste?.grams ?? 0,
            wasteRecordCount: waste?.count ?? 0,
          };
        });

        return reply.send({ dateFrom: from, dateTo: to, stores });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── GET /analytics/stores/:storeId/summary — single-store drilldown ────────
  // MANAGER+SUPERVISOR. Same response shape as /analytics/summary, scoped to one
  // store by filtering transactions/shifts through registers.store_id.
  fastify.get<{ Params: { storeId: string }; Querystring: { from?: string; to?: string } }>(
    '/analytics/stores/:storeId/summary',
    { config: { allowedRoles: ['MANAGER', 'SUPERVISOR'] as const } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      const { storeId } = request.params;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const from = request.query.from ?? startOfToday.toISOString();
      const to   = request.query.to   ?? new Date().toISOString();

      try {
        // Ownership guard: confirm the store belongs to the caller's tenant
        // BEFORE running any scoped query. Prevents cross-tenant store_id probing.
        const ownRes = await fastify.pg.query(
          `SELECT name_ar, name_fr FROM stores WHERE store_id = $1 AND tenant_id = $2`,
          [storeId, tenantId],
        );
        if (ownRes.rowCount === 0) {
          return reply.status(404).send({ error: 'Store not found' });
        }
        const storeName = ownRes.rows[0] as { name_ar: string; name_fr: string };

        // Q1 — sales summary, scoped to this store's registers.
        const { rows: sumRows } = await fastify.pg.query<{
          total_transactions: string;
          total_sales_piastres: string;
          cash_sales_piastres: string;
          card_sales_piastres: string;
          total_shifts: string;
          active_days: string;
        }>(
          `SELECT
             COUNT(*)                                                                AS total_transactions,
             COALESCE(SUM(t.total_amount_cents), 0)                                  AS total_sales_piastres,
             COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.payment_method='cash'),0) AS cash_sales_piastres,
             COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.payment_method='card'),0) AS card_sales_piastres,
             COUNT(DISTINCT t.shift_id)                                              AS total_shifts,
             COUNT(DISTINCT DATE(t.created_at))                                      AS active_days
           FROM transactions t
           JOIN registers r ON r.register_id = t.register_id AND r.store_id = $4
           WHERE t.tenant_id = $1 AND t.created_at BETWEEN $2 AND $3`,
          [tenantId, from, to, storeId],
        );
        const s = sumRows[0];

        // Q2 — sales by day.
        const { rows: dayRows } = await fastify.pg.query<{
          sale_date: string;
          tx_count: string;
          daily_sales: string;
        }>(
          `SELECT DATE(t.created_at)::text AS sale_date,
                  COUNT(*)                 AS tx_count,
                  SUM(t.total_amount_cents) AS daily_sales
           FROM transactions t
           JOIN registers r ON r.register_id = t.register_id AND r.store_id = $4
           WHERE t.tenant_id = $1 AND t.created_at BETWEEN $2 AND $3
           GROUP BY DATE(t.created_at) ORDER BY sale_date ASC`,
          [tenantId, from, to, storeId],
        );

        // Q3 — top 10 products.
        const { rows: prodRows } = await fastify.pg.query<{
          product_id: string;
          name_ar: string;
          total_qty: string;
          total_revenue: string;
        }>(
          `SELECT x."productId"             AS product_id,
                  p.name_ar,
                  SUM(x."quantity")           AS total_qty,
                  SUM(x."lineTotalPiastres")  AS total_revenue
           FROM transactions t
           JOIN registers r ON r.register_id = t.register_id AND r.store_id = $4,
             jsonb_to_recordset(t.items) AS x("productId" text, "quantity" int, "lineTotalPiastres" int)
           JOIN products p ON p.product_id::text = x."productId"
           WHERE t.tenant_id = $1 AND t.created_at BETWEEN $2 AND $3
           GROUP BY x."productId", p.name_ar
           ORDER BY total_revenue DESC LIMIT 10`,
          [tenantId, from, to, storeId],
        );

        // Q4 — waste summary (grams + records), scoped through registers→shifts.
        const { rows: wasteRows } = await fastify.pg.query<{
          reason_code: string;
          reason_count: string;
          reason_grams: string;
        }>(
          `SELECT w.reason_code,
                  COUNT(*)                       AS reason_count,
                  COALESCE(SUM(w.weight_grams),0) AS reason_grams
           FROM waste_records w
           JOIN shifts sh    ON sh.shift_id    = w.shift_id
           JOIN registers r  ON r.register_id  = sh.register_id AND r.store_id = $4
           WHERE w.tenant_id = $1 AND w.server_received_at BETWEEN $2 AND $3
           GROUP BY w.reason_code`,
          [tenantId, from, to, storeId],
        );
        const totalWasteRecords = wasteRows.reduce((a, r) => a + parseInt(r.reason_count, 10), 0);
        const totalWasteGrams = wasteRows.reduce((a, r) => a + parseFloat(r.reason_grams), 0);

        return reply.send({
          storeId,
          storeNameAr: storeName.name_ar,
          storeNameFr: storeName.name_fr,
          summary: {
            totalTransactions: parseInt(s?.total_transactions ?? '0', 10),
            totalSalesPiastres: parseInt(s?.total_sales_piastres ?? '0', 10),
            cashSalesPiastres: parseInt(s?.cash_sales_piastres ?? '0', 10),
            cardSalesPiastres: parseInt(s?.card_sales_piastres ?? '0', 10),
            totalShifts: parseInt(s?.total_shifts ?? '0', 10),
            activeDays: parseInt(s?.active_days ?? '0', 10),
          },
          salesByDay: dayRows.map((d) => ({
            date: d.sale_date,
            txCount: parseInt(d.tx_count, 10),
            salesPiastres: parseInt(d.daily_sales, 10),
          })),
          topProducts: prodRows.map((p) => ({
            productId: p.product_id,
            nameAr: p.name_ar,
            qty: parseInt(p.total_qty, 10),
            revenuePiastres: parseInt(p.total_revenue, 10),
          })),
          wasteSummary: {
            totalRecords: totalWasteRecords,
            totalGrams: totalWasteGrams,
            byReason: wasteRows.map((w) => ({
              reasonCode: w.reason_code,
              count: parseInt(w.reason_count, 10),
              grams: parseFloat(w.reason_grams),
            })),
          },
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: 'Internal error',
          detail: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
  );

  // ── Customer routes ────────────────────────────────────────────────────────

  function normalizePhone(raw: string): string {
    // Strip spaces, dashes, dots. Do NOT strip leading zeros.
    return raw.replace(/[\s.\-]/g, '');
  }

  async function buildLoyaltyStatus(
    pg: typeof fastify.pg,
    tenantId: string,
    customerId: string,
    totalVisits: number,
  ) {
    const cfgRes = await pg.query<{
      loyalty_enabled: boolean;
      loyalty_stamps_required: number;
      loyalty_reward_description: string | null;
    }>(
      `SELECT loyalty_enabled, loyalty_stamps_required, loyalty_reward_description
       FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const cfg = cfgRes.rows[0];
    const enabled       = cfg?.loyalty_enabled          ?? false;
    const stampsReq     = cfg?.loyalty_stamps_required  ?? 10;
    const rewardDesc    = cfg?.loyalty_reward_description ?? null;
    const rawStamps       = stampsReq > 0 ? totalVisits % stampsReq : 0;
    const rewardReady     = totalVisits > 0 && rawStamps === 0;
    // Show full card (stampsReq) at reward boundary so display reads 10/10, not 0/10.
    const currentStamps   = rewardReady ? stampsReq : rawStamps;
    const stampsUntilReward = rewardReady ? 0 : stampsReq - currentStamps;
    return {
      enabled,
      stampsRequired: stampsReq,
      currentStamps,
      stampsUntilReward,
      rewardReady,
      rewardDescription: rewardDesc,
    };
  }

  async function buildCustomerResponse(
    pg: typeof fastify.pg,
    row: {
      customer_id: string; tenant_id: string; phone: string;
      name: string | null; notes: string | null;
      total_visits: number; total_spent_piastres: string;
    },
  ) {
    const loyalty = await buildLoyaltyStatus(pg, row.tenant_id, row.customer_id, row.total_visits);
    return {
      customerId:          row.customer_id,
      phone:               row.phone,
      name:                row.name,
      notes:               row.notes,
      totalVisits:         row.total_visits,
      totalSpentPiastres:  parseInt(row.total_spent_piastres as string, 10),
      loyalty,
    };
  }

  // GET /customers/lookup?phone=...
  fastify.get<{ Querystring: { phone?: string } }>(
    '/customers/lookup',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const raw = request.query.phone;
      if (!raw) return reply.status(400).send({ error: 'phone is required' });
      const phone = normalizePhone(raw);
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      try {
        const res = await fastify.pg.query<{
          customer_id: string; tenant_id: string; phone: string;
          name: string | null; notes: string | null;
          total_visits: number; total_spent_piastres: string;
        }>(
          `SELECT customer_id, tenant_id, phone, name, notes, total_visits, total_spent_piastres
           FROM customers WHERE tenant_id = $1 AND phone = $2`,
          [tenantId, phone],
        );
        if (res.rows.length === 0) return reply.status(404).send({ error: 'customer_not_found' });
        return reply.send(await buildCustomerResponse(fastify.pg, res.rows[0]!));
      } catch (err: unknown) {
        request.log.error({ err }, 'customers/lookup: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // GET /customers/:customerId/history
  fastify.get<{ Params: { customerId: string } }>(
    '/customers/:customerId/history',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { customerId } = request.params;
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      try {
        const res = await fastify.pg.query<{
          transaction_id: string; receipt_number: string | null;
          created_at: string; total_amount_cents: string;
          payment_method: string;
        }>(
          `SELECT transaction_id, receipt_number, created_at,
                  total_amount_cents, payment_method
           FROM transactions
           WHERE customer_id = $1 AND tenant_id = $2
           ORDER BY created_at DESC
           LIMIT 20`,
          [customerId, tenantId],
        );
        return reply.send(
          res.rows.map((r) => ({
            transactionId:    r.transaction_id,
            receiptNumber:    r.receipt_number,
            createdAt:        r.created_at,
            totalPiastres:    parseInt(r.total_amount_cents, 10),
            paymentMethod:    r.payment_method,
          })),
        );
      } catch (err: unknown) {
        request.log.error({ err }, 'customers/history: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // POST /customers/:customerId/stamp
  fastify.post<{
    Params: { customerId: string };
    Body: { transactionId?: string };
  }>(
    '/customers/:customerId/stamp',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const { customerId } = request.params;
      const { transactionId } = request.body ?? {};
      if (!transactionId) return reply.status(400).send({ error: 'transactionId is required' });
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      try {
        // Verify transaction belongs to this tenant
        const txRes = await fastify.pg.query<{
          total_amount_cents: string;
        }>(
          `SELECT total_amount_cents FROM transactions
           WHERE transaction_id = $1 AND tenant_id = $2 AND status = 'completed'`,
          [transactionId, tenantId],
        );
        if (txRes.rows.length === 0) {
          return reply.status(404).send({ error: 'transaction_not_found_or_not_completed' });
        }
        const txAmount = parseInt(txRes.rows[0]!.total_amount_cents, 10);

        // Fetch current totalVisits + loyalty config in one query
        const custRes = await fastify.pg.query<{
          total_visits: number; tenant_id: string;
          loyalty_stamps_required: number;
        }>(
          `SELECT c.total_visits, c.tenant_id, t.loyalty_stamps_required
           FROM customers c
           JOIN tenants t ON t.id = c.tenant_id
           WHERE c.customer_id = $1 AND c.tenant_id = $2`,
          [customerId, tenantId],
        );
        if (custRes.rows.length === 0) {
          return reply.status(404).send({ error: 'customer_not_found' });
        }
        const { total_visits, loyalty_stamps_required: stampsReq } = custRes.rows[0]!;
        const stampNumber = (total_visits % stampsReq) + 1;

        // Insert stamp
        await fastify.pg.query(
          `INSERT INTO loyalty_stamps (customer_id, tenant_id, transaction_id, stamp_number)
           VALUES ($1, $2, $3, $4)`,
          [customerId, tenantId, transactionId, stampNumber],
        );

        // Update customer stats and link transaction
        const updatedRes = await fastify.pg.query<{
          customer_id: string; tenant_id: string; phone: string;
          name: string | null; notes: string | null;
          total_visits: number; total_spent_piastres: string;
        }>(
          `UPDATE customers
           SET total_visits         = total_visits + 1,
               total_spent_piastres = total_spent_piastres + $3,
               updated_at           = NOW()
           WHERE customer_id = $1 AND tenant_id = $2
           RETURNING customer_id, tenant_id, phone, name, notes,
                     total_visits, total_spent_piastres`,
          [customerId, tenantId, txAmount],
        );

        // Link customer to transaction for history
        await fastify.pg.query(
          `UPDATE transactions SET customer_id = $1
           WHERE transaction_id = $2 AND tenant_id = $3`,
          [customerId, transactionId, tenantId],
        );

        const loyalty = await buildLoyaltyStatus(
          fastify.pg, tenantId, customerId, updatedRes.rows[0]!.total_visits,
        );
        return reply.send({ loyalty });
      } catch (err: unknown) {
        request.log.error({ err }, 'customers/stamp: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── GET /tenant/config — business type + feature flags for the caller's tenant ─
  fastify.get(
    '/tenant/config',
    { config: { allowedRoles: STAFF_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenant claim missing from token' });
      }
      try {
        const { rows } = await fastify.pg.query<{
          business_type: string;
          feature_flags: Record<string, boolean>;
        }>(
          `SELECT business_type, feature_flags FROM tenants WHERE id = $1`,
          [tenantId],
        );
        if (!rows[0]) {
          return reply.status(404).send({ error: 'Tenant not found' });
        }
        return reply.send({
          businessType: rows[0].business_type,
          featureFlags: rows[0].feature_flags ?? {},
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'tenant/config: query error');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── CUSTOMERS (credit ledger / كريدي) ──────────────────────────────────────

  fastify.get('/customers', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
    const search = (request.query as { q?: string }).q ?? '';
    try {
      const { rows } = await fastify.pg.query(
        `SELECT customer_id, name_ar, name_fr, phone, balance, credit_limit
         FROM customers
         WHERE tenant_id = $1
           AND (name_ar ILIKE $2 OR name_fr ILIKE $2 OR phone ILIKE $2)
         ORDER BY name_ar
         LIMIT 20`,
        [tenantId, `%${search}%`],
      );
      return reply.send(rows);
    } catch (err) {
      return reply.status(500).send({ error: 'Internal error', detail: err instanceof Error ? err.message : 'unknown' });
    }
  });

  fastify.post('/customers', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
    const { name_ar, name_fr, phone, credit_limit } = request.body as {
      name_ar: string; name_fr?: string; phone?: string; credit_limit?: number;
    };
    if (!name_ar?.trim()) return reply.status(400).send({ error: 'name_ar required' });
    try {
      const { rows } = await fastify.pg.query(
        `INSERT INTO customers (tenant_id, name_ar, name_fr, phone, credit_limit)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING customer_id, name_ar, name_fr, phone, balance, credit_limit`,
        [tenantId, name_ar.trim(), name_fr ?? null, phone ?? null, credit_limit ?? 500],
      );
      return reply.status(201).send(rows[0]);
    } catch (err) {
      return reply.status(500).send({ error: 'Internal error', detail: err instanceof Error ? err.message : 'unknown' });
    }
  });

  fastify.post('/customers/:id/charge', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
    const customerId = (request.params as { id: string }).id;
    const { amount, note, sale_id, shiftId, staffId } = request.body as {
      amount: number; note?: string; sale_id?: string; shiftId?: string; staffId?: string;
    };

    const pgClient = await (fastify.pg as unknown as { connect: () => Promise<{
      query: typeof fastify.pg.query; release: () => void;
    }> }).connect();
    try {
      await pgClient.query('BEGIN');
      const cur = await pgClient.query<{ balance: string; credit_limit: string }>(
        `SELECT balance, credit_limit FROM customers
         WHERE customer_id = $1 AND tenant_id = $2 FOR UPDATE`,
        [customerId, tenantId],
      );
      if (!cur.rows[0]) {
        await pgClient.query('ROLLBACK');
        return reply.status(404).send({ error: 'Customer not found' });
      }
      const newBalance = parseFloat(cur.rows[0].balance) + parseFloat(String(amount));
      if (newBalance > parseFloat(cur.rows[0].credit_limit)) {
        await pgClient.query('ROLLBACK');
        return reply.status(422).send({
          error: 'credit_limit_exceeded',
          balance: cur.rows[0].balance,
          credit_limit: cur.rows[0].credit_limit,
          requested: amount,
        });
      }
      await pgClient.query(
        `UPDATE customers SET balance = $1, updated_at = now() WHERE customer_id = $2`,
        [newBalance, customerId],
      );
      const tx = await pgClient.query(
        `INSERT INTO credit_transactions
           (tenant_id, customer_id, shift_id, staff_id, type, amount, balance_after, note, sale_id)
         VALUES ($1,$2,$3,$4,'charge',$5,$6,$7,$8)
         RETURNING *`,
        [tenantId, customerId, shiftId ?? null, staffId ?? null, amount, newBalance, note ?? null, sale_id ?? null],
      );
      await pgClient.query('COMMIT');
      return reply.send({ balance: newBalance, transaction: tx.rows[0] });
    } catch (err) {
      await pgClient.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      pgClient.release();
    }
  });

  fastify.post('/customers/:id/payment', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
    const customerId = (request.params as { id: string }).id;
    const { amount, note, shiftId, staffId } = request.body as {
      amount: number; note?: string; shiftId?: string; staffId?: string;
    };

    const pgClient = await (fastify.pg as unknown as { connect: () => Promise<{
      query: typeof fastify.pg.query; release: () => void;
    }> }).connect();
    try {
      await pgClient.query('BEGIN');
      const cur = await pgClient.query<{ balance: string }>(
        `SELECT balance FROM customers
         WHERE customer_id = $1 AND tenant_id = $2 FOR UPDATE`,
        [customerId, tenantId],
      );
      if (!cur.rows[0]) {
        await pgClient.query('ROLLBACK');
        return reply.status(404).send({ error: 'Customer not found' });
      }
      const newBalance = parseFloat(cur.rows[0].balance) - Math.abs(parseFloat(String(amount)));
      await pgClient.query(
        `UPDATE customers SET balance = $1, updated_at = now() WHERE customer_id = $2`,
        [newBalance, customerId],
      );
      const tx = await pgClient.query(
        `INSERT INTO credit_transactions
           (tenant_id, customer_id, shift_id, staff_id, type, amount, balance_after, note)
         VALUES ($1,$2,$3,$4,'payment',$5,$6,$7)
         RETURNING *`,
        [tenantId, customerId, shiftId ?? null, staffId ?? null, -Math.abs(parseFloat(String(amount))), newBalance, note ?? null],
      );
      await pgClient.query('COMMIT');
      return reply.send({ balance: newBalance, transaction: tx.rows[0] });
    } catch (err) {
      await pgClient.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      pgClient.release();
    }
  });

  fastify.get('/customers/:id/transactions', { config: { allowedRoles: STAFF_ROLES } }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing' });
    const customerId = (request.params as { id: string }).id;
    try {
      const { rows } = await fastify.pg.query(
        `SELECT tx_id, type, amount, balance_after, note, created_at
         FROM credit_transactions
         WHERE customer_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [customerId, tenantId],
      );
      return reply.send(rows);
    } catch (err) {
      return reply.status(500).send({ error: 'Internal error', detail: err instanceof Error ? err.message : 'unknown' });
    }
  });

  // ── CAFÉ: TABLES ─────────────────────────────

  fastify.get('/tables', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const r = await fastify.pg.query(
      `SELECT table_id, label, capacity,
              pos_x, pos_y, status,
              current_order_id
       FROM floor_tables
       WHERE tenant_id = $1
       ORDER BY label`,
      [tenantId],
    );
    return reply.send(r.rows);
  });

  fastify.patch('/tables/:id/status', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { id } = request.params as { id: string };
    const { status, current_order_id } = request.body as {
      status: string;
      current_order_id?: string | null;
    };
    await fastify.pg.query(
      `UPDATE floor_tables
       SET status = $1, current_order_id = $2
       WHERE table_id = $3 AND tenant_id = $4`,
      [status, current_order_id ?? null, id, tenantId],
    );
    return reply.send({ ok: true });
  });

  // ── CAFÉ: ORDERS ─────────────────────────────

  // Lines assigned to a course stay hidden from the kitchen (pending) until that
  // course is fired. The POS course panel passes include_held=1 to see them.
  fastify.get('/cafe/orders', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { include_held } = request.query as { include_held?: string };
    const includeHeld = include_held === '1';
    const r = await fastify.pg.query(
      `SELECT o.*,
              ft.label AS table_label,
              COALESCE(
                json_agg(l.* ORDER BY l.created_at) FILTER (
                  WHERE l.line_id IS NOT NULL
                    AND ($2::boolean OR l.course_number IS NULL OR l.kds_status <> 'pending')
                ),
                '[]'::json
              ) AS lines
       FROM cafe_orders o
       LEFT JOIN cafe_order_lines l
         ON l.order_id = o.order_id
       LEFT JOIN floor_tables ft
         ON ft.table_id = o.table_id
       WHERE o.tenant_id = $1
         AND o.status = 'open'
       GROUP BY o.order_id, ft.label
       ORDER BY o.opened_at`,
      [tenantId, includeHeld],
    );
    return reply.send(r.rows);
  });

  fastify.post('/cafe/orders', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const staffId  = request.auth?.staff_id;
    const { table_id, covers, note } = request.body as {
      table_id?: string;
      covers?: number;
      note?: string;
    };
    const r = await fastify.pg.query(
      `INSERT INTO cafe_orders
         (tenant_id, table_id, staff_id, covers, note)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [tenantId, table_id ?? null, staffId ?? null, covers ?? 1, note ?? null],
    );
    if (table_id) {
      await fastify.pg.query(
        `UPDATE floor_tables
         SET status = 'occupied',
             current_order_id = $1
         WHERE table_id = $2`,
        [r.rows[0].order_id, table_id],
      );
    }
    return reply.status(201).send(r.rows[0]);
  });

  fastify.post('/cafe/orders/:id/lines', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { id } = request.params as { id: string };
    const {
      product_id, name_ar, name_fr,
      quantity, unit_price, modifiers,
    } = request.body as {
      product_id: string;
      name_ar: string;
      name_fr?: string;
      quantity: number;
      unit_price: number;
      modifiers: Array<{ label_ar: string; price_delta: number }>;
    };
    const modifier_total = (modifiers ?? [])
      .reduce((s, m) => s + (m.price_delta ?? 0), 0);
    const line_total = (unit_price + modifier_total) * quantity;
    const r = await fastify.pg.query(
      `INSERT INTO cafe_order_lines
         (order_id, tenant_id, product_id,
          name_ar, name_fr, quantity,
          unit_price, modifiers, modifier_total,
          line_total, sent_to_kds_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       RETURNING *`,
      [id, tenantId, product_id,
       name_ar, name_fr ?? null,
       quantity, unit_price,
       JSON.stringify(modifiers ?? []),
       modifier_total, line_total],
    );
    return reply.status(201).send(r.rows[0]);
  });

  fastify.patch('/cafe/orders/:id/lines/:lineId/kds', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const { id, lineId } = request.params as { id: string; lineId: string };
    const { kds_status } = request.body as { kds_status: string };
    const tsField: Record<string, string> = {
      preparing: 'sent_to_kds_at',
      ready:     'ready_at',
      served:    'served_at',
    };
    const col = tsField[kds_status];
    await fastify.pg.query(
      `UPDATE cafe_order_lines
       SET kds_status = $1
         ${col ? `, ${col} = now()` : ''}
       WHERE line_id = $2 AND order_id = $3`,
      [kds_status, lineId, id],
    );
    return reply.send({ ok: true });
  });

  // ── CAFÉ: ALLERGIES + COURSE FIRING ──────────

  fastify.get('/allergies', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const r = await fastify.pg.query(
      `SELECT allergy_id, code, label_ar, label_fr, label_en, icon, sort_order
       FROM allergy_definitions
       WHERE tenant_id = $1
       ORDER BY sort_order, code`,
      [tenantId],
    );
    return reply.send(r.rows);
  });

  fastify.post('/cafe/orders/:id/lines/:lineId/course', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { id, lineId } = request.params as { id: string; lineId: string };
    const { course_number } = request.body as { course_number: number | null };
    const valid = course_number === null
      || (Number.isInteger(course_number) && course_number >= 1 && course_number <= 9);
    if (!valid) return reply.status(400).send({ error: 'invalid_course_number' });

    // Only lines the kitchen has not started can change course.
    const r = await fastify.pg.query(
      `UPDATE cafe_order_lines
       SET course_number = $1
       WHERE line_id = $2 AND order_id = $3 AND tenant_id = $4
         AND kds_status = 'pending'
       RETURNING line_id, course_number`,
      [course_number, lineId, id, tenantId],
    );
    if (r.rowCount === 0) {
      const exists = await fastify.pg.query(
        `SELECT 1 FROM cafe_order_lines WHERE line_id = $1 AND order_id = $2 AND tenant_id = $3`,
        [lineId, id, tenantId],
      );
      return exists.rowCount === 0
        ? reply.status(404).send({ error: 'line_not_found' })
        : reply.status(409).send({ error: 'line_already_started' });
    }
    return reply.send(r.rows[0]);
  });

  fastify.post('/cafe/orders/:id/fire-course', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const staffId  = request.auth?.staff_id ?? null;
    const { id } = request.params as { id: string };
    const { course_number } = request.body as { course_number: number };
    if (!Number.isInteger(course_number) || course_number < 1 || course_number > 9) {
      return reply.status(400).send({ error: 'invalid_course_number' });
    }

    // One statement: fire the pending lines and log it only if something fired.
    const r = await fastify.pg.query(
      `WITH fired AS (
         UPDATE cafe_order_lines
         SET kds_status = 'preparing', sent_to_kds_at = now()
         WHERE order_id = $1 AND tenant_id = $2
           AND course_number = $3 AND kds_status = 'pending'
         RETURNING line_id
       ), logged AS (
         INSERT INTO course_fire_log (tenant_id, order_id, course_number, fired_by)
         SELECT $2, $1, $3, $4
         WHERE EXISTS (SELECT 1 FROM fired)
         RETURNING fire_id
       )
       SELECT COALESCE((SELECT json_agg(line_id) FROM fired), '[]'::json) AS line_ids,
              (SELECT count(*)::int FROM fired) AS count`,
      [id, tenantId, course_number, staffId],
    );
    return reply.send({
      course_number,
      line_ids: r.rows[0].line_ids as string[],
      count: r.rows[0].count as number,
    });
  });

  fastify.patch('/cafe/orders/:id/lines/:lineId/allergies', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { id, lineId } = request.params as { id: string; lineId: string };
    const { allergy_flags } = request.body as { allergy_flags: string[] };
    if (!Array.isArray(allergy_flags) || allergy_flags.some((f) => typeof f !== 'string')) {
      return reply.status(400).send({ error: 'invalid_allergy_flags' });
    }
    const flags = [...new Set(allergy_flags)];

    if (flags.length > 0) {
      const known = await fastify.pg.query<{ code: string }>(
        `SELECT code FROM allergy_definitions WHERE tenant_id = $1 AND code = ANY($2::text[])`,
        [tenantId, flags],
      );
      const knownCodes = new Set(known.rows.map((k) => k.code));
      const unknown = flags.filter((f) => !knownCodes.has(f));
      if (unknown.length > 0) {
        return reply.status(400).send({ error: 'unknown_allergy', unknown });
      }
    }

    const r = await fastify.pg.query(
      `UPDATE cafe_order_lines
       SET allergy_flags = $1::text[]
       WHERE line_id = $2 AND order_id = $3 AND tenant_id = $4
       RETURNING line_id, allergy_flags`,
      [flags, lineId, id, tenantId],
    );
    if (r.rowCount === 0) return reply.status(404).send({ error: 'line_not_found' });
    return reply.send(r.rows[0]);
  });

  // ── BRANCHES / MULTI-STORE ──────────────────

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Today's figures per store. Each aggregate is its own subquery so the joins
  // cannot multiply rows (revenue must not scale with headcount).
  fastify.get('/branches/overview', {
    config: { allowedRoles: ['SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const r = await fastify.pg.query(
      `SELECT
         s.store_id, s.name_ar, s.name_fr, s.is_active,
         COALESCE(tx.revenue, 0)       AS today_revenue_mad,
         COALESCE(tx.n, 0)::int        AS today_tx,
         COALESCE(sh.open_shifts, 0)::int AS open_shifts,
         COALESCE(sf.staff_count, 0)::int AS staff_count
       FROM stores s
       LEFT JOIN (
         SELECT r.store_id,
                SUM(t.total_amount_cents) / 100.0 AS revenue,
                COUNT(*) AS n
         FROM transactions t
         JOIN registers r ON r.register_id = t.register_id
         WHERE t.tenant_id = $1
           AND t.status = 'completed'
           AND t.sold_at >= CURRENT_DATE
           AND t.sold_at <  CURRENT_DATE + 1
         GROUP BY r.store_id
       ) tx ON tx.store_id = s.store_id
       LEFT JOIN (
         SELECT r.store_id, COUNT(*) AS open_shifts
         FROM shifts sh
         JOIN registers r ON r.register_id = sh.register_id
         WHERE sh.tenant_id = $1 AND sh.status = 'open'
         GROUP BY r.store_id
       ) sh ON sh.store_id = s.store_id
       LEFT JOIN (
         SELECT store_id, COUNT(*) AS staff_count
         FROM staff
         WHERE tenant_id = $1 AND is_active = true AND store_id IS NOT NULL
         GROUP BY store_id
       ) sf ON sf.store_id = s.store_id
       WHERE s.tenant_id = $1
       ORDER BY s.name_ar`,
      [tenantId],
    );
    return reply.send(r.rows);
  });

  fastify.get('/branches/summary', {
    config: { allowedRoles: ['SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { days = '7', store_id } = request.query as { days?: string; store_id?: string };
    if (store_id && !UUID_RE.test(store_id)) {
      return reply.status(400).send({ error: 'invalid_store_id' });
    }
    const dayCount = Math.min(365, Math.max(1, parseInt(days, 10) || 7));
    const r = await fastify.pg.query(
      `SELECT s.name_ar, s.name_fr, bds.*
       FROM branch_daily_summary bds
       JOIN stores s ON s.store_id = bds.store_id
       WHERE bds.tenant_id = $1
         AND bds.summary_date >= CURRENT_DATE - $2::int
         AND ($3::uuid IS NULL OR bds.store_id = $3::uuid)
       ORDER BY bds.summary_date DESC, bds.total_revenue_mad DESC`,
      [tenantId, dayCount, store_id ?? null],
    );
    return reply.send(r.rows);
  });

  // Stock is tracked per product, not per store, so every branch shows the same
  // company-wide figure until per-store stock exists.
  fastify.get('/branches/stock-comparison', {
    config: { allowedRoles: ['SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const r = await fastify.pg.query(
      `SELECT
         p.product_id, p.name_ar, p.name_fr, p.uom,
         p.stock_quantity, p.low_stock_threshold,
         json_agg(json_build_object(
           'store_id', s.store_id,
           'name_ar',  s.name_ar,
           'name_fr',  s.name_fr,
           'stock',    p.stock_quantity,
           'low',      p.stock_quantity <= p.low_stock_threshold
         ) ORDER BY s.name_ar) AS stores
       FROM products p
       JOIN stores s
         ON s.tenant_id = p.tenant_id AND s.is_active = true
       WHERE p.tenant_id = $1
         AND p.track_stock = true
         AND p.is_active = true
       GROUP BY p.product_id, p.name_ar, p.name_fr, p.uom,
                p.stock_quantity, p.low_stock_threshold
       ORDER BY p.name_ar`,
      [tenantId],
    );
    return reply.send(r.rows);
  });

  fastify.get('/branches/transfers', {
    config: { allowedRoles: ['MANAGER', 'SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const r = await fastify.pg.query(
      `SELECT tr.*,
              fs.name_ar AS from_name_ar, fs.name_fr AS from_name_fr,
              ts.name_ar AS to_name_ar,   ts.name_fr AS to_name_fr,
              p.name_ar  AS product_name_ar, p.name_fr AS product_name_fr
       FROM stock_transfers tr
       JOIN stores fs ON fs.store_id = tr.from_store_id
       JOIN stores ts ON ts.store_id = tr.to_store_id
       JOIN products p ON p.product_id = tr.product_id
       WHERE tr.tenant_id = $1
       ORDER BY tr.requested_at DESC
       LIMIT 100`,
      [tenantId],
    );
    return reply.send(r.rows);
  });

  fastify.post('/branches/transfers', {
    config: { allowedRoles: ['MANAGER', 'SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const staffId  = request.auth?.staff_id;
    const { from_store_id, to_store_id, product_id, quantity, unit, notes } = request.body as {
      from_store_id: string;
      to_store_id:   string;
      product_id:    string;
      quantity:      number;
      unit?:         string;
      notes?:        string;
    };

    if (![from_store_id, to_store_id, product_id].every((v) => typeof v === 'string' && UUID_RE.test(v))) {
      return reply.status(400).send({ error: 'invalid_id' });
    }
    if (from_store_id === to_store_id) {
      return reply.status(400).send({ error: 'same_store' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty >= 1_000_000_000) {
      return reply.status(400).send({ error: 'invalid_quantity' });
    }

    // Both stores and the product must belong to the caller's tenant.
    const refs = await fastify.pg.query<{ stores_ok: number; product_ok: number }>(
      `SELECT
         (SELECT count(*) FROM stores
            WHERE tenant_id = $1 AND is_active = true AND store_id = ANY($2::uuid[]))::int AS stores_ok,
         (SELECT count(*) FROM products
            WHERE tenant_id = $1 AND product_id = $3)::int AS product_ok`,
      [tenantId, [from_store_id, to_store_id], product_id],
    );
    if (refs.rows[0]!.stores_ok !== 2 || refs.rows[0]!.product_ok !== 1) {
      return reply.status(400).send({ error: 'unknown_reference' });
    }

    // A branch-scoped manager can only request transfers involving their own store.
    if (staffId) {
      const home = await fastify.pg.query<{ store_id: string | null }>(
        `SELECT store_id FROM staff WHERE staff_id = $1 AND tenant_id = $2`,
        [staffId, tenantId],
      );
      const homeStore = home.rows[0]?.store_id;
      if (homeStore && homeStore !== from_store_id && homeStore !== to_store_id) {
        return reply.status(403).send({ error: 'outside_branch' });
      }
    }

    const r = await fastify.pg.query(
      `INSERT INTO stock_transfers
         (tenant_id, from_store_id, to_store_id, product_id, quantity, unit, notes, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [tenantId, from_store_id, to_store_id, product_id, qty, unit ?? 'unit', notes ?? null, staffId ?? null],
    );
    return reply.status(201).send(r.rows[0]);
  });

  // Status changes only. A transfer does not change stock: stock is per product,
  // so moving it here would just subtract from the company total.
  fastify.patch('/branches/transfers/:id', {
    config: { allowedRoles: ['SUPERVISOR', 'OWNER'] },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const staffId  = request.auth?.staff_id ?? null;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const allowedFrom: Record<string, string[]> = {
      approved:   ['pending'],
      in_transit: ['approved'],
      received:   ['approved', 'in_transit'],
      cancelled:  ['pending', 'approved', 'in_transit'],
    };
    const fromStates = allowedFrom[status];
    if (!UUID_RE.test(id) || !fromStates) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const r = await fastify.pg.query(
      `UPDATE stock_transfers
       SET status = $1::text,
           approved_by = CASE WHEN $1::text = 'approved' THEN $2::uuid ELSE approved_by END,
           approved_at = CASE WHEN $1::text = 'approved' THEN now() ELSE approved_at END,
           received_at = CASE WHEN $1::text = 'received' THEN now() ELSE received_at END
       WHERE transfer_id = $3 AND tenant_id = $4 AND status = ANY($5::text[])
       RETURNING transfer_id, status`,
      [status, staffId, id, tenantId, fromStates],
    );
    if (r.rowCount === 0) {
      const exists = await fastify.pg.query(
        `SELECT 1 FROM stock_transfers WHERE transfer_id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return exists.rowCount === 0
        ? reply.status(404).send({ error: 'not_found' })
        : reply.status(409).send({ error: 'invalid_transition' });
    }
    return reply.send({ ok: true, status: r.rows[0].status });
  });

  fastify.get('/modifiers', {
    config: { allowedRoles: ORDER_TAKING_ROLES },
  }, async (request, reply) => {
    const tenantId = request.auth?.tenant_id;
    const { product_id } = request.query as { product_id?: string };
    const r = await fastify.pg.query(
      `SELECT * FROM modifiers
       WHERE tenant_id = $1
         AND (product_id = $2 OR product_id IS NULL)
       ORDER BY sort_order`,
      [tenantId, product_id ?? null],
    );
    return reply.send(r.rows);
  });

  // ── Staff management: extracted to api/staff/staff-manage-routes.ts (rank rules in
  //    services/staff-access.ts) so privilege escalation is enforced and unit-tested.
  await fastify.register(staffManageRoutes);

  // ─── Product management routes ────────────────────────────────────────────
  const PROD_WRITE_ROLES = ['INVENTORY', 'MANAGER', 'SUPERVISOR', 'OWNER'] as const;

  fastify.post<{
    Body: {
      name_ar: string;
      name_fr?: string;
      category?: string;
      barcode?: string;
      plu_code?: string;
      price_cents?: number;
      cost_price_cents?: number;
      stock_quantity?: number;
      uom?: string;
      track_stock?: boolean;
      is_weighted?: boolean;
      is_bom?: boolean;
    };
  }>(
    '/products',
    { config: { allowedRoles: PROD_WRITE_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      const {
        name_ar, name_fr, category, barcode, plu_code,
        price_cents, cost_price_cents, stock_quantity,
        uom, track_stock, is_weighted, is_bom,
      } = request.body ?? {};

      if (!name_ar?.trim()) return reply.status(400).send({ error: 'name_ar is required' });

      try {
        const r = await fastify.pg.query(
          `INSERT INTO products
             (tenant_id, name_ar, name_fr, category, barcode, plu_code,
              price_cents, cost_price_cents, stock_quantity, uom,
              track_stock, is_weighted, is_bom, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true)
           RETURNING product_id, name_ar, name_fr, category, barcode, plu_code,
                     price_cents, cost_price_cents, stock_quantity, uom,
                     track_stock, is_weighted, is_bom, is_active`,
          [
            tenantId,
            name_ar.trim(),
            name_fr?.trim() ?? null,
            category ?? null,
            barcode ?? null,
            plu_code ?? null,
            price_cents ?? 0,
            cost_price_cents ?? 0,
            stock_quantity ?? 0,
            uom ?? 'UNIT',
            track_stock ?? false,
            is_weighted ?? false,
            is_bom ?? false,
          ],
        );
        return reply.status(201).send(r.rows[0]);
      } catch (err: unknown) {
        fastify.log.error({ err }, '[products] insert failed');
        return reply.status(500).send({ error: err instanceof Error ? err.message : 'Internal error' });
      }
    },
  );

}
