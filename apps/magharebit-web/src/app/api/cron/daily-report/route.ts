/**
 * POST /api/cron/daily-report
 *
 * Sends WhatsApp daily sales summaries to all merchants who have opted in.
 * Triggered by Vercel Cron at 20:00 UTC (= 21:00 Morocco time, UTC+1).
 *
 * Security: requires  Authorization: Bearer <CRON_SECRET>
 *
 * Each merchant receives their own message — fan-out is sequential with a small
 * delay to avoid hitting Green API rate limits.
 *
 * Response: { sent: number, failed: number, skipped: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { settingsRepo } from '@/lib/repositories/settings'
import { transactionsRepo } from '@/lib/repositories/transactions'
import { productsRepo } from '@/lib/repositories/products'
import { sendDailyReport } from '@/lib/whatsapp'

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // In dev (no secret set), allow calls from localhost only
    const host = req.headers.get('host') ?? ''
    return host.startsWith('localhost') || host.startsWith('127.')
  }
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${cronSecret}`
}

// ── Small delay to avoid hammering Green API ──────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Optionally allow overriding the report date (useful for manual testing)
  const { searchParams } = req.nextUrl
  const targetDate = searchParams.get('date') ?? getYesterdayDate()

  // Find all merchants subscribed to daily reports
  const subscribers = await settingsRepo.findDailyReportSubscribers()

  if (subscribers.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, skipped: 0, date: targetDate })
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const settings of subscribers) {
    try {
      // Fetch yesterday's summary for this merchant
      const [summary, lowStockCount] = await Promise.all([
        transactionsRepo.getYesterdaySummary(settings.merchantId),
        productsRepo.getLowStockCount(settings.merchantId),
      ])

      // Skip if there were zero transactions (nothing to report)
      if (summary.totalTransactions === 0) {
        skipped++
        continue
      }

      // Find top product from full report (reuse getReportSummary for yesterday)
      const from = new Date(targetDate + 'T00:00:00.000Z')
      const to   = new Date(targetDate + 'T23:59:59.999Z')
      const report = await transactionsRepo.getReportSummary({
        merchantId: settings.merchantId,
        from,
        to,
      })
      const topProduct = report.topProducts[0]
        ? { name: report.topProducts[0].name, qty: report.topProducts[0].totalQty }
        : null

      const result = await sendDailyReport({
        to:            settings.storePhone,
        storeName:     settings.storeName || 'متجرك',
        date:          targetDate,
        revenue:       summary.totalRevenue,
        txCount:       summary.totalTransactions,
        avgBasket:     summary.totalRevenue > 0 && summary.totalTransactions > 0
          ? Math.round((summary.totalRevenue / summary.totalTransactions) * 100) / 100
          : 0,
        topProduct,
        lowStockCount,
      })

      if (result.success) {
        sent++
      } else {
        failed++
        console.error('[cron/daily-report] WhatsApp send failed for', settings.merchantId, result.error)
      }

      // 300ms between messages to respect Green API rate limits
      await sleep(300)

    } catch (err) {
      failed++
      console.error('[cron/daily-report] Error processing merchant', settings.merchantId, err)
    }
  }

  return NextResponse.json({
    ok:      true,
    date:    targetDate,
    total:   subscribers.length,
    sent,
    failed,
    skipped,
  })
}

// ── Utility ───────────────────────────────────────────────────────────────────

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
