/**
 * Command Center metrics for the admin console (GET /api/admin/dashboard).
 *
 * Revenue comes from the `transactions` collection, which only holds sales recorded through the merchant web
 * portal (POST /api/portal/transactions). Sales rung up on the offline POS terminals sync to the separate POS
 * backend and are NOT in here, so the UI labels these figures "Portal sales". Days are Morocco calendar days.
 *
 * "Online" = a terminal whose lastSeenAt (refreshed by POST /api/licenses/validate) is within ONLINE_WINDOW_MS.
 * The POS calls validate on its own schedule, so this is "checked in recently", not a live socket.
 *
 * One process-local cache (CACHE_TTL_MS) keeps a console left open on several screens from re-running the
 * aggregations; concurrent requests share the same in-flight computation.
 */

import { Db } from 'mongodb'
import { getDb } from './mongodb'
import { auditLogsRepo, type AuditLogEntry } from './repositories/audit-logs'
import { MOROCCO_TZ, zonedDateKey, zonedDayStart } from './zoned-time'

export const ONLINE_WINDOW_MS = 15 * 60_000
export const SEEN_WINDOW_MS = 24 * 60 * 60_000
export const EXPIRING_SOON_MS = 7 * 24 * 60 * 60_000
export const CHART_DAYS = 7
const CACHE_TTL_MS = 30_000
const ACTIVITY_LIMIT = 8

