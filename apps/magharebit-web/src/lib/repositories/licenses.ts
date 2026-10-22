/**
 * licenses repository
 *
 * Primary store: MongoDB `licenses` collection.
 * Fallback: `data/licenses.json` (legacy format, read-only migration path).
 *
 * Index strategy (created once per process):
 *   - key:        unique — prevents duplicate key strings
 *   - merchantId: non-unique — fast lookup of all licenses for a merchant
 *   - status:     non-unique — admin dashboard filtering
 *   - expiresAt:  non-unique — expiry sweep queries
 */

import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import {
  LicenseRecord,
  LicensePlan,
  LicenseStatus,
  generateLicenseKey,
  generateLicenseId,
  calcExpiresAt,
  calcExpiresAtDays,
  isValidDuration,
} from '../license-key'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export type { LicenseRecord, LicensePlan, LicenseStatus }

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection<LicenseRecord>('licenses')
  await Promise.all([
    col.createIndex({ key: 1 },        { unique: true }),
    col.createIndex({ merchantId: 1 }),
    col.createIndex({ status: 1 }),
    col.createIndex({ expiresAt: 1 }),
  ])
  indexesCreated = true
}

// ── Legacy JSON helpers ───────────────────────────────────────────────────────

const JSON_PATH = join(process.cwd(), 'data', 'licenses.json')

interface LegacyLicense {
  id: string
  key: string
  store: string
  status: LicenseStatus
  plan: LicensePlan
  activatedAt: string
  expiresAt: string
}

