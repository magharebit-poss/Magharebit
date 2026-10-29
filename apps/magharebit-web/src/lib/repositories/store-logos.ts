/**
 * store_logos repository: one picture per merchant (see src/lib/store-logo.ts for why it lives here).
 * The settings document keeps the public URL; this collection keeps the bytes.
 */

import { Binary, Db } from 'mongodb'
import { getDb } from '../mongodb'
import type { LogoType } from '../store-logo'

export interface StoreLogo {
  merchantId: string
  contentType: LogoType
  data: Uint8Array
  size: number
  sha256: string
  updatedAt: Date
}

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection('store_logos').createIndex({ merchantId: 1 }, { unique: true })
  indexesCreated = true
}

export const storeLogosRepo = {
  /** null when there is no logo or no database. */
  async get(merchantId: string): Promise<StoreLogo | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('store_logos').findOne({ merchantId })
    if (!doc) return null
    return {
      merchantId,
      contentType: doc.contentType as LogoType,
      data: (doc.data as Binary).buffer,
      size: doc.size as number,
      sha256: doc.sha256 as string,
      updatedAt: doc.updatedAt as Date,
    }
  },

  /** Replaces the merchant's logo. Throws when the database is down. */
  async put(logo: Omit<StoreLogo, 'updatedAt'>): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)
    await db.collection('store_logos').updateOne(
      { merchantId: logo.merchantId },
      { $set: { contentType: logo.contentType, data: new Binary(logo.data), size: logo.size, sha256: logo.sha256, updatedAt: new Date() } },
      { upsert: true },
    )
  },

  /** Throws when the database is down. */
  async remove(merchantId: string): Promise<void> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await db.collection('store_logos').deleteOne({ merchantId })
  },
}
