import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storeName, phone, businessType, city, locale } = body;

    if (!storeName || !phone || !businessType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/marketing/demo-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeName, phone, businessType, city, locale }),
        });
      } catch {
        console.error('[demo-request] backend unavailable');
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
