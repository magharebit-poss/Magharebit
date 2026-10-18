/**
 * customers repository
 *
 * MongoDB collection: `customers`
 * Partition key: merchantId
 *
 * Loyalty model (Phase B, extensible):
 *   1 MAD spent = LOYALTY_RATE points  (currently 1, move to MerchantSettings later)
 *   Bronze: 0–499 pts  |  Silver: 500–1 999 pts  |  Gold: 2 000+ pts
 *
 * Phone is normalised to digits-only before storage to guarantee uniqueness
 * regardless of how the merchant types it (0612…, +212612…, 212612…).
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoyaltyTier = 'bronze' | 'silver' | 'gold'

export interface CustomerDoc {
  id:             string
  merchantId:     string
  name:           string
  phone:          string       // digits only — unique within merchant scope
  email?:         string
  totalSpent:     number       // MAD, running total (denormalised)
  visitCount:     number       // transaction count (denormalised)
  loyaltyPoints:  number       // floor(totalSpent * LOYALTY_RATE), running total
  lastVisitAt?:   Date
  notes?:         string
  isActive:       boolean
  createdAt:      Date
  updatedAt:      Date
}

export interface FindCustomersOptions {
  merchantId: string
  search?:    string    // matches name (regex) or phone (contains)
  page?:      number
  limit?:     number
  isActive?:  boolean   // default true
}

export interface FindCustomersResult {
  customers: CustomerDoc[]
  total:     number
}

// ── Loyalty constants ─────────────────────────────────────────────────────────

/** Points earned per MAD spent.  Move to MerchantSettings for per-merchant rate. */
export const LOYALTY_RATE = 1

/** Minimum points required to reach each tier. */
export const LOYALTY_THRESHOLDS = { silver: 500, gold: 2000 } as const

export function getLoyaltyTier(points: number): LoyaltyTier {
  if (points >= LOYALTY_THRESHOLDS.gold)   return 'gold'
  if (points >= LOYALTY_THRESHOLDS.silver) return 'silver'
  return 'bronze'
}

// ── Phone normalisation ───────────────────────────────────────────────────────

