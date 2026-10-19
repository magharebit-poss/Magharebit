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
import { isAdminRequest } from '@/lib/admin-auth'

const VALID_STATUSES: Array<MerchantStatus | 'all'> = ['pending', 'approved', 'suspended', 'all']

function isAdminAuthed(req: NextRequest): boolean {
  return isAdminRequest(req)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAdminAuthed(req)) {
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

  const { merchants, total } = await merchantsRepo.findAll({ status, page, limit })

  return NextResponse.json({ merchants, total, page, limit })
}
