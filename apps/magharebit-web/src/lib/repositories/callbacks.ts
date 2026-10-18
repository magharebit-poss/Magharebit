import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const JSON_PATH = join(process.cwd(), 'data', 'callbacks.json')

export interface Callback {
  id: string
  phone: string
  locale: string
  page: string
  submittedAt: string
  status: 'pending' | 'called' | 'closed'
}

function ensureDataDir() {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection('callbacks').createIndex({ submittedAt: -1 })
  await db.collection('callbacks').createIndex({ status: 1 })
  await db.collection('callbacks').createIndex({ phone: 1 })
  indexesCreated = true
}

export const callbacksRepo = {
  async create(input: Omit<Callback, 'id' | 'submittedAt' | 'status'>): Promise<Callback> {
    const full: Callback = {
      ...input,
      id: `cb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    }

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      await db.collection<Callback>('callbacks').insertOne({ ...full })
      return full
    }

    ensureDataDir()
    const existing: Callback[] = existsSync(JSON_PATH)
      ? JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
      : []
    writeFileSync(JSON_PATH, JSON.stringify([full, ...existing], null, 2))
    return full
  },

  async findAll(): Promise<Callback[]> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      return db.collection<Callback>('callbacks').find().sort({ submittedAt: -1 }).toArray()
    }
    return existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf-8')) : []
  },
}
