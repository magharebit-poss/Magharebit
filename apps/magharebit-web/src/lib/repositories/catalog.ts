/**
 * catalog_items repository: admin-managed lists that classify merchants and decorate the storefront.
 *   shop-type  business categories (bakery, café, grocery ...)
 *   cuisine    cuisine tags for food merchants
 *   banner     promotional banners
 * One collection, one shape, a `kind` discriminator.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { escapeRegex } from '../regex'

export const CATALOG_KINDS = ['shop-type', 'cuisine', 'banner'] as const
export type CatalogKind = (typeof CATALOG_KINDS)[number]

export interface CatalogItem {
  id: string
  kind: CatalogKind
  name: string
  description: string
  /** https URL or a same-site path ("/media/x.webp"); empty = no image. */
  imageUrl: string
  active: boolean
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

const COLLECTION = 'catalog_items'
type Stored = Omit<CatalogItem, 'id'> & { _id: ObjectId }

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection(COLLECTION).createIndex({ kind: 1, createdAt: -1 })
  indexesCreated = true
}

function toItem(s: Stored): CatalogItem {
  const { _id, ...rest } = s
  return { id: String(_id), ...rest }
}

export function isCatalogKind(v: string): v is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(v)
}

/** Accepts an https URL or a same-site absolute path. Blocks javascript:, data:, protocol-relative and http. */
export function validImageUrl(v: string): boolean {
  if (v === '') return true
  if (v.length > 500) return false
  if (/^\/(?!\/)[\w\-./%]*$/.test(v)) return true
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && !!u.hostname
  } catch {
    return false
  }
}

export const catalogRepo = {
  async findAll(kind: CatalogKind, opts: { q?: string; page?: number; limit?: number } = {}): Promise<{ items: CatalogItem[]; total: number } | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const filter: Record<string, unknown> = { kind }
    if (opts.q) filter.name = { $regex: escapeRegex(opts.q), $options: 'i' }
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25))
    const page = Math.max(1, opts.page ?? 1)
    const col = db.collection<Stored>(COLLECTION)
    const [rows, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return { items: rows.map(toItem), total }
  },

  async create(input: { kind: CatalogKind; name: string; description: string; imageUrl: string; active: boolean; createdBy: string }): Promise<CatalogItem | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc: Stored = { _id: new ObjectId(), ...input, createdAt: new Date() }
    await db.collection<Stored>(COLLECTION).insertOne(doc)
    return toItem(doc)
  },

  async update(kind: CatalogKind, id: string, patch: Partial<Pick<CatalogItem, 'name' | 'description' | 'imageUrl' | 'active'>>, by: string): Promise<CatalogItem | null> {
    const db = await getDb()
    if (!db || !/^[0-9a-f]{24}$/i.test(id)) return null
    const r = await db.collection<Stored>(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id), kind },
      { $set: { ...patch, updatedAt: new Date(), updatedBy: by } },
      { returnDocument: 'after' }
    )
    return r ? toItem(r) : null
  },
}
