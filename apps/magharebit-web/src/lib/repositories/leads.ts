import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import { escapeRegex } from '../regex'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const JSON_PATH = join(process.cwd(), 'data', 'leads.json')

export interface Lead {
  id: string
  storeName: string
  phone: string
  businessType: string
  city: string
  locale: string
  submittedAt: string
  status: 'new' | 'contacted' | 'converted' | 'rejected' | 'activated'
  licenseKey?: string
  /** Set together with licenseKey by the server when an admin activates the lead. */
  licenseId?: string
  activatedAt?: string
  activatedBy?: string
  notes?: string
}

export interface FindAllOptions {
  page?: number
  limit?: number
  status?: Lead['status'] | 'all'
  /** Case-insensitive search over store name, phone, city and business type. */
  q?: string
}

export interface FindAllResult {
  leads: Lead[]
  total: number
}

function ensureDataDir() {
  const dir = join(process.cwd(), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Index management ─────────────────────────────────────────────────────────
let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection('leads').createIndex({ submittedAt: -1 })
  await db.collection('leads').createIndex({ status: 1 })
  await db.collection('leads').createIndex({ phone: 1 })
  indexesCreated = true
}

// ── Repository ───────────────────────────────────────────────────────────────
export const leadsRepo = {
  async create(lead: Omit<Lead, 'id' | 'submittedAt' | 'status'>): Promise<Lead> {
    const full: Lead = {
      ...lead,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      submittedAt: new Date().toISOString(),
      status: 'new',
    }

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      await db.collection<Lead>('leads').insertOne({ ...full })
      return full
    }

    // JSON fallback
    ensureDataDir()
    const existing: Lead[] = existsSync(JSON_PATH)
      ? JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
      : []
    writeFileSync(JSON_PATH, JSON.stringify([full, ...existing], null, 2))
    return full
  },

  async findAll(options?: FindAllOptions): Promise<FindAllResult> {
    const page = options?.page ?? 1
    const limit = options?.limit ?? 50
    const skip = (page - 1) * limit
    const statusFilter = options?.status && options.status !== 'all' ? options.status : undefined
    const q = (options?.q ?? '').trim().slice(0, 100)

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      const filter: Record<string, unknown> = statusFilter ? { status: statusFilter } : {}
      if (q) {
        const re = { $regex: escapeRegex(q), $options: 'i' }
        filter.$or = [{ storeName: re }, { phone: re }, { city: re }, { businessType: re }]
      }
      const [leads, total] = await Promise.all([
        db.collection<Lead>('leads')
          .find(filter, { projection: { _id: 0 } })
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection<Lead>('leads').countDocuments(filter),
      ])
      return { leads, total }
    }

    // JSON fallback — return all (no server-side pagination)
    const all: Lead[] = existsSync(JSON_PATH)
      ? JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
      : []
    const byStatus = statusFilter ? all.filter(l => l.status === statusFilter) : all
    const needle = q.toLowerCase()
    const filtered = needle
      ? byStatus.filter(l => [l.storeName, l.phone, l.city, l.businessType].some(v => (v ?? '').toLowerCase().includes(needle)))
      : byStatus
    return { leads: filtered, total: filtered.length }
  },

  async update(id: string, patch: Partial<Lead>): Promise<Lead | null> {
    const db = await getDb()
    if (db) {
      const result = await db.collection<Lead>('leads').findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after' }
      )
      return result as Lead | null
    }

    // JSON fallback
    if (!existsSync(JSON_PATH)) return null
    const leads: Lead[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
    const idx = leads.findIndex(l => l.id === id)
    if (idx === -1) return null
    leads[idx] = { ...leads[idx], ...patch }
    writeFileSync(JSON_PATH, JSON.stringify(leads, null, 2))
    return leads[idx]
  },

  async findById(id: string): Promise<Lead | null> {
    const db = await getDb()
    if (db) {
      return db.collection<Lead>('leads').findOne({ id }, { projection: { _id: 0 } }) as Promise<Lead | null>
    }
    if (!existsSync(JSON_PATH)) return null
    const leads: Lead[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
    return leads.find(l => l.id === id) ?? null
  },

  /**
   * Mark a lead as activated with the key the server issued. Returns false when the
   * lead is missing or was already activated (atomic in MongoDB), so two admins
   * cannot activate the same lead twice.
   */
  async activate(id: string, license: { key: string; licenseId: string }, by: string): Promise<boolean> {
    const patch = { status: 'activated' as const, licenseKey: license.key, licenseId: license.licenseId, activatedAt: new Date().toISOString(), activatedBy: by }
    const db = await getDb()
    if (db) {
      const res = await db.collection<Lead>('leads').updateOne({ id, status: { $ne: 'activated' } }, { $set: patch })
      return res.matchedCount === 1
    }
    if (!existsSync(JSON_PATH)) return false
    const leads: Lead[] = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
    const idx = leads.findIndex(l => l.id === id && l.status !== 'activated')
    if (idx === -1) return false
    leads[idx] = { ...leads[idx], ...patch }
    writeFileSync(JSON_PATH, JSON.stringify(leads, null, 2))
    return true
  },
}
