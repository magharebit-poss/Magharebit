import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

// GET — status flags only ("configured" yes/no). The backend never returns a secret.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/settings/integrations`, {
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(10_000),
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}

// PUT — set or clear secrets. The body is forwarded as-is and is never logged here.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND_URL}/settings/integrations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    // No error text: a fetch error must not carry request details.
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
