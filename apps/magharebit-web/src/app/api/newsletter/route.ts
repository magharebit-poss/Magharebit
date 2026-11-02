import { NextRequest, NextResponse } from 'next/server';
import { subscribersRepo } from '@/lib/repositories/subscribers';
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/client-ip';
import { outboundBudget } from '@/lib/public-guard';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 3 requests per hour per IP
    const ip = clientIp(req);
    if (!(await checkRateLimit(`newsletter:${ip}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in an hour.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const phoneRaw = typeof body?.phone === 'string' ? body.phone.replace(/\s/g, '') : '';

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

    // Welcome message to a number the visitor typed (no proof of ownership): each phone is subscribed once (above),
    // and the global hourly budget caps what anonymous traffic can make us send. The subscription is kept either way.
    if (await outboundBudget('whatsapp-public')) {
      sendWhatsAppMessage({
        to: phoneRaw,
        message: whatsappTemplates.newsletterWelcome(locale),
      }).catch(err => console.error('[whatsapp] newsletter welcome failed:', err));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
