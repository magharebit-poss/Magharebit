import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/lib/client-ip';
import { validateLeadInput } from '@/lib/lead-input';

/**
 * POST /api/demo-request: legacy relay of the demo form to the marketing backend (the form also posts to /api/leads).
 * Public, so: 5 per hour per IP, the same field validation as /api/leads (types, lengths, no links or markup), only
 * the validated fields are forwarded, and the relay has a timeout so a slow backend cannot hold the request open.
 */
export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(`demo-request:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Try again in an hour.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const checked = validateLeadInput(body);
  if (!checked.valid) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      await fetch(`${apiUrl}/marketing/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checked.data),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      console.error('[demo-request] backend unavailable');
    }
  }

  return NextResponse.json({ ok: true });
}
