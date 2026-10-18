/**
 * GET /api/health
 *
 * Public liveness probe — no auth required.
 * Returns only server status and DB connectivity (no secrets, no config details).
 * Safe to call from QA scripts, CI pipelines, and uptime monitors.
 *
 * For the full admin diagnostic (collections list, WhatsApp config, env details)
 * use GET /api/admin/health with x-admin-secret header instead.
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function GET(): Promise<NextResponse> {
  let dbStatus: 'ok' | 'error' = 'error'
  try {
    const db = await getDb()
    if (db) dbStatus = 'ok'
  } catch {
    // dbStatus stays 'error'
  }

  return NextResponse.json(
    { server: 'ok', db: dbStatus, ts: new Date().toISOString() },
    { status: dbStatus === 'ok' ? 200 : 503 },
  )
}
