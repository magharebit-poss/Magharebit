/**
 * transactions repository
 *
 * MongoDB collection: `transactions`
 * Partition key: merchantId
 *
 * Each transaction = one POS sale (receipt).
 * Stock adjustment is handled here via productsRepo.adjustStock().
 *
 * Sprint 3 additions:
 *   - T1: taxRate + taxAmount + totalHT fields
 *   - T2: discountType + discountValue (replaces bare `discount` number)
 *   - Totals computed via shared computeTotals() helper — single source of truth
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { productsRepo } from './products'
import {
  computeTotals,
  type TaxRate,
  type DiscountType,
} from '../transaction-totals'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'mixed'

export interface TransactionItem {
  productId:     string
  plu:           string
  name:          string
  qty:           number
  unitPrice:     number    // price at time of sale (snapshot)
  itemDiscount?: number    // T2: per-item flat discount in MAD (optional, defaults 0)
  total:         number    // (qty × unitPrice) − itemDiscount
}

export interface TransactionDoc {
  id:             string
  merchantId:     string
  receiptNo:      string         // human-readable: "#1024"
  employeeId?:    string         // FK → employees._id.toString()
  employeeName?:  string         // denormalised for fast display
  customerId?:    string         // FK → customers
  items:          TransactionItem[]

  // ── Totals (all computed by computeTotals(), never stored manually) ─────────
  subtotal:       number         // sum of item totals
  discountType:   DiscountType   // 'amount' | 'percent'
  discountValue:  number         // raw value (MAD or %)
  discount:       number         // absolute MAD reduction (computed)
  totalHT:        number         // subtotal − discount  (pre-tax)
  taxRate:        TaxRate        // 0 | 7 | 10 | 14 | 20
  taxAmount:      number         // totalHT × taxRate / 100
  total:          number         // totalHT + taxAmount  (grand total)

  paymentMethod:  PaymentMethod
  note?:          string
  createdAt:      Date
}

// ── Summary types (for reports + dashboard) ───────────────────────────────────

export interface DailySummary {
  date:              string       // YYYY-MM-DD
  totalRevenue:      number
  totalTransactions: number
  avgBasket:         number
  byPayment:         Record<PaymentMethod, number>
}

export interface ProductSalesSummary {
  productId:    string
  plu:          string
  name:         string
  totalQty:     number
  totalRevenue: number
}

export interface ReportSummary {
  period:                { from: string; to: string }
  totalRevenue:          number
  totalTransactions:     number
  avgBasket:             number
  comparedToLastPeriod?: { revenueChange: number; txChange: number }
  byPayment:             Record<string, number>
  byDay:                 DailySummary[]
  topProducts:           ProductSalesSummary[]
  byEmployee:            Array<{ employeeId: string; employeeName: string; total: number; txCount: number }>
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('transactions')
  await Promise.all([
    col.createIndex({ merchantId: 1, createdAt: -1 }),
    col.createIndex({ merchantId: 1, employeeId: 1 }),
    col.createIndex({ merchantId: 1, 'items.productId': 1 }),
    col.createIndex({ receiptNo: 1, merchantId: 1 }, { unique: true }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): TransactionDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  // Back-compat: pre-Sprint-3 documents stored a flat `discount` with no type/value.
  // Normalise them on read so callers always see the full shape.
  const doc = rest as Record<string, unknown>
  if (doc.discountType === undefined) {
    doc.discountType  = 'amount'
    doc.discountValue = doc.discount ?? 0
  }
  if (doc.taxRate    === undefined) doc.taxRate    = 0
  if (doc.taxAmount  === undefined) doc.taxAmount  = 0
  if (doc.totalHT    === undefined) doc.totalHT    = (doc.total as number ?? 0)
  return { id, ...doc } as TransactionDoc
}

async function nextReceiptNo(db: Db, merchantId: string): Promise<string> {
  const count = await db.collection('transactions').countDocuments({ merchantId })
  return `#${String(count + 1001).padStart(4, '0')}`
}

// ── Repository ────────────────────────────────────────────────────────────────

export const transactionsRepo = {

  async findAll(opts: {
    merchantId:   string
    from?:        Date
    to?:          Date
    employeeId?:  string
    page?:        number
    limit?:       number
  }): Promise<{ transactions: TransactionDoc[]; total: number }> {
    const db = await getDb()
    if (!db) return { transactions: [], total: 0 }
    await ensureIndexes(db)

    const { merchantId, from, to, employeeId, page = 1, limit = 50 } = opts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { merchantId }
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = from
      if (to)   filter.createdAt.$lte = to
    }
    if (employeeId) filter.employeeId = employeeId

    const skip = (page - 1) * limit
    const col  = db.collection('transactions')
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return { transactions: docs.map(d => toDoc(d as Record<string, unknown>)), total }
  },

  /**
   * Create a sale transaction.
   *
   * T1/T2 additions: accepts discountType, discountValue, taxRate.
   * Totals are computed via the shared computeTotals() helper — callers never
   * pass pre-computed subtotals or totals.
   *
   * Atomically decrements stock for each item.
   * Returns low-stock items for the caller to trigger alerts.
   */
  async create(opts: {
    merchantId:     string
    items:          Array<{ productId: string; qty: number; itemDiscount?: number }>
    paymentMethod:  PaymentMethod
    employeeId?:    string
    employeeName?:  string
    customerId?:    string
    // T2: discount
    discountType?:  DiscountType   // default 'amount'
    discountValue?: number         // default 0
    // T1: tax
    taxRate?:       TaxRate        // default 0
    note?:          string
  }): Promise<{
    transaction:   TransactionDoc
    lowStockItems: Array<{ productId: string; name: string; stock: number }>
  }> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const {
      merchantId, paymentMethod, employeeId, employeeName, customerId, note,
      discountType  = 'amount',
      discountValue = 0,
      taxRate       = 0,
    } = opts

    // ── Resolve products + build line items ──────────────────────────────────
    const lineItems: TransactionItem[] = []
    for (const { productId, qty, itemDiscount = 0 } of opts.items) {
      const product = await productsRepo.findById(merchantId, productId)
      if (!product) throw new Error(`product_not_found:${productId}`)
      if (!Number.isInteger(qty) || qty <= 0) throw new Error(`invalid_qty:${productId}`)
      const lineTotal = Math.round((product.price * qty - itemDiscount) * 100) / 100
      lineItems.push({
        productId,
        plu:          product.plu,
        name:         product.name,
        qty,
        unitPrice:    product.price,
        ...(itemDiscount > 0 ? { itemDiscount } : {}),
        total:        lineTotal,
      })
    }

    // ── Compute totals via shared helper (single source of truth) ────────────
    const totals = computeTotals({
      lineTotals:    lineItems.map(i => i.total),
      discountType,
      discountValue,
      taxRate,
    })

    const receiptNo = await nextReceiptNo(db, merchantId)
    const now       = new Date()

    const doc = {
      merchantId,
      receiptNo,
      employeeId,
      employeeName,
      customerId,
      items:         lineItems,
      // Totals (all from computeTotals)
      subtotal:      totals.subtotal,
      discountType,
      discountValue,
      discount:      totals.discount,
      totalHT:       totals.totalHT,
      taxRate,
      taxAmount:     totals.taxAmount,
      total:         totals.total,
      paymentMethod,
      note,
      createdAt:     now,
    }

    const result = await db.collection('transactions').insertOne(doc)
    const transaction = toDoc({ ...doc, _id: result.insertedId })

    // ── Decrement stock + collect low-stock warnings ─────────────────────────
    const lowStockItems: Array<{ productId: string; name: string; stock: number }> = []
    for (const item of lineItems) {
      const { product: updated, isLowStock } = await productsRepo.adjustStock(
        merchantId,
        item.productId,
        -item.qty,
        'sale',
        { employeeId }
      )
      if (isLowStock && updated) {
        lowStockItems.push({
          productId: item.productId,
          name:      updated.name,
          stock:     updated.stock,
        })
      }
    }

    return { transaction, lowStockItems }
  },

  /** Today's totals (for dashboard stat cards) */
  async getTodaySummary(merchantId: string): Promise<{
    totalRevenue:      number
    totalTransactions: number
    avgBasket:         number
  }> {
    const db = await getDb()
    if (!db) return { totalRevenue: 0, totalTransactions: 0, avgBasket: 0 }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const result = await db.collection('transactions').aggregate([
      { $match: { merchantId, createdAt: { $gte: todayStart } } },
      { $group: {
        _id:   null,
        total: { $sum: '$total' },
        count: { $sum: 1 },
      }},
    ]).toArray()

    const row = result[0] as { total?: number; count?: number } | undefined
    const totalRevenue      = Math.round((row?.total ?? 0) * 100) / 100
    const totalTransactions = row?.count ?? 0
    const avgBasket         = totalTransactions > 0
      ? Math.round((totalRevenue / totalTransactions) * 100) / 100
      : 0

    return { totalRevenue, totalTransactions, avgBasket }
  },

  /** Comparison with yesterday (for dashboard delta %) */
  async getYesterdaySummary(merchantId: string): Promise<{ totalRevenue: number; totalTransactions: number }> {
    const db = await getDb()
    if (!db) return { totalRevenue: 0, totalTransactions: 0 }

    const yStart = new Date(); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0, 0, 0, 0)
    const yEnd   = new Date(); yEnd.setDate(yEnd.getDate() - 1);   yEnd.setHours(23, 59, 59, 999)

    const result = await db.collection('transactions').aggregate([
      { $match: { merchantId, createdAt: { $gte: yStart, $lte: yEnd } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]).toArray()

    const row = result[0] as { total?: number; count?: number } | undefined
    return { totalRevenue: row?.total ?? 0, totalTransactions: row?.count ?? 0 }
  },

  /**
   * Full report aggregate for a date range.
   * Used by the reports page.
   */
  async getReportSummary(opts: {
    merchantId: string
    from:       Date
    to:         Date
  }): Promise<ReportSummary> {
    const db = await getDb()
    const { merchantId, from, to } = opts
    const emptyReport: ReportSummary = {
      period:            { from: from.toISOString(), to: to.toISOString() },
      totalRevenue:      0,
      totalTransactions: 0,
      avgBasket:         0,
      byPayment:         {},
      byDay:             [],
      topProducts:       [],
      byEmployee:        [],
    }
    if (!db) return emptyReport

    const match = { $match: { merchantId, createdAt: { $gte: from, $lte: to } } }

    const [totalsResult, byDayResult, topProductsResult, byEmployeeResult] = await Promise.all([

      db.collection('transactions').aggregate([
        match,
        { $group: {
          _id:   '$paymentMethod',
          total: { $sum: '$total' },
          count: { $sum: 1 },
        }},
      ]).toArray(),

      db.collection('transactions').aggregate([
        match,
        { $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]).toArray(),

      db.collection('transactions').aggregate([
        match,
        { $unwind: '$items' },
        { $group: {
          _id:          '$items.productId',
          plu:          { $first: '$items.plu' },
          name:         { $first: '$items.name' },
          totalQty:     { $sum: '$items.qty' },
          totalRevenue: { $sum: '$items.total' },
        }},
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]).toArray(),

      db.collection('transactions').aggregate([
        match,
        { $match: { employeeId: { $exists: true, $ne: null } } },
        { $group: {
          _id:          '$employeeId',
          employeeName: { $first: '$employeeName' },
          total:        { $sum: '$total' },
          txCount:      { $sum: 1 },
        }},
        { $sort: { total: -1 } },
      ]).toArray(),
    ])

    let totalRevenue = 0
    let totalTransactions = 0
    const byPayment: Record<string, number> = {}
    for (const row of totalsResult as Array<{ _id: string; total: number; count: number }>) {
      byPayment[row._id] = Math.round(row.total * 100) / 100
      totalRevenue      += row.total
      totalTransactions += row.count
    }
    totalRevenue = Math.round(totalRevenue * 100) / 100

    const byDay: DailySummary[] = (byDayResult as Array<{ _id: string; total: number; count: number }>)
      .map(r => ({
        date:              r._id,
        totalRevenue:      Math.round(r.total * 100) / 100,
        totalTransactions: r.count,
        avgBasket:         r.count > 0 ? Math.round((r.total / r.count) * 100) / 100 : 0,
        byPayment:         {} as Record<PaymentMethod, number>,
      }))

    const topProducts: ProductSalesSummary[] = (topProductsResult as Array<{
      _id: string; plu: string; name: string; totalQty: number; totalRevenue: number
    }>).map(r => ({
      productId:    r._id,
      plu:          r.plu,
      name:         r.name,
      totalQty:     r.totalQty,
      totalRevenue: Math.round(r.totalRevenue * 100) / 100,
    }))

    const byEmployee = (byEmployeeResult as Array<{
      _id: string; employeeName: string; total: number; txCount: number
    }>).map(r => ({
      employeeId:   r._id,
      employeeName: r.employeeName ?? '—',
      total:        Math.round(r.total * 100) / 100,
      txCount:      r.txCount,
    }))

    return {
      period:            { from: from.toISOString(), to: to.toISOString() },
      totalRevenue,
      totalTransactions,
      avgBasket:         totalTransactions > 0
        ? Math.round((totalRevenue / totalTransactions) * 100) / 100
        : 0,
      byPayment,
      byDay,
      topProducts,
      byEmployee,
    }
  },
}
