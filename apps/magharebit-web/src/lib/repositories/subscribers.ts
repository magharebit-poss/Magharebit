import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const JSON_PATH = join(process.cwd(), 'data', 'subscribers.json')

export interface Subscriber {
  id: string
  phone: string
  locale?: string
  subscribedAt: string
}

function ensureDataDir() {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Index management ─────────────────────────────────────────────────────────
let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  // Unique index on phone — MongoDB enforces no duplicates at DB level
  await db.collection('subscribers').createIndex({ phone: 1 }, { unique: true })
  await db.collection('subscribers').createIndex({ subscribedAt: -1 })
  indexesCreated = true
}

// ── Repository ───────────────────────────────────────────────────────────────
export const subscribersRepo = {
  async create(subscriber: { phone: string; locale?: string }): Promise<Subscriber> {
    const full: Subscriber = {
      id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      phone: subscriber.phone,
      locale: subscriber.locale,
      subscribedAt: new Date().toISOString(),
    }

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      // The unique index on phone will throw a duplicate key error if already subscribed
      await db.collection<Subscriber>('subscribers').insertOne({ ...full })
      return full
    }

    // JSON fallback
    ensureDataDir()
    const existing: Subscriber[] = existsSync(JSON_PATH)
      ? JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
      : []
    existing.push(full)
    writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2))
    return full
  },

  async findByPhone(phone: string): Promise<Subscriber | null> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      return db.collection<Subscriber>('subscribers').findOne({ phone })
    }

    if (!existsSync(JSON_PATH)) return null
    const list: Subscriber[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
    return list.find(s => s.phone === phone) ?? null
  },

  async findAll(): Promise<Subscriber[]> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      return db.collection<Subscriber>('subscribers').find().sort({ subscribedAt: -1 }).toArray()
    }
    return existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf-8')) : []
  },
}
