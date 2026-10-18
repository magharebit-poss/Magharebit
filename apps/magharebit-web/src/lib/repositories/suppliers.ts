/**
 * suppliers repository
 *
 * MongoDB collection: `suppliers`
 * Partition key: merchantId
 *
 * Suppliers represent the businesses a merchant buys stock from.
 * Name is required and unique within a merchant's scope.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SupplierDoc {
  id:        string
  merchantId: string
  name:       string      // required, unique within merchant
  phone?:     string
  email?:     string
  address?:   string
  notes?:     string
  isActive:   boolean
  createdAt:  Date
  updatedAt:  Date
}

export interface FindSuppliersOptions {
  merchantId: string
  search?:    string
  page?:      number
  limit?:     number
  isActive?:  boolean   // default: all active
}

export interface FindSuppliersResult {
  suppliers: SupplierDoc[]
  total:     number
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('suppliers')
  await Promise.all([
    col.createIndex({ merchantId: 1, name: 1 }, { unique: true }),
    col.createIndex({ merchantId: 1, isActive: 1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): SupplierDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  return { id, ...rest } as unknown as SupplierDoc
}

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id)
}

// ── Repository ────────────────────────────────────────────────────────────────

export const suppliersRepo = {

  async findAll(opts: FindSuppliersOptions): Promise<FindSuppliersResult> {
    const db = await getDb()
    if (!db) return { suppliers: [], total: 0 }
    await ensureIndexes(db)

    const { merchantId, search, page = 1, limit = 50, isActive } = opts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { merchantId }
    if (isActive !== undefined) filter.isActive = isActive

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(escaped, 'i')
      filter.$or = [{ name: re }, { phone: re }]
    }

    const skip = (page - 1) * limit
    const col  = db.collection('suppliers')
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ name: 1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return {
      suppliers: docs.map(d => toDoc(d as Record<string, unknown>)),
      total,
    }
  },

  async findById(merchantId: string, id: string): Promise<SupplierDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('suppliers').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async create(opts: {
    merchantId: string
    name:       string
    phone?:     string
    email?:     string
    address?:   string
    notes?:     string
  }): Promise<SupplierDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const now = new Date()
    const doc = {
      merchantId: opts.merchantId,
      name:       opts.name.trim(),
      phone:      opts.phone?.trim()   || undefined,
      email:      opts.email?.trim()   || undefined,
      address:    opts.address?.trim() || undefined,
      notes:      opts.notes?.trim()   || undefined,
      isActive:   true,
      createdAt:  now,
      updatedAt:  now,
    }

    try {
      const result = await db.collection('suppliers').insertOne(doc)
      return toDoc({ ...doc, _id: result.insertedId } as unknown as Record<string, unknown>)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate') || msg.includes('E11000')) {
        throw new Error('name_already_exists')
      }
      throw err
    }
  },

  async update(
    merchantId: string,
    id:         string,
    data: Partial<{
      name:     string
      phone:    string
      email:    string
      address:  string
      notes:    string
      isActive: boolean
    }>
  ): Promise<SupplierDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}
    if (data.name     !== undefined) update.name     = data.name.trim()
    if (data.phone    !== undefined) update.phone    = data.phone.trim()    || undefined
    if (data.email    !== undefined) update.email    = data.email.trim()    || undefined
    if (data.address  !== undefined) update.address  = data.address.trim()  || undefined
    if (data.notes    !== undefined) update.notes    = data.notes.trim()    || undefined
    if (data.isActive !== undefined) update.isActive = data.isActive
    update.updatedAt = new Date()

    try {
      const result = await db.collection('suppliers').findOneAndUpdate(
        { _id: new ObjectId(id), merchantId },
        { $set: update },
        { returnDocument: 'after' }
      )
      return result ? toDoc(result as unknown as Record<string, unknown>) : null
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate') || msg.includes('E11000')) {
        throw new Error('name_already_exists')
      }
      throw err
    }
  },
}
