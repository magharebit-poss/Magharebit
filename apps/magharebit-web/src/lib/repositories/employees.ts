/**
 * employees repository
 *
 * MongoDB collection: `employees`
 * Partition key: merchantId
 *
 * Each employee is scoped to one merchant.
 * PIN is stored as a SHA-256 hash (same secret as OTP hashing).
 * loginId is unique within a merchant's scope.
 */

import { createHash } from 'crypto'
import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmployeeRole = 'cashier' | 'manager' | 'owner'

export interface EmployeeDoc {
  id:           string
  merchantId:   string
  name:         string
  loginId:      string       // unique within merchant scope — used at POS PIN screen
  role:         EmployeeRole
  phone?:       string
  isActive:     boolean
  totalSales:   number       // running total in MAD (denormalised, updated on transaction)
  txCount:      number       // running transaction count
  createdAt:    Date
  lastLoginAt?: Date
  // pinHash is intentionally NOT exposed in EmployeeDoc — only stored in DB
}

/** Shape stored in MongoDB (includes pinHash) */
interface EmployeeStoredDoc extends Omit<EmployeeDoc, 'id'> {
  pinHash: string
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection<EmployeeStoredDoc>('employees')
  await Promise.all([
    col.createIndex({ merchantId: 1, loginId: 1 }, { unique: true }),
    col.createIndex({ merchantId: 1, isActive: 1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashPin(pin: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
  return createHash('sha256').update(`${pin}:${secret}`).digest('hex')
}

function toDoc(raw: Record<string, unknown>): EmployeeDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  // Strip pinHash before returning to callers
  const { _id: _removed, pinHash: _ph, ...rest } = raw as Record<string, unknown> & { pinHash?: unknown }
  void _removed
  void _ph
  return { id, ...rest } as EmployeeDoc
}

// ── Repository ────────────────────────────────────────────────────────────────

export const employeesRepo = {

  async findAll(merchantId: string, includeInactive = false): Promise<EmployeeDoc[]> {
    const db = await getDb()
    if (!db) return []
    await ensureIndexes(db)
    const filter = includeInactive ? { merchantId } : { merchantId, isActive: true }
    const docs = await db.collection<EmployeeStoredDoc>('employees')
      .find(filter).sort({ name: 1 }).toArray()
    return docs.map(d => toDoc(d as unknown as Record<string, unknown>))
  },

  async findById(merchantId: string, id: string): Promise<EmployeeDoc | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection<EmployeeStoredDoc>('employees').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as unknown as Record<string, unknown>) : null
  },

  async create(opts: {
    merchantId: string
    name:       string
    loginId:    string
    pin:        string      // plain-text PIN, will be hashed
    role:       EmployeeRole
    phone?:     string
  }): Promise<EmployeeDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const { merchantId, name, loginId, pin, role, phone } = opts

    // Validate PIN (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error('pin_must_be_4_to_6_digits')
    }

    const now: Date = new Date()
    const doc: Omit<EmployeeStoredDoc, never> = {
      merchantId,
      name,
      loginId:    loginId.trim().toLowerCase(),
      pinHash:    hashPin(pin),
      role,
      phone,
      isActive:   true,
      totalSales: 0,
      txCount:    0,
      createdAt:  now,
    }
    const result = await db.collection<EmployeeStoredDoc>('employees').insertOne(doc)
    return toDoc({ ...doc, _id: result.insertedId } as unknown as Record<string, unknown>)
  },

  async update(
    merchantId: string,
    id:         string,
    data: Partial<{
      name:     string
      loginId:  string
      role:     EmployeeRole
      phone:    string
      isActive: boolean
      pin:      string    // if provided, re-hash
    }>
  ): Promise<EmployeeDoc | null> {
    const db = await getDb()
    if (!db) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { ...data }
    if (data.pin) {
      if (!/^\d{4,6}$/.test(data.pin)) throw new Error('pin_must_be_4_to_6_digits')
      update.pinHash = hashPin(data.pin)
      delete update.pin
    }
    delete update.id
    delete update.merchantId
    delete update.createdAt
    delete update.totalSales
    delete update.txCount

    const result = await db.collection<EmployeeStoredDoc>('employees').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId },
      { $set: update },
      { returnDocument: 'after' }
    )
    return result ? toDoc(result as unknown as Record<string, unknown>) : null
  },

  /** Verify PIN — returns the employee if correct, null if wrong PIN or not found */
  async verifyPin(merchantId: string, loginId: string, pin: string): Promise<EmployeeDoc | null> {
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection<EmployeeStoredDoc>('employees').findOne({
      merchantId,
      loginId: loginId.trim().toLowerCase(),
      isActive: true,
    })
    if (!doc) return null
    if (doc.pinHash !== hashPin(pin)) return null

    // Update lastLoginAt
    await db.collection<EmployeeStoredDoc>('employees').updateOne(
      { _id: doc._id },
      { $set: { lastLoginAt: new Date() } }
    )
    return toDoc(doc as unknown as Record<string, unknown>)
  },

  /** Increment employee's running sales totals — called after each transaction */
  async incrementSales(
    merchantId: string,
    employeeId: string,
    amount:     number
  ): Promise<void> {
    const db = await getDb()
    if (!db) return
    await db.collection<EmployeeStoredDoc>('employees').updateOne(
      { _id: new ObjectId(employeeId), merchantId },
      { $inc: { totalSales: amount, txCount: 1 } }
    )
  },

  async softDelete(merchantId: string, id: string): Promise<boolean> {
    const db = await getDb()
    if (!db) return false
    const result = await db.collection<EmployeeStoredDoc>('employees').updateOne(
      { _id: new ObjectId(id), merchantId },
      { $set: { isActive: false } }
    )
    return result.modifiedCount > 0
  },
}
