import { MongoClient, Db } from 'mongodb'
import dns from 'node:dns'

// Force public DNS resolvers so that `mongodb+srv://` SRV lookups succeed
// even if the local network resolver refuses SRV queries (observed on
// router DNS 192.168.1.254). Idempotent — Next.js may spawn multiple
// route-handler workers and each will run this on first module load.
// In production environments (Vercel, etc.) this is effectively a no-op
// because their default resolvers already handle SRV correctly.
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1'])

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

// After a connection failure we back off for RETRY_AFTER_MS before trying again.
// This prevents hammering Atlas on every request while still auto-recovering
// once the cluster is resumed / the network issue is resolved — without requiring
// a dev-server restart.
// In development retry more aggressively so a single Atlas resume doesn't
// require waiting a full 30 s per request.  In production keep it slow to
// avoid hammering a genuinely down cluster.
const RETRY_AFTER_MS = process.env.NODE_ENV === 'development' ? 8_000 : 30_000
let connectionFailedAt: number | null = null
let lastError: string | null = null

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB ?? 'magharebit'

  if (!uri) {
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      console.warn('[mongodb] MONGODB_URI not set — falling back to JSON storage')
    }
    return null
  }

  if (cachedDb) return cachedDb

  // Still in back-off window?
  if (connectionFailedAt !== null) {
    if (Date.now() - connectionFailedAt < RETRY_AFTER_MS) return null
    // Back-off expired — reset and retry
    connectionFailedAt = null
    lastError = null
  }

  try {
    const client = new MongoClient(uri, {
      // Fail fast if Atlas is unreachable / paused, so the request doesn't sit
      // waiting on the full driver timeout.  3 s is enough for a healthy Atlas
      // cluster while still failing quickly when the cluster is paused.
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    })
    await client.connect()
    cachedClient = client
    cachedDb = client.db(dbName)
    connectionFailedAt = null
    console.log('[mongodb] connected to Atlas ✓')
    return cachedDb
  } catch (err) {
    connectionFailedAt = Date.now()
    lastError = err instanceof Error ? err.message : String(err)
    console.warn(`[mongodb] connection failed (will retry in ${RETRY_AFTER_MS / 1000}s): ${lastError}`)
    return null
  }
}

export function getLastConnectionError(): string | null {
  return lastError
}

export async function closeDb() {
  if (cachedClient) {
    await cachedClient.close()
    cachedClient = null
    cachedDb = null
  }
  // Reset failure state so the next call retries immediately
  connectionFailedAt = null
  lastError = null
}
