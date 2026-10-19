import { NextRequest, NextResponse } from 'next/server';
import { leadsRepo, Lead } from '@/lib/repositories/leads';
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp';
import { checkRateLimit } from '@/lib/rateLimit';
import { isAdminRequest } from '@/lib/admin-auth';

type LeadStatus = Lead['status'];

// ── Validation ───────────────────────────────────────────────────────────────

const ALLOWED_BUSINESS_TYPES = [
  'bakery', 'cafe', 'restaurant', 'grocery', 'beauty', 'fashion',
  'pharmacy', 'vegetables', 'general', 'multi', 'other',
];

function validateLeadInput(body: unknown): { valid: true; data: { storeName: string; phone: string; businessType: string; city: string; locale: string } } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid payload' };

  const b = body as Record<string, unknown>;

  const storeName = String(b.storeName ?? '').trim();
  if (storeName.length < 2 || storeName.length > 100) {
    return { valid: false, error: 'storeName must be 2-100 characters' };
  }

  const phone = String(b.phone ?? '').replace(/\s/g, '');
  if (!/^0[5-7]\d{8}$/.test(phone)) {
    return { valid: false, error: 'phone must be a valid Moroccan mobile number (06/07XXXXXXXX)' };
  }

  const businessType = String(b.businessType ?? '').trim();
  if (businessType && !ALLOWED_BUSINESS_TYPES.includes(businessType)) {
    return { valid: false, error: 'businessType must be one of: ' + ALLOWED_BUSINESS_TYPES.join(', ') };
  }

  const city = String(b.city ?? '').trim();
  if (city && (city.length < 2 || city.length > 100)) {
    return { valid: false, error: 'city must be 2-100 characters' };
  }

  const locale = ['ar', 'fr', 'en'].includes(String(b.locale)) ? String(b.locale) : 'fr';

  return { valid: true, data: { storeName, phone, businessType, city, locale } };
}

// ── POST /api/leads — create a new lead ───────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per hour per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkRateLimit(`leads:${ip}`, 5, 60 * 60 * 1000)) {
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

    // WhatsApp notifications (non-blocking, fire-and-forget)
    sendWhatsAppMessage({
      to: lead.phone,
      message: whatsappTemplates.leadConfirmation(lead.storeName, lead.locale ?? 'fr'),
    }).catch(err => console.error('[whatsapp] merchant confirmation failed:', err));

    sendWhatsAppMessage({
      to: process.env.WHATSAPP_BUSINESS_NUMBER ?? '212619522487',
      message: whatsappTemplates.newLead(
        lead.storeName,
        lead.phone,
        lead.city,
        process.env.NEXT_PUBLIC_APP_URL ?? 'https://magharebit.com'
      ),
    }).catch(err => console.error('[whatsapp] admin notification failed:', err));

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/leads — list all leads (admin only) ──────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const status = searchParams.get('status') ?? 'all';

    const validStatuses: Array<LeadStatus | 'all'> = ['new', 'contacted', 'converted', 'rejected', 'activated', 'all'];
    const safeStatus = validStatuses.includes(status as LeadStatus | 'all') ? (status as LeadStatus | 'all') : 'all';
    const { leads, total } = await leadsRepo.findAll({ page, limit, status: safeStatus });
    return NextResponse.json({ leads, total, page, limit });
  } catch (err) {
    console.error('[GET /api/leads]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
