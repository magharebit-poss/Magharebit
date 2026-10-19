import { NextRequest, NextResponse } from 'next/server';
import { leadsRepo, Lead } from '@/lib/repositories/leads';
import { isAdminRequest } from '@/lib/admin-auth';

type LeadStatus = Lead['status'];
const VALID_STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected', 'activated'];

// ── PATCH /api/leads/[id] — update lead status ────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, licenseKey } = body;

    if (!status || !VALID_STATUSES.includes(status as LeadStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const patch: Partial<Lead> = { status: status as LeadStatus };
    if (typeof licenseKey === 'string' && licenseKey.trim()) {
      patch.licenseKey = licenseKey.trim();
    }

    const updated = await leadsRepo.update(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead: updated });
  } catch (err) {
    console.error('[PATCH /api/leads/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
