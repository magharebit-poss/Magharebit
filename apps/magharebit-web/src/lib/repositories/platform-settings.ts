/**
 * platform_settings repository: small admin-managed configuration documents (one per key).
 * Today: `tipping`, the default tip amounts offered at the POS checkout (MAD).
 */

import { getDb } from '../mongodb'

const COLLECTION = 'platform_settings'

export const TIP_COUNT = 3
export const TIP_MIN = 0
export const TIP_MAX = 1000
export const DEFAULT_TIPS: number[] = [5, 10, 20]

export interface TippingSettings {
  /** Exactly TIP_COUNT amounts in MAD, shown as Tip 1..3 (0 hides an option). */
  tips: number[]
  updatedAt?: Date
  updatedBy?: string
  /** False when nothing has been saved yet (the defaults are shown). */
  saved: boolean
}

interface TippingDoc { _id: 'tipping'; tips: number[]; updatedAt: Date; updatedBy: string }

export function validTips(v: unknown): v is number[] {
  return Array.isArray(v) && v.length === TIP_COUNT && v.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= TIP_MIN && n <= TIP_MAX)
}

export const platformSettingsRepo = {
  async getTipping(): Promise<TippingSettings | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection<TippingDoc>(COLLECTION).findOne({ _id: 'tipping' })
    if (!doc) return { tips: DEFAULT_TIPS, saved: false }
    return { tips: doc.tips, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy, saved: true }
  },

  async setTipping(tips: number[], by: string): Promise<TippingSettings | null> {
    const db = await getDb()
    if (!db) return null
    const updatedAt = new Date()
    await db.collection<TippingDoc>(COLLECTION).updateOne(
      { _id: 'tipping' },
      { $set: { tips, updatedAt, updatedBy: by } },
      { upsert: true }
    )
    return { tips, updatedAt, updatedBy: by, saved: true }
  },
}
