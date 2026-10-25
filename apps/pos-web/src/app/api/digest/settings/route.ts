import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

// GET/PUT /api/digest/settings — daily report on/off, phone, language, send time.
async function forward(req: NextRequest, method: 'GET' | 'PUT'): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/digest/settings`, {
      method,
      headers: { ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: auth } : {}) },
      ...(method === 'PUT' ? { body: await req.text() } : {}),
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

export const GET = (req: NextRequest) => forward(req, 'GET');
export const PUT = (req: NextRequest) => forward(req, 'PUT');
