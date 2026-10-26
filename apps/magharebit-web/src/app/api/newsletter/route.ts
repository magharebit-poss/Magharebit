import { NextRequest, NextResponse } from 'next/server';
import { subscribersRepo } from '@/lib/repositories/subscribers';
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 3 requests per hour per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!(await checkRateLimit(`newsletter:${ip}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const phoneRaw = String(body?.phone ?? '').replace(/\s/g, '');

    // Validate Moroccan mobile phone
    if (!/^0[5-7]\d{8}$/.test(phoneRaw)) {
      return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    }

    const locale = ['ar', 'fr', 'en'].includes(body?.locale) ? body.locale : 'fr';

    // Check for duplicates
    const existing = await subscribersRepo.findByPhone(phoneRaw);
    if (existing) {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }

    await subscribersRepo.create({ phone: phoneRaw, locale });

    // Send WhatsApp welcome message (non-blocking)
    sendWhatsAppMessage({
      to: phoneRaw,
      message: whatsappTemplates.newsletterWelcome(locale),
    }).catch(err => console.error('[whatsapp] newsletter welcome failed:', err));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
