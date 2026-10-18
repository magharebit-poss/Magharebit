import { NextRequest, NextResponse } from 'next/server'
import { checkDbConnection } from '@/lib/db-check'

export async function GET(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret')
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await checkDbConnection()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    database: db,
    whatsapp: {
      configured: !!(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_API_TOKEN),
      businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER ?? '212619522487',
    },
    environment: process.env.NODE_ENV,
  })
}
