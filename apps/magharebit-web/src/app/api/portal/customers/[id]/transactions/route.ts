/**
 * GET /api/portal/customers/[id]/transactions
 *
 * Returns paged transaction history for a specific customer.
 * Queries the transactions collection directly using customerId as a filter.
 *
 * Query params:
 *   page  number  — default 1
 *   limit number  — default 20, max 50
 */

import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { customersRepo } from '@/lib/repositories/customers'
import { getDb } from '@/lib/mongodb'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  // Verify customer belongs to this merchant
  const customer = await customersRepo.findById(session.merchantId, id)
  if (!customer) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const page  = Math.max(1,  Number(searchParams.get('page')  ?? 1))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)))

  const db = await getDb()
  if (!db) return NextResponse.json({ transactions: [], total: 0 })

  const filter = { merchantId: session.merchantId, customerId: id }
  const skip   = (page - 1) * limit

  const [docs, total] = await Promise.all([
    db.collection('transactions')
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit)
      .toArray(),
    db.collection('transactions').countDocuments(filter),
  ])

  const transactions = docs.map((d) => {
    const raw = d as Record<string, unknown>
    const _id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id)
    const { _id: _removed, ...rest } = raw
    void _removed
    return { id: _id, ...rest }
  })

  return NextResponse.json({ transactions, total })
}
