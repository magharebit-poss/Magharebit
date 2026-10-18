/**
 * GET /api/portal/reports/summary
 *
 * Returns aggregated report data for the given date range.
 *
 * Query params:
 *   dateFrom  ISO date string (default: 30 days ago)
 *   dateTo    ISO date string (default: now)
 *
 * Response:
 * {
 *   period: { from: string; to: string }
 *   totals: { revenue: number; transactions: number; avgBasket: number; totalDiscount: number }
 *   byPayment: Record<PaymentMethod, { revenue: number; count: number }>
 *   byDay: { date: string; revenue: number; transactions: number }[]
 *   topProducts: { productId: string; name: string; plu: string; qtySold: number; revenue: number }[]
 *   byEmployee: { employeeId: string; name: string; txCount: number; revenue: number }[]
 *   today: { totalRevenue: number; totalTransactions: number; avgBasket: number }
 *   yesterday: { totalRevenue: number; totalTransactions: number; avgBasket: number }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { transactionsRepo } from '@/lib/repositories/transactions'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl

  // Default range: last 30 days
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 30)
  defaultFrom.setHours(0, 0, 0, 0)

  const defaultTo = new Date()
  defaultTo.setHours(23, 59, 59, 999)

  const rawFrom = searchParams.get('dateFrom')
  const rawTo   = searchParams.get('dateTo')

  const dateFrom = rawFrom ? new Date(rawFrom) : defaultFrom
  const dateTo   = rawTo   ? new Date(rawTo)   : defaultTo

  // Clamp invalid dates to defaults
  const from = isNaN(dateFrom.getTime()) ? defaultFrom : dateFrom
  const to   = isNaN(dateTo.getTime())   ? defaultTo   : dateTo

  const [summary, todaySummary, yesterdaySummary] = await Promise.all([
    transactionsRepo.getReportSummary({ merchantId: session.merchantId, from, to }),
    transactionsRepo.getTodaySummary(session.merchantId),
    transactionsRepo.getYesterdaySummary(session.merchantId),
  ])

  // summary already includes period from repo; add today/yesterday on top
  return NextResponse.json({
    ...summary,
    today:     todaySummary,
    yesterday: yesterdaySummary,
  })
}
