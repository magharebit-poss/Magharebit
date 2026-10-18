/**
 * GET  /api/portal/transactions  — list transactions (paged, filterable)
 * POST /api/portal/transactions  — create a sale
 *
 * Sprint 3 POST body (new fields marked ★):
 * {
 *   items:          { productId: string; qty: number; itemDiscount?: number }[]
 *   paymentMethod:  'cash' | 'card' | 'mobile_money' | 'mixed'
 *   ★ discountType:  'amount' | 'percent'   (default: 'amount')
 *   ★ discountValue: number                  (default: 0)
 *     discount?:    number  ← legacy alias: treated as discountType='amount', discountValue=discount
 *   ★ taxRate:      0 | 7 | 10 | 14 | 20    (default: merchant's defaultTaxRate from settings)
 *   employeeId?:    string
 *   customerId?:    string
 *   note?:          string
 * }
 *
 * Validation rules (locked in Sprint 3):
 *   - taxRate must be one of VALID_TAX_RATES (0, 7, 10, 14, 20)
 *   - discountType must be 'amount' or 'percent'
 *   - discountValue must be >= 0
 *   - if discountType='percent', value must be <= settings.maxDiscountPercent
 *   - if discountEnabled=false in settings, discountValue must be 0
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { transactionsRepo } from '@/lib/repositories/transactions'
import type { PaymentMethod } from '@/lib/repositories/transactions'
import { settingsRepo } from '@/lib/repositories/settings'
import { customersRepo } from '@/lib/repositories/customers'
import { sendLowStockAlert, sendCustomerReceipt } from '@/lib/whatsapp'
import {
  VALID_TAX_RATES,
  isValidTaxRate,
  type TaxRate,
  type DiscountType,
} from '@/lib/transaction-totals'

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'mobile_money', 'mixed']
const VALID_DISCOUNT_TYPES:  DiscountType[]  = ['amount', 'percent']

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const page  = Math.max(1,   Number(searchParams.get('page')  ?? 1))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))

  const dateFrom = searchParams.get('dateFrom') ?? undefined
  const dateTo   = searchParams.get('dateTo')   ?? undefined
  const _method  = searchParams.get('method')   ?? undefined
  void _method

  const result = await transactionsRepo.findAll({
    merchantId: session.merchantId,
    page,
    limit,
    from: dateFrom ? new Date(dateFrom) : undefined,
    to:   dateTo   ? new Date(dateTo)   : undefined,
  })

  return NextResponse.json(result)
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // ── 1. Validate items ────────────────────────────────────────────────────────
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'items_required' }, { status: 422 })
  }

  const items: { productId: string; qty: number; itemDiscount?: number }[] = []
  for (const item of rawItems) {
    const productId    = String(item?.productId ?? '').trim()
    const qty          = Number(item?.qty ?? 0)
    const itemDiscount = item?.itemDiscount !== undefined ? Number(item.itemDiscount) : undefined

    if (!productId) {
      return NextResponse.json({ error: 'item_missing_productId' }, { status: 422 })
    }
    if (!Number.isInteger(qty) || qty < 1) {
      return NextResponse.json({ error: 'item_qty_must_be_positive_integer', productId }, { status: 422 })
    }
    if (itemDiscount !== undefined && (itemDiscount < 0 || !isFinite(itemDiscount))) {
      return NextResponse.json({ error: 'item_discount_must_be_non_negative', productId }, { status: 422 })
    }
    items.push({ productId, qty, ...(itemDiscount !== undefined ? { itemDiscount } : {}) })
  }

  // ── 2. Validate payment method ───────────────────────────────────────────────
  const paymentMethod = String(body.paymentMethod ?? 'cash').trim() as PaymentMethod
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return NextResponse.json({ error: 'invalid_payment_method', valid: VALID_PAYMENT_METHODS }, { status: 422 })
  }

  // ── 3. Resolve discount fields (with legacy `discount` alias) ────────────────
  //
  // Priority:  explicit discountType+discountValue > legacy `discount` number
  let discountType:  DiscountType
  let discountValue: number

  if (body.discountType !== undefined || body.discountValue !== undefined) {
    // New-style: explicit type + value
    discountType  = String(body.discountType  ?? 'amount') as DiscountType
    discountValue = Math.max(0, Number(body.discountValue ?? 0))

    if (!VALID_DISCOUNT_TYPES.includes(discountType)) {
      return NextResponse.json(
        { error: 'invalid_discount_type', valid: VALID_DISCOUNT_TYPES },
        { status: 422 }
      )
    }
    if (!isFinite(discountValue)) {
      return NextResponse.json({ error: 'discount_value_must_be_a_finite_number' }, { status: 422 })
    }
  } else {
    // Legacy path: `discount` is a flat MAD amount
    discountType  = 'amount'
    discountValue = Math.max(0, Number(body.discount ?? 0))
  }

  // ── 4. Validate tax rate ─────────────────────────────────────────────────────
  //
  // If `taxRate` not provided, the repo uses the merchant's defaultTaxRate.
  // When provided explicitly, it must be in VALID_TAX_RATES.
  let taxRate: TaxRate | undefined
  if (body.taxRate !== undefined) {
    const raw = Number(body.taxRate)
    if (!isValidTaxRate(raw)) {
      return NextResponse.json(
        { error: 'invalid_tax_rate', valid: VALID_TAX_RATES },
        { status: 422 }
      )
    }
    taxRate = raw
  }
  // taxRate=undefined here means "use merchant defaultTaxRate" — resolved below

  const employeeId = String(body.employeeId ?? '').trim() || undefined
  const customerId = String(body.customerId ?? '').trim() || undefined
  const note       = String(body.note       ?? '').trim() || undefined

  // ── 5. Fetch merchant settings for defaults + policy validation ──────────────
  const settings = await settingsRepo.get(session.merchantId)

  // Resolve taxRate: explicit value wins, else use merchant default
  const resolvedTaxRate: TaxRate = taxRate !== undefined
    ? taxRate
    : (settings.taxEnabled ? settings.defaultTaxRate : 0)

  // Discount policy: block discounts if merchant has disabled them
  if (discountValue > 0 && !settings.discountEnabled) {
    return NextResponse.json({ error: 'discounts_disabled_by_merchant' }, { status: 422 })
  }

  // Percent discount must not exceed merchant ceiling
  if (discountType === 'percent' && discountValue > settings.maxDiscountPercent) {
    return NextResponse.json({
      error:     'discount_exceeds_maximum',
      maximum:   settings.maxDiscountPercent,
      provided:  discountValue,
    }, { status: 422 })
  }

  // ── 6. Create transaction ────────────────────────────────────────────────────
  try {
    const result = await transactionsRepo.create({
      merchantId:    session.merchantId,
      items,
      paymentMethod,
      discountType,
      discountValue,
      taxRate:       resolvedTaxRate,
      employeeId,
      customerId,
      note,
    })

    // ── Fire-and-forget: loyalty update ────────────────────────────────────────
    if (customerId) {
      void (async () => {
        try {
          await customersRepo.recordVisit(
            session.merchantId,
            customerId,
            result.transaction.total
          )
        } catch { /* CRM failure must never block the sale */ }
      })()
    }

    // ── Fire-and-forget: low-stock WhatsApp alert ───────────────────────────────
    if (result.lowStockItems.length > 0) {
      void (async () => {
        try {
          if (settings.whatsappEnabled && settings.lowStockAlert && settings.storePhone) {
            await sendLowStockAlert({
              to:        settings.storePhone,
              storeName: settings.storeName || 'متجرك',
              items:     result.lowStockItems.map(i => ({
                name:     i.name,
                stock:    i.stock,
                minStock: 0,
              })),
            })
          }
        } catch { /* alert failure must never block the sale */ }
      })()
    }

    // ── Fire-and-forget: customer WhatsApp receipt (W4) ───────────────────────
    // Three gates (all must be true):
    //   1. customer is linked to this transaction
    //   2. merchant has WhatsApp enabled AND customerWhatsappReceiptEnabled
    //   3. customer has a valid phone number (checked inside the async block)
    if (
      customerId &&
      settings.whatsappEnabled &&
      settings.customerWhatsappReceiptEnabled
    ) {
      void (async () => {
        try {
          const customer = await customersRepo.findById(
            session.merchantId,
            customerId
          )
          // Gate 3: customer must exist and have a phone
          if (!customer?.phone) return

          await sendCustomerReceipt({
            customerPhone:  customer.phone,
            storeName:      settings.storeName || 'متجرك',
            receiptNo:      result.transaction.receiptNo,
            createdAt:      result.transaction.createdAt,
            items:          result.transaction.items.map(i => ({
              name:      i.name,
              qty:       i.qty,
              unitPrice: i.unitPrice,
              total:     i.total,
            })),
            subtotal:       result.transaction.subtotal,
            discount:       result.transaction.discount,
            totalHT:        result.transaction.totalHT,
            taxRate:        result.transaction.taxRate,
            taxAmount:      result.transaction.taxAmount,
            total:          result.transaction.total,
            receiptFooter:  settings.receiptFooter,
            loyaltyPoints:  customer.loyaltyPoints,
          })
        } catch { /* never block the 201 response */ }
      })()
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.startsWith('insufficient_stock:')) {
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    if (msg.startsWith('product_not_found:')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
