/**
 * GET /api/admin/export/[dataset]?format=csv|xlsx&locale=ar|fr|en&...filters
 *
 *   dataset = commission-rates (q) | leads (q, status) | sales (from, to: YYYY-MM-DD, Morocco days)
 *
 * owner and operator only: exports carry personal data (phone numbers), so a viewer gets 403.
 * Every export is written to the audit log (exportData) BEFORE the file is sent; if the audit entry cannot be
 * recorded the export is refused (503), so no personal data leaves without a trace.
 * The file is built in memory (at most MAX_EXPORT_ROWS rows); X-Export-Truncated: 1 when the filter matched more.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import { checkRateLimit } from '@/lib/rateLimit'
import { buildExport, isExportDataset } from '@/lib/export/datasets'
import { toCsv } from '@/lib/export/csv'
import { toXlsx } from '@/lib/export/xlsx'
import { EXPORT_MIME, type ExportFormat } from '@/lib/export/table'
import { zonedDateKey } from '@/lib/zoned-time'
import type { Lang } from '@/components/admin/adminUi'

export async function GET(req: NextRequest, { params }: { params: Promise<{ dataset: string }> }): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { dataset } = await params
  if (!isExportDataset(dataset)) return NextResponse.json({ error: 'unknown_dataset' }, { status: 404 })

  const sp = req.nextUrl.searchParams
  const format: ExportFormat | null = sp.get('format') === 'csv' ? 'csv' : sp.get('format') === 'xlsx' ? 'xlsx' : null
  if (!format) return NextResponse.json({ error: 'invalid_format' }, { status: 422 })
  const locale = sp.get('locale')
  const lang: Lang = locale === 'ar' || locale === 'fr' ? locale : 'en'

  if (!(await checkRateLimit(`admin-export:${actor.id}`, 20, 10 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let built
  try {
    built = await buildExport(dataset, lang, {
      q: sp.get('q') ?? undefined,
      status: sp.get('status') ?? undefined,
      from: sp.get('from') ?? undefined,
      to: sp.get('to') ?? undefined,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'invalid_range') return NextResponse.json({ error: 'invalid_range' }, { status: 422 })
    if (msg === 'database_unavailable') return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
    console.error('[GET /api/admin/export]', dataset, err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const recorded = await recordAudit({
    actor, action: 'exportData', targetType: 'export', targetId: dataset, ip: clientIp(req),
    meta: { format, rows: built.table.rows.length, truncated: built.truncated, filters: built.applied },
  })
  if (!recorded) return NextResponse.json({ error: 'audit_unavailable' }, { status: 503 })

  const body = format === 'csv' ? toCsv(built.table) : toXlsx(built.table)
  const fileName = `magharebit_${built.table.name}_${built.fileSuffix ?? zonedDateKey(new Date())}.${format}`
  return new NextResponse(body as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': EXPORT_MIME[format],
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Export-Rows': String(built.table.rows.length),
      'X-Export-Truncated': built.truncated ? '1' : '0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
