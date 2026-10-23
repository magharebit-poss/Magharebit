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
export type NotificationStatus = 'queued' | 'sent'

export interface NotificationDoc {
  id: string
  title: string
  body: string
  audience: NotificationAudience
  /** audience=plan -> a LicensePlan; audience=merchant -> a merchant id/phone. */
  target?: string
  status: NotificationStatus
  deliveredCount?: number
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

  async create(input: Pick<NotificationDoc, 'title' | 'body' | 'audience' | 'target' | 'createdBy'>): Promise<NotificationDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc: Stored = { _id: new ObjectId(), ...input, status: 'queued', createdAt: new Date() }
    await db.collection<Stored>(COLLECTION).insertOne(doc)
    return toDoc(doc)
  },
}
