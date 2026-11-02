import { NextRequest, NextResponse } from 'next/server';
import { callbacksRepo } from '@/lib/repositories/callbacks';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/client-ip';

// POST /api/quick-callback — exit-intent modal endpoint.
// Lighter than /api/leads: phone + locale + page only. Does NOT trigger
// WhatsApp messages — adds to the `callbacks` collection so the admin
// knows to PHONE these visitors rather than message them.

export async function POST(req: NextRequest) {
  try {
    // Same rate limit envelope as lead submissions: 5/hour/IP
    const ip = clientIp(req);
    if (!(await checkRateLimit(`callback:${ip}`, 5, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const phone = typeof body?.phone === 'string' ? body.phone.replace(/\s/g, '') : '';
    if (!/^0[5-7]\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }

    const locale = ['ar', 'fr', 'en'].includes(body?.locale) ? body.locale : 'fr';
    // A page path only: stored and shown to the admin team, so no markup, no scheme, no whitespace
    const rawPage = typeof body?.page === 'string' ? body.page.slice(0, 200) : '/';
    const page = /^\/[A-Za-z0-9\-._~/%?=&#:]*$/.test(rawPage) ? rawPage : '/';

    const cb = await callbacksRepo.create({ phone, locale, page });

    return NextResponse.json({ success: true, id: cb.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/quick-callback]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
