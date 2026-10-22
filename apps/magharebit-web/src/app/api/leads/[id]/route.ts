import { NextRequest, NextResponse } from 'next/server';
import { leadsRepo, Lead } from '@/lib/repositories/leads';
import { authenticateAdmin, canWrite } from '@/lib/admin-auth';
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs';

type LeadStatus = Lead['status'];
// 'activated' is NOT settable here: it only happens through
// POST /api/admin/leads/[id]/activate, which issues a real, audited license key.
const SETTABLE_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected'];

// ── PATCH /api/leads/[id] — update lead status (admin, write role) ───────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await authenticateAdmin(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body ?? {};

    if ('licenseKey' in (body ?? {})) {
      return NextResponse.json(
        { error: 'licenseKey cannot be set here: use POST /api/admin/leads/{id}/activate' },
        { status: 400 }
      );
    }
    if (status === 'activated') {
      return NextResponse.json(
        { error: 'status "activated" is set only by POST /api/admin/leads/{id}/activate' },
        { status: 400 }
      );
    }
    if (!status || !SETTABLE_STATUSES.includes(status as LeadStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${SETTABLE_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const before = await leadsRepo.findById(id);
    if (!before) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (before.status === 'activated') {
      return NextResponse.json({ error: 'lead_already_activated' }, { status: 409 });
    }

    const updated = await leadsRepo.update(id, { status: status as LeadStatus });
    if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const auditRecorded = await recordAudit({
      actor, action: 'updateLeadStatus', targetType: 'merchant', targetId: before.phone,
      meta: { leadId: id, from: before.status, to: status }, ip: clientIp(request),
    });

    return NextResponse.json({ success: true, lead: updated, auditRecorded });
  } catch (err) {
    console.error('[PATCH /api/leads/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
