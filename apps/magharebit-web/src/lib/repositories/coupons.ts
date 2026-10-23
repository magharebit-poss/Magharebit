/**
 * coupons repository (scaffold): discount / free-trial codes created by admins.
 *
 * Redemption at checkout is NOT wired yet: this module stores the codes and
 * exposes an atomic `redeem` the sign-up/renewal flow can call later.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { escapeRegex } from '../regex'
import type { LicensePlan } from '../license-key'

export type CouponKind = 'percent' | 'fixed' | 'trial_days'

export interface CouponDoc {
  id: string
  /** Upper-case, unique. */
  code: string
  kind: CouponKind
  /** percent: 1-100, fixed: MAD amount, trial_days: 1-90 extra days. */
  value: number
  description?: string
  /** Limit to some plans; empty or absent = all plans. */
  plans?: LicensePlan[]
  /** Absent = unlimited. */
  maxRedemptions?: number
  redeemed: number
  expiresAt?: Date
  active: boolean
  createdAt: Date
  createdBy: string
}

export const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,23}$/

const COLLECTION = 'coupons'
type Stored = Omit<CouponDoc, 'id'> & { _id: ObjectId }

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection(COLLECTION).createIndex({ code: 1 }, { unique: true })
  await db.collection(COLLECTION).createIndex({ createdAt: -1 })
  indexesCreated = true
}

function toDoc(s: Stored): CouponDoc {
  const { _id, ...rest } = s
  return { id: String(_id), ...rest }
}

export const couponsRepo = {
  async findAll(opts: { q?: string; active?: boolean; page?: number; limit?: number } = {}): Promise<{ coupons: CouponDoc[]; total: number } | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const filter: Record<string, unknown> = {}
    if (opts.q) filter.code = { $regex: escapeRegex(opts.q.toUpperCase()) }
    if (typeof opts.active === 'boolean') filter.active = opts.active
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25))
    const page = Math.max(1, opts.page ?? 1)
    const col = db.collection<Stored>(COLLECTION)
    const [rows, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return { coupons: rows.map(toDoc), total }
  },

  /** Returns null when the database is down; throws `duplicate` when the code exists. */
  async create(input: Omit<CouponDoc, 'id' | 'redeemed' | 'createdAt' | 'active'>): Promise<CouponDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc: Stored = { _id: new ObjectId(), ...input, redeemed: 0, active: true, createdAt: new Date() }
    try {
      await db.collection<Stored>(COLLECTION).insertOne(doc)
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new Error('duplicate')
      throw e
    }
    return toDoc(doc)
  },

  async setActive(id: string, active: boolean): Promise<boolean> {
    const db = await getDb()
    if (!db || !ObjectId.isValid(id)) return false
    const r = await db.collection<Stored>(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: { active } })
    return r.matchedCount === 1
  },

  /**
   * Atomically takes one redemption if the coupon is active, unexpired, under its limit and valid for `plan`.
   * Not used by any public route yet.
   */
  async redeem(code: string, plan: LicensePlan): Promise<CouponDoc | null> {
    const db = await getDb()
    if (!db) return null
    const now = new Date()
    const r = await db.collection<Stored>(COLLECTION).findOneAndUpdate(
      {
        code: code.toUpperCase(),
        active: true,
        $and: [
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
          { $or: [{ maxRedemptions: { $exists: false } }, { $expr: { $lt: ['$redeemed', '$maxRedemptions'] } }] },
          { $or: [{ plans: { $exists: false } }, { plans: { $size: 0 } }, { plans: plan }] },
        ],
      },
      { $inc: { redeemed: 1 } },
      { returnDocument: 'after' }
    )
    return r ? toDoc(r) : null
  },
}
