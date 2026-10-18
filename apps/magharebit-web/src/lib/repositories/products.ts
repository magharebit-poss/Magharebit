/**
 * products repository
 *
 * MongoDB collection: `products`
 * Partition key: merchantId (MongoDB _id.toString() of the merchant)
 *
 * Designed to support:
 *   - Phase A: basic CRUD + stock adjustment
 *   - Phase B: variants, composite items (schema-extensible via `meta` field)
 *   - Phase B: low-stock WhatsApp alerts (minStock threshold)
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductUnit = 'pièce' | 'kg' | 'litre' | 'boîte' | 'sachet' | 'unité'

export interface ProductDoc {
  id:          string       // _id.toString(), added by repo
  merchantId:  string       // FK → merchants._id.toString()
  plu:         string       // PLU / SKU (unique within merchant scope)
  name:        string       // product name (language-agnostic: merchant enters in their language)
  category:    string
  price:       number       // selling price in MAD
  costPrice:   number       // purchase cost in MAD (0 if unknown)
  stock:       number       // current stock quantity
  minStock:    number       // low-stock alert threshold
  unit:        ProductUnit
  emoji:       string       // display icon (emoji)
  barcode?:    string       // optional barcode (EAN-13 etc.), distinct from PLU
  isActive:    boolean
  createdAt:   Date
  updatedAt:   Date
}

export interface StockAdjustmentDoc {
  id:         string
  merchantId: string
  productId:  string
  delta:      number       // positive = added, negative = removed
  reason:     StockAdjustReason
  note?:      string
  employeeId?: string
  createdAt:  Date
}

export type StockAdjustReason =
  | 'sale'            // decremented on transaction close
  | 'purchase'        // incremented when purchase order received
  | 'manual_add'      // admin manually topped up
  | 'manual_remove'   // admin manually removed (waste, breakage)
  | 'return'          // customer return
  | 'initial'         // initial seeding

// ── Query options ─────────────────────────────────────────────────────────────

export interface FindProductsOptions {
  merchantId:  string
  search?:     string
  category?:   string
  lowStock?:   boolean   // true → only products where stock <= minStock
  isActive?:   boolean   // default: true only
  page?:       number
  limit?:      number
}

export interface FindProductsResult {
  products: ProductDoc[]
  total:    number
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('products')
  await Promise.all([
    col.createIndex({ merchantId: 1, plu: 1 }, { unique: true }),
    col.createIndex({ merchantId: 1, category: 1 }),
    col.createIndex({ merchantId: 1, isActive: 1 }),
    col.createIndex({ merchantId: 1, stock: 1 }),  // low-stock query
    col.createIndex({ name: 'text' }),              // text search
  ])
  const adjCol = db.collection('stock_adjustments')
  await Promise.all([
    adjCol.createIndex({ merchantId: 1, createdAt: -1 }),
    adjCol.createIndex({ productId: 1, createdAt: -1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): ProductDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  return { id, ...rest } as ProductDoc
}

/** Generate a PLU: P + zero-padded incrementing number within merchant scope */
async function nextPlu(db: Db, merchantId: string): Promise<string> {
  const col = db.collection('products')
  const count = await col.countDocuments({ merchantId })
  return `P-${String(count + 1).padStart(3, '0')}`
}

// ── Repository ────────────────────────────────────────────────────────────────