export interface DashboardMetrics {
  generatedAt: string
  timeZone: string
  revenue: {
    today: number
    todayCount: number
    /** Yesterday from midnight up to the same time of day as now: the fair comparison for a day in progress. */
    yesterdaySameTime: number
    yesterdaySameTimeCount: number
    yesterdayFull: number
    yesterdayCount: number
    /** today vs yesterdaySameTime in percent, null when yesterday had no sales at that point. */
    changePct: number | null
  }
  /** Oldest first, one entry per Morocco calendar day, today last. Days without sales are 0. */
  salesByDay: { date: string; total: number; count: number }[]
  licenses: { active: number; trials: number; expiringSoon: number }
  terminals: { online: number; seen24h: number; merchantsOnline: number; merchantsSeen24h: number }
  merchants: { approved: number; pending: number }
  leads: { new: number }
  activity: AuditLogEntry[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

let indexesCreated = false
/** Platform-wide date-range indexes (the repositories' own indexes all start with merchantId). Also used by exports. */
export async function ensureReportingIndexes(db: Db): Promise<void> {
  if (indexesCreated) return
  await Promise.all([
    db.collection('transactions').createIndex({ createdAt: -1 }),
    db.collection('licenses').createIndex({ 'terminals.lastSeenAt': -1 }),
  ])
  indexesCreated = true
}

async function sumSales(db: Db, from: Date, to: Date): Promise<{ total: number; count: number }> {
  const [row] = await db.collection('transactions').aggregate<{ total: number; count: number }>([
    { $match: { createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]).toArray()
  return { total: round2(row?.total ?? 0), count: row?.count ?? 0 }
}

export async function computeDashboardMetrics(db: Db, now: Date = new Date()): Promise<DashboardMetrics> {
  await ensureReportingIndexes(db)
  const todayStart = zonedDayStart(now, MOROCCO_TZ, 0)
  const yesterdayStart = zonedDayStart(now, MOROCCO_TZ, -1)
  const chartStart = zonedDayStart(now, MOROCCO_TZ, -(CHART_DAYS - 1))
  const elapsedToday = now.getTime() - todayStart.getTime()
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS)
  const seenSince = new Date(now.getTime() - SEEN_WINDOW_MS)

  const [byDay, ySame, licenseCounts, terminalRows, merchantCounts, newLeads, activity] = await Promise.all([
    db.collection('transactions').aggregate<{ _id: string; total: number; count: number }>([
      { $match: { createdAt: { $gte: chartStart, $lte: now } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: MOROCCO_TZ } },
        total: { $sum: '$total' }, count: { $sum: 1 },
      } },
    ]).toArray(),
    sumSales(db, yesterdayStart, new Date(yesterdayStart.getTime() + elapsedToday)),
    db.collection('licenses').aggregate<{ active: number; trials: number; expiringSoon: number }>([
      // Status alone can lag (expiry is swept lazily), so the expiry date is checked too.
      { $match: { status: 'active', expiresAt: { $gt: now } } },
      { $group: {
        _id: null,
        active: { $sum: 1 },
        trials: { $sum: { $cond: [{ $eq: ['$isTrial', true] }, 1, 0] } },
        expiringSoon: { $sum: { $cond: [{ $lte: ['$expiresAt', new Date(now.getTime() + EXPIRING_SOON_MS)] }, 1, 0] } },
      } },
    ]).toArray(),
    db.collection('licenses').aggregate<{ seen24h: number; online: number; merchantsSeen: string[]; merchantsOnline: (string | null)[] }>([
      { $match: { 'terminals.lastSeenAt': { $gte: seenSince } } },
      { $unwind: '$terminals' },
      { $match: { 'terminals.lastSeenAt': { $gte: seenSince } } },
      { $group: {
        _id: null,
        seen24h: { $sum: 1 },
        online: { $sum: { $cond: [{ $gte: ['$terminals.lastSeenAt', onlineSince] }, 1, 0] } },
        merchantsSeen: { $addToSet: '$merchantId' },
        merchantsOnline: { $addToSet: { $cond: [{ $gte: ['$terminals.lastSeenAt', onlineSince] }, '$merchantId', null] } },
      } },
    ]).toArray(),
    db.collection('merchants').aggregate<{ _id: string; n: number }>([
      { $match: { status: { $in: ['approved', 'pending'] } } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]).toArray(),
    db.collection('leads').countDocuments({ status: 'new' }),
    auditLogsRepo.find({ limit: ACTIVITY_LIMIT }),
  ])

  const dayTotals = new Map(byDay.map((d) => [d._id, d]))
  const salesByDay: DashboardMetrics['salesByDay'] = []
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const date = zonedDateKey(zonedDayStart(now, MOROCCO_TZ, -i))
    const row = dayTotals.get(date)
    salesByDay.push({ date, total: round2(row?.total ?? 0), count: row?.count ?? 0 })
  }
  const today = salesByDay[salesByDay.length - 1]
  const yesterday = salesByDay[salesByDay.length - 2]

  const lic = licenseCounts[0]
  const term = terminalRows[0]
  const status = new Map(merchantCounts.map((m) => [m._id, m.n]))

  return {
    generatedAt: now.toISOString(),
    timeZone: MOROCCO_TZ,
    revenue: {
      today: today.total,
      todayCount: today.count,
      yesterdaySameTime: ySame.total,
      yesterdaySameTimeCount: ySame.count,
      yesterdayFull: yesterday.total,
      yesterdayCount: yesterday.count,
      changePct: ySame.total > 0 ? Math.round(((today.total - ySame.total) / ySame.total) * 1000) / 10 : null,
    },
    salesByDay,
    licenses: { active: lic?.active ?? 0, trials: lic?.trials ?? 0, expiringSoon: lic?.expiringSoon ?? 0 },
    terminals: {
      online: term?.online ?? 0,
      seen24h: term?.seen24h ?? 0,
      merchantsOnline: (term?.merchantsOnline ?? []).filter((m) => m !== null).length,
      merchantsSeen24h: term?.merchantsSeen.length ?? 0,
    },
    merchants: { approved: status.get('approved') ?? 0, pending: status.get('pending') ?? 0 },
    leads: { new: newLeads },
    activity: activity?.entries ?? [],
  }
}

let cached: { at: number; value: DashboardMetrics } | null = null
let inFlight: Promise<DashboardMetrics> | null = null

/** Cached metrics, or null when the database is unavailable. `fresh` skips the cache (the Refresh button). */
export async function getDashboardMetrics(opts: { fresh?: boolean } = {}): Promise<DashboardMetrics | null> {
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value
  const db = await getDb()
  if (!db) return null
  if (!inFlight) {
    inFlight = computeDashboardMetrics(db)
      .then((value) => { cached = { at: Date.now(), value }; return value })
      .finally(() => { inFlight = null })
  }
  return inFlight
}