function readJsonLicenses(): LicenseRecord[] {
  if (!existsSync(JSON_PATH)) return []
  try {
    const raw = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as
      | { licenses: LegacyLicense[] }
      | LegacyLicense[]
    const items: LegacyLicense[] = Array.isArray(raw) ? raw : raw.licenses ?? []
    return items.map((l) => ({
      id:             l.id,
      key:            l.key,
      merchantId:     '',           // legacy records have no merchantId
      storeName:      l.store,
      plan:           l.plan,
      durationMonths: 12,           // assume annual for old records
      issuedAt:       new Date(l.activatedAt),
      expiresAt:      new Date(l.expiresAt),
      status:         l.status,
    }))
  } catch {
    return []
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

export interface CreateLicenseInput {
  merchantId: string       // normalised phone or email
  storeName:  string
  plan:       LicensePlan
  durationMonths: 1 | 3 | 6 | 12 | 24
}

export interface CreateTrialLicenseInput {
  merchantId: string       // normalised phone or email
  storeName:  string
  trialDays?: number       // default: 14
}

export interface FindAllOptions {
  page?:       number
  limit?:      number
  status?:     LicenseStatus | 'all'
  merchantId?: string
}

export interface FindAllResult {
  licenses: LicenseRecord[]
  total:    number
}

export const licensesRepo = {

  /**
   * Create a 14-day trial license (auto-issued on merchant signup).
   * Sets plan=Starter, isTrial=true, durationMonths=0, durationDays=trialDays.
   * Bypasses the isValidDuration guard — trial duration is day-based.
   */
  async createTrial(input: CreateTrialLicenseInput): Promise<LicenseRecord> {
    const trialDays = input.trialDays ?? 14
    const now = new Date()
    const record: LicenseRecord = {
      id:            generateLicenseId(),
      key:           generateLicenseKey(now),
      merchantId:    input.merchantId,
      storeName:     input.storeName,
      plan:          'Starter',
      durationMonths: 0,           // trials use durationDays, not months
      durationDays:  trialDays,
      isTrial:       true,
      issuedAt:      now,
      expiresAt:     calcExpiresAtDays(now, trialDays),
      status:        'active',
    }

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      await db.collection<LicenseRecord>('licenses').insertOne({ ...record })
      return record
    }

    throw new Error('MongoDB unavailable — cannot create trial license')
  },

  /**
   * Create a new license record.
   * Generates the key + expiry from the input — caller should NOT pass these.
   */
  async create(input: CreateLicenseInput): Promise<LicenseRecord> {
    if (!isValidDuration(input.durationMonths)) {
      throw new Error(`Invalid durationMonths: ${input.durationMonths}. Allowed: 1,3,6,12,24`)
    }

    const now = new Date()
    const record: LicenseRecord = {
      id:             generateLicenseId(),
      key:            generateLicenseKey(now),
      merchantId:     input.merchantId,
      storeName:      input.storeName,
      plan:           input.plan,
      durationMonths: input.durationMonths,
      issuedAt:       now,
      expiresAt:      calcExpiresAt(now, input.durationMonths),
      status:         'active',
    }

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      await db.collection<LicenseRecord>('licenses').insertOne({ ...record })
      return record
    }

    // No MongoDB — throw; we do not fall back to JSON for writes
    throw new Error('MongoDB unavailable — cannot create license')
  },

  /** Find a single license by its key string (used by /validate endpoint) */
  async findByKey(key: string): Promise<LicenseRecord | null> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      return db.collection<LicenseRecord>('licenses').findOne({ key: key.trim().toUpperCase() }) as Promise<LicenseRecord | null>
    }
    // JSON fallback (read-only)
    return readJsonLicenses().find(l => l.key === key.trim().toUpperCase()) ?? null
  },

  /** Find a single license by its id (LIC-...). */
  async findById(id: string): Promise<LicenseRecord | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    return db.collection<LicenseRecord>('licenses').findOne({ id }, { projection: { _id: 0 } }) as Promise<LicenseRecord | null>
  },

  /** List all licenses for a given merchant */
  async findByMerchant(merchantId: string): Promise<LicenseRecord[]> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      return db.collection<LicenseRecord>('licenses')
        .find({ merchantId })
        .sort({ issuedAt: -1 })
        .toArray() as Promise<LicenseRecord[]>
    }
    return readJsonLicenses().filter(l => l.merchantId === merchantId)
  },

  async findAll(options?: FindAllOptions): Promise<FindAllResult> {
    const page   = options?.page  ?? 1
    const limit  = options?.limit ?? 50
    const skip   = (page - 1) * limit
    const statusF = options?.status && options.status !== 'all' ? options.status : undefined
    const merchantF = options?.merchantId

    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      const filter: Record<string, unknown> = {}
      if (statusF)   filter.status     = statusF
      if (merchantF) filter.merchantId = merchantF

      const [licenses, total] = await Promise.all([
        db.collection<LicenseRecord>('licenses')
          .find(filter)
          .sort({ issuedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection<LicenseRecord>('licenses').countDocuments(filter),
      ])
      return { licenses: licenses as LicenseRecord[], total }
    }

    // JSON fallback
    const all = readJsonLicenses()
    const filtered = statusF ? all.filter(l => l.status === statusF) : all
    return { licenses: filtered.slice(skip, skip + limit), total: filtered.length }
  },

  /** Update status or other mutable fields */
  async update(id: string, patch: Partial<LicenseRecord>): Promise<LicenseRecord | null> {
    const db = await getDb()
    if (db) {
      await ensureIndexes(db)
      const result = await db.collection<LicenseRecord>('licenses').findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after' }
      )
      return result as LicenseRecord | null
    }
    throw new Error('MongoDB unavailable — cannot update license')
  },

  /**
   * Mark a license as revoked.
   * Also used by admin approve/revoke flow.
   */
  async revoke(id: string, revokedBy = 'admin'): Promise<LicenseRecord | null> {
    return this.update(id, {
      status:    'revoked',
      revokedAt: new Date(),
      revokedBy,
    })
  },

  /**
   * Record the first activation (called by /validate when activatedAt is not yet set).
   */
  async recordActivation(id: string, machineId: string): Promise<void> {
    const db = await getDb()
    if (!db) return
    await db.collection<LicenseRecord>('licenses').updateOne(
      { id, activatedAt: { $exists: false } },
      { $set: { activatedAt: new Date(), activatedBy: machineId } }
    )
  },

  /**
   * Register a terminal for a license, enforcing the terminal limit atomically.
   *   'already'    the machine already holds a slot (its lastSeenAt is refreshed)
   *   'registered' a free slot was taken
   *   'limit'      all slots are used by other machines
   *   'missing'    no such license
   */
  async registerTerminal(id: string, machineId: string, max: number): Promise<'already' | 'registered' | 'limit' | 'missing'> {
    const db = await getDb()
    if (!db) throw new Error('MongoDB unavailable: cannot register terminal')
    await ensureIndexes(db)
    const col = db.collection<LicenseRecord>('licenses')
    const now = new Date()

    const seen = await col.updateOne({ id, 'terminals.machineId': machineId }, { $set: { 'terminals.$.lastSeenAt': now } })
    if (seen.matchedCount === 1) return 'already'

    // The size check and the push happen in ONE atomic update, so two machines racing for the
    // last slot cannot both win.
    const pushed = await col.updateOne(
      {
        id,
        'terminals.machineId': { $ne: machineId },
        $expr: { $lt: [{ $size: { $ifNull: ['$terminals', []] } }, max] },
      },
      { $push: { terminals: { machineId, firstSeenAt: now, lastSeenAt: now } } }
    )
    if (pushed.matchedCount === 1) return 'registered'

    // Lost a race for the same machine (it was added a moment ago) counts as 'already'.
    const again = await col.findOne({ id }, { projection: { terminals: 1 } })
    if (!again) return 'missing'
    return (again.terminals ?? []).some(t => t.machineId === machineId) ? 'already' : 'limit'
  },

  /** Refresh lastSeenAt for a registered terminal (no-op if it is not registered). */
  async touchTerminal(id: string, machineId: string): Promise<void> {
    const db = await getDb()
    if (!db) return
    await db.collection<LicenseRecord>('licenses').updateOne(
      { id, 'terminals.machineId': machineId },
      { $set: { 'terminals.$.lastSeenAt': new Date() } }
    )
  },

  /** Free a terminal slot (admin action). Returns true when a slot was removed. */
  async releaseTerminal(id: string, machineId: string): Promise<boolean> {
    const db = await getDb()
    if (!db) throw new Error('MongoDB unavailable: cannot release terminal')
    const res = await db.collection<LicenseRecord>('licenses').updateOne(
      { id, 'terminals.machineId': machineId },
      { $pull: { terminals: { machineId } } }
    )
    return res.matchedCount === 1
  },

  /**
   * Sweep: mark all licenses whose expiresAt has passed as 'expired'.
   * Called lazily on /validate and on the admin list endpoint.
   * Returns count of records updated.
   */
  async sweepExpired(): Promise<number> {
    const db = await getDb()
    if (!db) return 0
    const result = await db.collection<LicenseRecord>('licenses').updateMany(
      { status: 'active', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    )
    return result.modifiedCount
  },
}
