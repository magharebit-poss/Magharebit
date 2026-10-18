import { getDb, getLastConnectionError } from './mongodb'

export async function checkDbConnection(): Promise<{
  connected: boolean
  database?: string
  collections?: string[]
  error?: string
}> {
  try {
    const db = await getDb()
    if (!db) {
      // getDb returns null in two cases: (1) MONGODB_URI not set, (2) the
      // connection attempt failed. Distinguish them so the admin sees why.
      const lastErr = getLastConnectionError()
      if (lastErr) {
        return { connected: false, error: `Atlas connection failed: ${lastErr}` }
      }
      return { connected: false, error: 'MONGODB_URI not configured — using JSON fallback' }
    }

    const collections = await db.listCollections().toArray()
    return {
      connected: true,
      database: db.databaseName,
      collections: collections.map(c => c.name),
    }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown connection error',
    }
  }
}
