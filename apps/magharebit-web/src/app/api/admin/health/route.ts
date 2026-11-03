import { BRAND } from '@/lib/brand'
import { NextRequest, NextResponse } from 'next/server'
import { checkDbConnection } from '@/lib/db-check'
import { isAdminRequest } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await checkDbConnection()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    database: db,
    whatsapp: {
      configured: !!(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_API_TOKEN),
      businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER ?? BRAND.contact.waNumber,
    },
    environment: process.env.NODE_ENV,
  })
}
