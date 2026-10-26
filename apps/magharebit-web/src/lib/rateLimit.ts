/**
 * Rate limiting shared by every server instance.
 *
 * Fixed window per key, stored in MongoDB (`rate_limits`). One atomic upsert per check, so
 * concurrent requests on different serverless instances share the same counter. Expired windows
 * are removed by a TTL index. Keys are hashed (sha256) so raw IPs and usernames are not stored.
 *
 * If the database is not configured or unreachable, the check falls back to the per-instance
 * in-memory counter below (the previous behaviour): limits keep working, just not across instances.
 */

import { createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { getDb } from './mongodb'

const COLLECTION = 'rate_limits'

interface RateLimitDoc {
  _id: string
  count: number
  resetAt: Date
  /** TTL anchor: the document is deleted once its window is over. */
  expiresAt: Date
}

// ── In-memory fallback (per instance) ────────────────────────────────────────
const buckets = new Map<string, { count: number; resetAt: number }>()

function checkLocal(key: string, maxRequests: number, windowMs: number, now: number): boolean {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= maxRequests) return false
  bucket.count++
  return true
}

// Cleanup old buckets every 10 minutes
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, 10 * 60 * 1000)
  // Do not keep a script or test process alive just for this timer.
  ;(timer as { unref?: () => void }).unref?.()
}

// ── Shared store ─────────────────────────────────────────────────────────────
let indexReady: Promise<unknown> | null = null
function ensureIndex(db: Db) {
  indexReady ??= db
    .collection(COLLECTION)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => { indexReady = null })
  return indexReady
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('base64url')
}

async function checkShared(db: Db, key: string, maxRequests: number, windowMs: number, now: number): Promise<boolean> {
  await ensureIndex(db)
  const nowDate = new Date(now)
  const inWindow = { $gt: ['$resetAt', nowDate] }
  // Pipeline update: in the current window -> count + 1; otherwise (or new key) -> restart at 1.
  const update = [
    {
      $set: {
        count: { $cond: [inWindow, { $add: ['$count', 1] }, 1] },
        resetAt: { $cond: [inWindow, '$resetAt', new Date(now + windowMs)] },
      },
    },
    { $set: { expiresAt: '$resetAt' } },
  ]
  const col = db.collection<RateLimitDoc>(COLLECTION)
  const _id = hashKey(key)
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await col.findOneAndUpdate({ _id }, update, { upsert: true, returnDocument: 'after' })
      return !!doc && doc.count <= maxRequests
    } catch (e) {
      // Two first requests for the same key can race on the upsert; the loser retries once
      // and then updates the document the winner created.
      if ((e as { code?: number }).code === 11000 && attempt === 0) continue
      throw e
    }
  }
}

/**
 * Returns true when the request is allowed. `key` should include the route and the client
 * identity (e.g. `license-validate:${ip}`).
 */
export async function checkRateLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  let db: Db | null = null
  try {
    db = await getDb()
  } catch {
    db = null
  }
  if (db) {
    try {
      return await checkShared(db, key, maxRequests, windowMs, now)
    } catch (e) {
      console.warn('[rateLimit] shared store failed, using in-memory limit:', e instanceof Error ? e.message : e)
    }
  }
  return checkLocal(key, maxRequests, windowMs, now)
}
