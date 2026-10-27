/**
 * notifications repository (scaffold): announcements the admin team broadcasts to merchants.
 *
 * Only the record is stored. Delivery (in-app inbox in the POS, WhatsApp) is NOT wired yet, so the
 * status is `queued`; a sender can later flip it to `sent` and fill `deliveredCount`.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import type { LicensePlan } from '../license-key'

export type NotificationAudience = 'all' | 'plan' | 'merchant'
export type NotificationStatus = 'queued' | 'sent' | 'cancelled'

export interface NotificationDoc {
  id: string
  title: string
  body: string
  audience: NotificationAudience
  /** audience=plan -> a LicensePlan; audience=merchant -> a merchant id/phone. */
  target?: string
  status: NotificationStatus
  deliveredCount?: number
  /** How many times an admin re-queued it. */
  resendCount?: number
  updatedAt?: Date
  updatedBy?: string
  createdAt: Date
  createdBy: string
}

const COLLECTION = 'notifications'
type Stored = Omit<NotificationDoc, 'id'> & { _id: ObjectId }

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection(COLLECTION).createIndex({ createdAt: -1 })
  indexesCreated = true
}

function toDoc(s: Stored): NotificationDoc {
  const { _id, ...rest } = s
  return { id: String(_id), ...rest }
}

export const PLAN_TARGETS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

export const notificationsRepo = {
  async findAll(opts: { page?: number; limit?: number } = {}): Promise<{ notifications: NotificationDoc[]; total: number } | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25))
    const page = Math.max(1, opts.page ?? 1)
    const col = db.collection<Stored>(COLLECTION)
    const [rows, total] = await Promise.all([
      col.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      col.countDocuments({}),
    ])
    return { notifications: rows.map(toDoc), total }
  },

  /** Change the status, or re-queue ("resend"). Nothing is delivered yet: resend only puts it back in the queue. */
  async update(id: string, change: { status?: NotificationStatus; resend?: boolean }, by: string): Promise<NotificationDoc | null> {
    const db = await getDb()
    if (!db || !/^[0-9a-f]{24}$/i.test(id)) return null
    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: by }
    if (change.status) set.status = change.status
    if (change.resend) set.status = 'queued'
    const r = await db.collection<Stored>(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: set, ...(change.resend ? { $inc: { resendCount: 1 } } : {}) },
      { returnDocument: 'after' }
    )
    return r ? toDoc(r) : null
  },

  async create(input: Pick<NotificationDoc, 'title' | 'body' | 'audience' | 'target' | 'createdBy'>): Promise<NotificationDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc: Stored = { _id: new ObjectId(), ...input, status: 'queued', createdAt: new Date() }
    await db.collection<Stored>(COLLECTION).insertOne(doc)
    return toDoc(doc)
  },
}
