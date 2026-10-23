/**
 * GET /api/admin/merchants
 *
 * List merchants, optionally filtered by status.
 * Admin only: session cookie (POST /api/admin/login) or x-admin-secret header.
 *
 * Query params:
 *   status  — "pending" | "approved" | "suspended" | "all"  (default: "all")
 *   page    — 1-based page number (default: 1)
 *   limit   — page size, max 100 (default: 50)
 *
 * Response: { merchants: MerchantDoc[], total, page, limit }
 *
 * Each merchant includes its `id` (MongoDB _id hex string) which is used
 * as the [id] segment in the approve and revoke routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantsRepo, MerchantStatus } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { authenticateAdmin } from '@/lib/admin-auth'
import type { LicensePlan } from '@/lib/license-key'

const VALID_STATUSES: Array<MerchantStatus | 'all'> = ['pending', 'approved', 'suspended', 'all']

const VALID_PLANS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')   ?? '1',  10))
  const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const status = (searchParams.get('status') ?? 'all') as MerchantStatus | 'all'

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 422 }
    )
  }

  // Sweep expired licenses so the list is always accurate
  await licensesRepo.sweepExpired()

  const sector = (searchParams.get('sector') ?? '').slice(0, 40) || undefined
  const planParam = searchParams.get('plan') as LicensePlan | null
  const plan = planParam && VALID_PLANS.includes(planParam) ? planParam : undefined
  const q = (searchParams.get('q') ?? '').slice(0, 100)

  const { merchants, total } = await merchantsRepo.findAll({ status, page, limit, sector, plan, q })

  return NextResponse.json({ merchants, total, page, limit })
}
