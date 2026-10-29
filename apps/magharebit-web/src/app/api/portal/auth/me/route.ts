/**
 * GET /api/portal/auth/me
 *
 * Returns the current merchant's profile + subscription info.
 * Used by the portal dashboard and layout to hydrate merchant context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { productsRepo } from '@/lib/repositories/products'
import { transactionsRepo } from '@/lib/repositories/transactions'
import { settingsRepo } from '@/lib/repositories/settings'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const merchant = await merchantsRepo.findById(session.merchantId)
  if (!merchant) return unauthorizedResponse('merchant_not_found')

  // Get active license
  const licenseKey = merchant.phone || merchant.email || ''
  const { licenses } = await licensesRepo.findAll({ merchantId: licenseKey, status: 'active' })
  const license = licenses[0] ?? null

  // Lightweight aggregates for dashboard quick-load
  const [todaySummary, lowStockCount, settings] = await Promise.all([
    transactionsRepo.getTodaySummary(session.merchantId),
    productsRepo.getLowStockCount(session.merchantId),
    settingsRepo.get(session.merchantId),
  ])

  return NextResponse.json({
    merchantId:    session.merchantId,
    storeName:     merchant.storeName,
    logoUrl:       settings.logoUrl || null,
    sector:       merchant.sector,
    city:          merchant.city,
    locale:        merchant.locale,
    plan:          merchant.plan ?? license?.plan ?? null,
    expiresAt:     merchant.subscriptionEndsAt ?? license?.expiresAt ?? null,
    daysRemaining: license
      ? Math.max(0, Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null,
    licenseKey:    license?.key ?? null,
    isTrial:       license?.isTrial ?? false,
    today:         todaySummary,
    lowStockCount,
  })
}