export const productsRepo = {

  async findAll(opts: FindProductsOptions): Promise<FindProductsResult> {
    const db = await getDb()
    if (!db) return { products: [], total: 0 }
    await ensureIndexes(db)

    const { merchantId, search, category, lowStock, isActive = true, page = 1, limit = 50 } = opts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { merchantId, isActive }

    if (category && category !== 'all') filter.category = category
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: re }, { plu: re }, { barcode: re }]
    }
    if (lowStock) {
      filter.$expr = { $lte: ['$stock', '$minStock'] }
    }

    const col = db.collection('products')
    const skip = (page - 1) * limit
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])

    return { products: docs.map(toDoc), total }
  },

  async findById(merchantId: string, id: string): Promise<ProductDoc | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('products').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async findByPlu(merchantId: string, plu: string): Promise<ProductDoc | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('products').findOne({ merchantId, plu })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async create(
    merchantId: string,
    data: Omit<ProductDoc, 'id' | 'merchantId' | 'plu' | 'createdAt' | 'updatedAt'> & { plu?: string }
  ): Promise<ProductDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const plu = data.plu?.trim() || await nextPlu(db, merchantId)
    const now = new Date()
    const doc = {
      merchantId,
      plu,
      name:      data.name,
      category:  data.category,
      price:     Number(data.price) || 0,
      costPrice: Number(data.costPrice) || 0,
      stock:     Number(data.stock) || 0,
      minStock:  Number(data.minStock) || 5,
      unit:      data.unit ?? 'pièce',
      emoji:     data.emoji ?? '📦',
      barcode:   data.barcode,
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    }
    const result = await db.collection('products').insertOne(doc)
    return toDoc({ ...doc, _id: result.insertedId })
  },

  async update(
    merchantId: string,
    id: string,
    data: Partial<Omit<ProductDoc, 'id' | 'merchantId' | 'createdAt'>>
  ): Promise<ProductDoc | null> {
    const db = await getDb()
    if (!db) return null
    const update: Record<string, unknown> = { ...data, updatedAt: new Date() }
    // Never allow overwriting these fields via update
    delete update.id
    delete update.merchantId
    delete update.createdAt

    const result = await db.collection('products').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId },
      { $set: update },
      { returnDocument: 'after' }
    )
    return result ? toDoc(result as Record<string, unknown>) : null
  },

  /** Soft delete — sets isActive=false */
  async softDelete(merchantId: string, id: string): Promise<boolean> {
    const db = await getDb()
    if (!db) return false
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(id), merchantId },
      { $set: { isActive: false, updatedAt: new Date() } }
    )
    return result.modifiedCount > 0
  },

  /**
   * Adjust stock and record the adjustment log.
   * Returns the updated product or null if not found.
   * Automatically fires the low-stock check hook (resolved by caller).
   */
  async adjustStock(
    merchantId: string,
    productId: string,
    delta: number,
    reason: StockAdjustReason,
    opts?: { note?: string; employeeId?: string }
  ): Promise<{ product: ProductDoc | null; isLowStock: boolean }> {
    const db = await getDb()
    if (!db) return { product: null, isLowStock: false }
    await ensureIndexes(db)

    // Atomic increment
    const result = await db.collection('products').findOneAndUpdate(
      { _id: new ObjectId(productId), merchantId },
      { $inc: { stock: delta }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!result) return { product: null, isLowStock: false }
    const product = toDoc(result as Record<string, unknown>)

    // Record adjustment log
    await db.collection('stock_adjustments').insertOne({
      merchantId,
      productId,
      delta,
      reason,
      note:       opts?.note,
      employeeId: opts?.employeeId,
      createdAt:  new Date(),
    })

    const isLowStock = product.stock <= product.minStock && product.stock >= 0
    return { product, isLowStock }
  },

  async getLowStockProducts(merchantId: string): Promise<ProductDoc[]> {
    const db = await getDb()
    if (!db) return []
    const docs = await db.collection('products').find({
      merchantId,
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] },
    }).sort({ stock: 1 }).toArray()
    return docs.map(d => toDoc(d as Record<string, unknown>))
  },

  async getLowStockCount(merchantId: string): Promise<number> {
    const db = await getDb()
    if (!db) return 0
    return db.collection('products').countDocuments({
      merchantId,
      isActive: true,
      $expr: { $lte: ['$stock', '$minStock'] },
    })
  },

  async getCategories(merchantId: string): Promise<string[]> {
    const db = await getDb()
    if (!db) return []
    const cats = await db.collection('products').distinct('category', {
      merchantId, isActive: true,
    })
    return cats.filter(Boolean).sort() as string[]
  },

  /** Bulk-insert sector starter products (idempotent by plu) */
  async seedFromTemplate(
    merchantId: string,
    products: Array<Omit<ProductDoc, 'id' | 'merchantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<number> {
    const db = await getDb()
    if (!db) return 0
    await ensureIndexes(db)
    const now = new Date()
    let inserted = 0
    for (const p of products) {
      const exists = await db.collection('products').findOne({ merchantId, plu: p.plu })
      if (!exists) {
        await db.collection('products').insertOne({
          ...p,
          merchantId,
          isActive:  true,
          createdAt: now,
          updatedAt: now,
        })
        inserted++
      }
    }
    return inserted
  },
}
