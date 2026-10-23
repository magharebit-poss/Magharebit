/**
 * GET  /api/admin/coupons?q=&active=true|false&page=&limit=   (any admin)
 * POST /api/admin/coupons   { code, kind, value, description?, plans?, maxRedemptions?, expiresAt? }   (owner/operator)
 *
 * Scaffold: codes are stored and audited (createCoupon); redemption is not wired into sign-up yet.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { couponsRepo, COUPON_CODE_RE, type CouponKind } from '@/lib/repositories/coupons'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import type { LicensePlan } from '@/lib/license-key'

const KINDS: CouponKind[] = ['percent', 'fixed', 'trial_days']
const PLANS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const activeParam = sp.get('active')
  const res = await couponsRepo.findAll({
    q: (sp.get('q') ?? '').slice(0, 40),
    active: activeParam === 'true' ? true : activeParam === 'false' ? false : undefined,
    page: parseInt(sp.get('page') ?? '1', 10) || 1,
    limit: parseInt(sp.get('limit') ?? '25', 10) || 25,
  })
  if (!res) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json(res)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let b: Record<string, unknown>
  try { b = (await req.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : ''
  if (!COUPON_CODE_RE.test(code)) return NextResponse.json({ error: 'code must be 3-24 chars: A-Z, 0-9, _ or -' }, { status: 422 })
  const kind = b.kind as CouponKind
  if (!KINDS.includes(kind)) return NextResponse.json({ error: `kind must be one of: ${KINDS.join(', ')}` }, { status: 422 })
  const value = Number(b.value)
  const maxByKind = kind === 'percent' ? 100 : kind === 'trial_days' ? 90 : 100000
  if (!Number.isFinite(value) || value <= 0 || value > maxByKind || (kind !== 'fixed' && !Number.isInteger(value))) {
    return NextResponse.json({ error: `value out of range for ${kind} (1-${maxByKind})` }, { status: 422 })
  }

  let plans: LicensePlan[] | undefined
  if (b.plans !== undefined) {
    if (!Array.isArray(b.plans) || !b.plans.every((p) => PLANS.includes(p as LicensePlan))) return NextResponse.json({ error: 'invalid plans' }, { status: 422 })
    plans = [...new Set(b.plans as LicensePlan[])]
  }
  let maxRedemptions: number | undefined
  if (b.maxRedemptions !== undefined && b.maxRedemptions !== null && b.maxRedemptions !== '') {
    maxRedemptions = Number(b.maxRedemptions)
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000) return NextResponse.json({ error: 'invalid maxRedemptions' }, { status: 422 })
  }
  let expiresAt: Date | undefined
  if (typeof b.expiresAt === 'string' && b.expiresAt) {
    expiresAt = new Date(b.expiresAt)
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'expiresAt must be a future date' }, { status: 422 })
  }
  const description = typeof b.description === 'string' ? b.description.trim().slice(0, 200) : ''

  let coupon
  try {
    coupon = await couponsRepo.create({
      code, kind, value, createdBy: actor.name,
      ...(description ? { description } : {}), ...(plans?.length ? { plans } : {}),
      ...(maxRedemptions ? { maxRedemptions } : {}), ...(expiresAt ? { expiresAt } : {}),
    })
  } catch (e) {
    if ((e as Error).message === 'duplicate') return NextResponse.json({ error: 'code_exists' }, { status: 409 })
    throw e
  }
  if (!coupon) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })

  const auditRecorded = await recordAudit({
    actor, action: 'createCoupon', targetType: 'coupon', targetId: coupon.id,
    meta: { code, kind, value, ...(plans?.length ? { plans } : {}), ...(maxRedemptions ? { maxRedemptions } : {}) }, ip: clientIp(req),
  })
  return NextResponse.json({ coupon, auditRecorded }, { status: 201 })
}
