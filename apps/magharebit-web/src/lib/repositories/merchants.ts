/**
 * merchants repository
 *
 * Wraps the MongoDB `merchants` collection.
 * Exposes the minimum surface needed for the admin approval flow.
 *
 * The `id` field on MerchantDoc is the MongoDB _id cast to string —
 * that is what the API routes expose as the [id] URL segment.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { escapeRegex } from '../regex'
import type { LicensePlan } from '../license-key'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MerchantStatus = 'pending' | 'approved' | 'suspended'

/** Shape stored in MongoDB (plus _id) */
export interface MerchantDoc {
  /** String form of MongoDB _id — added by the repo before returning */
  id: string
  phone: string
  email?: string
  storeName: string
  sector: string
  city: string
  locale: string
  createdAt: Date
  status: MerchantStatus
  approvedAt?: Date
  approvedBy?: string
  plan?: LicensePlan
  subscriptionEndsAt?: Date
}

export interface FindMerchantsOptions {
  status?: MerchantStatus | 'all'
  page?:   number
  limit?:  number
  sector?: string
  plan?:   LicensePlan
  /** Case-insensitive search over store name, phone, email and city. */
  q?:      string
}

export interface FindMerchantsResult {
  merchants: MerchantDoc[]
  total:     number
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('merchants')
  await Promise.all([
    col.createIndex({ phone: 1 },  { sparse: true }),
    col.createIndex({ email: 1 },  { sparse: true }),
    col.createIndex({ status: 1 }),
    col.createIndex({ createdAt: -1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDoc(raw: Record<string, any>): MerchantDoc {
  const { _id, ...rest } = raw
  return { id: (_id as ObjectId).toHexString(), ...rest } as MerchantDoc
}

function isValidObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}

// ── Repository ────────────────────────────────────────────────────────────────

export const merchantsRepo = {

  async findAll(opts?: FindMerchantsOptions): Promise<FindMerchantsResult> {
    const page   = opts?.page  ?? 1
    const limit  = opts?.limit ?? 50
    const skip   = (page - 1) * limit
    const statusF = opts?.status && opts.status !== 'all' ? opts.status : undefined

    const db = await getDb()
    if (!db) return { merchants: [], total: 0 }

    await ensureIndexes(db)
    const filter: Record<string, unknown> = statusF ? { status: statusF } : {}
    if (opts?.sector) filter.sector = opts.sector
    if (opts?.plan) filter.plan = opts.plan
    const q = (opts?.q ?? '').trim().slice(0, 100)
    if (q) {
        const re = { $regex: escapeRegex(q), $options: 'i' }
      filter.$or = [{ storeName: re }, { phone: re }, { email: re }, { city: re }]
    }
    const col = db.collection('merchants')

    const [rawDocs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])

    return { merchants: rawDocs.map(toDoc), total }
  },

  async findById(id: string): Promise<MerchantDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const raw = await db.collection('merchants').findOne({ _id: new ObjectId(id) })
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /**
   * Approve a merchant: set status, plan, subscriptionEndsAt, approvedAt.
   * Returns the updated doc.
   */
  async approve(
    id: string,
    patch: {
      plan:              LicensePlan
      subscriptionEndsAt: Date
      approvedBy?:       string
    }
  ): Promise<MerchantDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)

    const raw = await db.collection('merchants').findOneAndUpdate(
      // Atomic guard: only matches if status is still 'pending'
      // Prevents double-approval under concurrent requests
      { _id: new ObjectId(id), status: 'pending' },
      {
        $set: {
          status:             'approved',
          plan:               patch.plan,
          subscriptionEndsAt: patch.subscriptionEndsAt,
          approvedAt:         new Date(),
          approvedBy:         patch.approvedBy ?? 'admin',
        },
      },
      { returnDocument: 'after' }
    )
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /**
   * Suspend a merchant (used by revoke flow).
   */
  async suspend(id: string, revokedBy = 'admin'): Promise<MerchantDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)

    const raw = await db.collection('merchants').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status: 'suspended', suspendedAt: new Date(), suspendedBy: revokedBy } },
      { returnDocument: 'after' }
    )
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /** Find a merchant by the license owner id: a normalised phone or, for email-only sign-ups, an email. */
  async findByContact(idOrEmail: string): Promise<MerchantDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const raw = await db.collection('merchants').findOne({ $or: [{ phone: idOrEmail }, { email: idOrEmail }] })
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /** Admin toggle: suspended -> approved again. Only matches a suspended merchant. */
  async reactivate(id: string, by = 'admin'): Promise<MerchantDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const raw = await db.collection('merchants').findOneAndUpdate(
      { _id: new ObjectId(id), status: 'suspended' },
      { $set: { status: 'approved', reactivatedAt: new Date(), reactivatedBy: by }, $unset: { suspendedAt: '', suspendedBy: '' } },
      { returnDocument: 'after' }
    )
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /** Find a merchant by normalised phone (212XXXXXXXXX). */
  async findByPhone(phone: string): Promise<MerchantDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const raw = await db.collection('merchants').findOne({ phone })
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },

  /** Create an already-approved merchant (used when an admin activates a lead). */
  async createApproved(input: {
    phone: string; storeName: string; sector: string; city: string; locale: string
    plan: LicensePlan; subscriptionEndsAt: Date; approvedBy: string
  }): Promise<MerchantDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc = {
      phone: input.phone, storeName: input.storeName, sector: input.sector, city: input.city, locale: input.locale,
      createdAt: new Date(), status: 'approved' as const, plan: input.plan,
      subscriptionEndsAt: input.subscriptionEndsAt, approvedAt: new Date(), approvedBy: input.approvedBy,
    }
    const res = await db.collection('merchants').insertOne({ ...doc })
    return toDoc({ _id: res.insertedId, ...doc })
  },

  /** Point an existing approved merchant at its newest subscription. */
  async setSubscription(id: string, plan: LicensePlan, subscriptionEndsAt: Date): Promise<MerchantDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const raw = await db.collection('merchants').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { plan, subscriptionEndsAt } },
      { returnDocument: 'after' }
    )
    return raw ? toDoc(raw as Record<string, unknown>) : null
  },
}
