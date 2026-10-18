import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const upstream = `${BACKEND_URL}/analytics/integrity${qs ? `?${qs}` : ''}`;

  const auth = req.headers.get('authorization') ?? '';
  try {
    const res = await fetch(upstream, {
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'upstream error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