/** Strip all non-digit characters for consistent dedup / search. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('customers')
  await Promise.all([
    col.createIndex({ merchantId: 1, phone: 1 }, { unique: true }),
    col.createIndex({ merchantId: 1, isActive: 1 }),
    col.createIndex({ merchantId: 1, totalSpent: -1 }),
    col.createIndex({ merchantId: 1, lastVisitAt: -1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): CustomerDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  return { id, ...rest } as unknown as CustomerDoc
}

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id)
}

// ── Repository ────────────────────────────────────────────────────────────────

export const customersRepo = {

  async findAll(opts: FindCustomersOptions): Promise<FindCustomersResult> {
    const db = await getDb()
    if (!db) return { customers: [], total: 0 }
    await ensureIndexes(db)

    const { merchantId, search, page = 1, limit = 50, isActive = true } = opts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { merchantId, isActive }

    if (search && search.trim()) {
      const escaped  = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re        = new RegExp(escaped, 'i')
      const normalized = normalizePhone(search)
      filter.$or = [
        { name: re },
        ...(normalized.length >= 4 ? [{ phone: { $regex: normalized } }] : []),
      ]
    }

    const skip = (page - 1) * limit
    const col  = db.collection('customers')
    const [docs, total] = await Promise.all([
      col.find(filter)
        .sort({ totalSpent: -1, lastVisitAt: -1, createdAt: -1 })
        .skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return {
      customers: docs.map(d => toDoc(d as Record<string, unknown>)),
      total,
    }
  },

  async findById(merchantId: string, id: string): Promise<CustomerDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('customers').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async create(opts: {
    merchantId: string
    name:       string
    phone:      string    // raw — normalised here
    email?:     string
    notes?:     string
  }): Promise<CustomerDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const now = new Date()
    const doc = {
      merchantId:    opts.merchantId,
      name:          opts.name.trim(),
      phone:         normalizePhone(opts.phone),
      email:         opts.email?.trim()  || undefined,
      notes:         opts.notes?.trim()  || undefined,
      totalSpent:    0,
      visitCount:    0,
      loyaltyPoints: 0,
      isActive:      true,
      createdAt:     now,
      updatedAt:     now,
    }

    try {
      const result = await db.collection('customers').insertOne(doc)
      return toDoc({ ...doc, _id: result.insertedId } as unknown as Record<string, unknown>)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate') || msg.includes('E11000')) {
        throw new Error('phone_already_exists')
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
      notes:    string
      isActive: boolean
    }>
  ): Promise<CustomerDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}
    if (data.name     !== undefined) update.name     = data.name.trim()
    if (data.phone    !== undefined) update.phone    = normalizePhone(data.phone)
    if (data.email    !== undefined) update.email    = data.email.trim()   || undefined
    if (data.notes    !== undefined) update.notes    = data.notes.trim()   || undefined
    if (data.isActive !== undefined) update.isActive = data.isActive
    update.updatedAt = new Date()

    try {
      const result = await db.collection('customers').findOneAndUpdate(
        { _id: new ObjectId(id), merchantId },
        { $set: update },
        { returnDocument: 'after' }
      )
      return result ? toDoc(result as unknown as Record<string, unknown>) : null
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('duplicate') || msg.includes('E11000')) {
        throw new Error('phone_already_exists')
      }
      throw err
    }
  },

  /**
   * Find all active customers with a valid phone number, optionally filtered
   * by loyalty tier.  Used exclusively by the WhatsApp campaign fan-out.
   *
   * Returns only the fields needed for campaign sending — not the full doc —
   * to keep the result set lean when a merchant has thousands of customers.
   */
  async findForCampaign(
    merchantId:  string,
    tierFilter:  'all' | 'bronze' | 'silver' | 'gold'
  ): Promise<Array<{ id: string; name: string; phone: string; loyaltyPoints: number }>> {
    const db = await getDb()
    if (!db) return []
    await ensureIndexes(db)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {
      merchantId,
      isActive: true,
      phone:    { $exists: true, $ne: '' },
    }

    if (tierFilter !== 'all') {
      if (tierFilter === 'gold') {
        filter.loyaltyPoints = { $gte: LOYALTY_THRESHOLDS.gold }
      } else if (tierFilter === 'silver') {
        filter.loyaltyPoints = {
          $gte: LOYALTY_THRESHOLDS.silver,
          $lt:  LOYALTY_THRESHOLDS.gold,
        }
      } else {
        // bronze — below silver threshold
        filter.loyaltyPoints = { $lt: LOYALTY_THRESHOLDS.silver }
      }
    }

    const docs = await db.collection('customers')
      .find(filter, { projection: { _id: 1, name: 1, phone: 1, loyaltyPoints: 1 } })
      .toArray()

    return docs.map(d => ({
      id:            (d._id as ObjectId).toString(),
      name:          String(d.name          ?? ''),
      phone:         String(d.phone         ?? ''),
      loyaltyPoints: Number(d.loyaltyPoints ?? 0),
    }))
  },

  /**
   * Atomically record a purchase visit for a customer.
   * Called fire-and-forget from POST /api/portal/transactions.
   *
   * Uses $inc for all counters so concurrent transactions are safe.
   * Points = floor(amount × LOYALTY_RATE).  Never goes negative.
   */
  async recordVisit(
    merchantId: string,
    customerId: string,
    amount:     number
  ): Promise<void> {
    if (!isValidObjectId(customerId)) return
    const db = await getDb()
    if (!db) return

    const safeAmount   = Math.max(0, amount)
    const pointsEarned = Math.floor(safeAmount * LOYALTY_RATE)

    await db.collection('customers').updateOne(
      { _id: new ObjectId(customerId), merchantId },
      {
        $inc: {
          totalSpent:    safeAmount,
          visitCount:    1,
          loyaltyPoints: pointsEarned,
        },
        $set: {
          lastVisitAt: new Date(),
          updatedAt:   new Date(),
        },
      }
    )
  },
}
