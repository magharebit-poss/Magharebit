/**
 * audit_logs repository: append-only record of admin actions.
 *
 * There is deliberately NO update or delete method. Entries are written by
 * recordAudit() right after a successful admin action. The database is
 * required: audit data never falls back to a local JSON file.
 */

import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import type { AdminActor } from '../admin-auth'

export type AuditAction =
  | 'generateLicense'
  | 'revokeKey'
  | 'extendSubscription'
  | 'approveMerchant'
  | 'suspendMerchant'
  | 'reactivateMerchant'
  | 'createCoupon'
  | 'broadcastNotification'
  | 'createAdmin'
  | 'disableAdmin'
  | 'adminLogin'
  | 'activateLead'
  | 'updateLeadStatus'
  | 'releaseTerminal'

export interface AuditLogEntry {
  id: string
  ts: Date
  actorId: string
  actorName: string
  /** Present when the acting admin has an email on file. */
  actorEmail?: string
  actorRole: string
  action: AuditAction
  targetType: 'merchant' | 'license' | 'coupon' | 'notification' | 'admin' | 'session'
  targetId: string
  meta?: Record<string, unknown>
  ip?: string
}

export interface AuditQuery {
  actorId?: string
  action?: AuditAction
  targetId?: string
  from?: Date
  to?: Date
  page?: number
  limit?: number
}

const COLLECTION = 'audit_logs'

let indexesCreated = false
async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection(COLLECTION)
  await Promise.all([
    col.createIndex({ ts: -1 }),
    col.createIndex({ actorId: 1, ts: -1 }),
    col.createIndex({ action: 1, ts: -1 }),
    col.createIndex({ targetId: 1, ts: -1 }),
  ])
  indexesCreated = true
}

function newId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** First client IP from the proxy header, trimmed and capped. */
export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown').slice(0, 64)
}

/**
 * Append an audit entry. Never throws: a failure is logged loudly and reported
 * through the return value so the caller can surface it to the admin.
 */
export async function recordAudit(input: {
  actor: AdminActor
  action: AuditAction
  targetType: AuditLogEntry['targetType']
  targetId: string
  meta?: Record<string, unknown>
  ip?: string
}): Promise<boolean> {
  try {
    const db = await getDb()
    if (!db) {
      console.error('[audit] database unavailable, entry NOT recorded:', input.action, input.targetId)
      return false
    }
    await ensureIndexes(db)
    const entry: AuditLogEntry = {
      id: newId(),
      ts: new Date(),
      actorId: input.actor.id,
      actorName: input.actor.name,
      ...(input.actor.email ? { actorEmail: input.actor.email } : {}),
      actorRole: input.actor.role,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.meta ? { meta: input.meta } : {}),
      ...(input.ip ? { ip: input.ip } : {}),
    }
    await db.collection<AuditLogEntry>(COLLECTION).insertOne({ ...entry })
    return true
  } catch (err) {
    console.error('[audit] failed to record entry:', input.action, input.targetId, err)
    return false
  }
}

export const auditLogsRepo = {
  async find(q: AuditQuery = {}): Promise<{ entries: AuditLogEntry[]; total: number } | null> {
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)

    const filter: Record<string, unknown> = {}
    if (q.actorId) filter.actorId = q.actorId
    if (q.action) filter.action = q.action
    if (q.targetId) filter.targetId = q.targetId
    if (q.from || q.to) {
      filter.ts = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lte: q.to } : {}),
      }
    }

    const page = Math.max(1, q.page ?? 1)
    const limit = Math.min(200, Math.max(1, q.limit ?? 50))
    const col = db.collection<AuditLogEntry>(COLLECTION)
    const [entries, total] = await Promise.all([
      col
        .find(filter, { projection: { _id: 0 } })
        .sort({ ts: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ])
    return { entries, total }
  },
}
