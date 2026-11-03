import { BRAND } from '@/lib/brand';
import { NextRequest, NextResponse } from 'next/server';
import { leadsRepo, Lead } from '@/lib/repositories/leads';
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp';
import { checkRateLimit } from '@/lib/rateLimit';
import { authenticateAdmin } from '@/lib/admin-auth';
import { clientIp } from '@/lib/client-ip';
import { outboundBudget } from '@/lib/public-guard';
import { validateLeadInput } from '@/lib/lead-input';

type LeadStatus = Lead['status'];

// ── POST /api/leads — create a new lead ───────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per hour per IP
    const ip = clientIp(request);
    if (!(await checkRateLimit(`leads:${ip}`, 5, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const result = validateLeadInput(body);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const lead = await leadsRepo.create(result.data);

    // WhatsApp notifications (non-blocking, fire-and-forget). The confirmation goes to the number the visitor typed, so:
    //  - at most ONE per phone number per 24 h (an attacker cannot make us message a victim repeatedly, from any IP),
    //  - and a global hourly budget for everything anonymous visitors can trigger (credit + sender reputation).
    // The lead itself is always saved; only the messages are skipped.
    const mayConfirm = await checkRateLimit(`lead-confirm:${lead.phone}`, 1, 24 * 60 * 60 * 1000);
    if (mayConfirm && (await outboundBudget('whatsapp-public'))) {
      sendWhatsAppMessage({
        to: lead.phone,
        message: whatsappTemplates.leadConfirmation(lead.storeName, lead.locale ?? 'fr'),
      }).catch(err => console.error('[whatsapp] merchant confirmation failed:', err));
    }

    if (await outboundBudget('whatsapp-public')) {
      sendWhatsAppMessage({
        to: process.env.WHATSAPP_BUSINESS_NUMBER ?? BRAND.contact.waNumber,
        message: whatsappTemplates.newLead(
          lead.storeName,
          lead.phone,
          lead.city,
          process.env.NEXT_PUBLIC_APP_URL ?? 'https://magharebit.com'
        ),
      }).catch(err => console.error('[whatsapp] admin notification failed:', err));
    }

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/leads — list all leads (admin only) ──────────────────────────────
export async function GET(request: NextRequest) {
  if (!(await authenticateAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const status = searchParams.get('status') ?? 'all';

    const validStatuses: Array<LeadStatus | 'all'> = ['new', 'contacted', 'converted', 'rejected', 'activated', 'all'];
    const safeStatus = validStatuses.includes(status as LeadStatus | 'all') ? (status as LeadStatus | 'all') : 'all';
    const q = (searchParams.get('q') ?? '').slice(0, 100);
    const { leads, total } = await leadsRepo.findAll({ page, limit, status: safeStatus, q });
    return NextResponse.json({ leads, total, page, limit });
  } catch (err) {
    console.error('[GET /api/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
