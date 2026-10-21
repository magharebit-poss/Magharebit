/**
 * admin_users repository: individual admin accounts (roles + scrypt hashes).
 *
 * The built-in "owner" (ADMIN_SECRET) is a break-glass identity and is NOT
 * stored here. Database is required; there is no JSON fallback for credentials.
 */

import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import { hashPassword } from '../password'

export type AdminRole = 'owner' | 'operator' | 'viewer'

export interface AdminUserDoc {
  id: string
  username: string
  displayName: string
  role: AdminRole
  passwordHash: string
  createdAt: Date
  createdBy: string
  disabledAt?: Date
}

/** Safe to return to the browser: never includes the hash. */
export type AdminUserPublic = Omit<AdminUserDoc, 'passwordHash'>

const COLLECTION = 'admin_users'
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection(COLLECTION).createIndex({ username: 1 }, { unique: true })
  indexesCreated = true
}

function toPublic(doc: AdminUserDoc): AdminUserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = doc
  return rest
}

export const adminUsersRepo = {
  async findByUsername(username: string): Promise<AdminUserDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    return db
      .collection<AdminUserDoc>(COLLECTION)
      .findOne({ username: username.toLowerCase() }, { projection: { _id: 0 } })
  },

  async findById(id: string): Promise<AdminUserDoc | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    return db.collection<AdminUserDoc>(COLLECTION).findOne({ id }, { projection: { _id: 0 } })
  },

  async list(): Promise<AdminUserPublic[] | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const docs = await db
      .collection<AdminUserDoc>(COLLECTION)
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: 1 })
      .toArray()
    return docs.map(toPublic)
  },

  /** Returns null when the username is taken or the database is unavailable. */
  async create(input: {
    username: string
    displayName: string
    role: AdminRole
    password: string
    createdBy: string
  }): Promise<AdminUserPublic | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc: AdminUserDoc = {
      id: `adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      username: input.username.toLowerCase(),
      displayName: input.displayName.trim().slice(0, 80),
      role: input.role,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date(),
      createdBy: input.createdBy,
    }
    try {
      await db.collection<AdminUserDoc>(COLLECTION).insertOne({ ...doc })
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return null // duplicate username
      throw err
    }
    return toPublic(doc)
  },

  async setDisabled(id: string, disabled: boolean): Promise<boolean> {
    const db = await getDb()
    if (!db) return false
    await ensureIndexes(db)
    const res = await db
      .collection<AdminUserDoc>(COLLECTION)
      .updateOne({ id }, disabled ? { $set: { disabledAt: new Date() } } : { $unset: { disabledAt: '' } })
    return res.matchedCount === 1
  },
}
