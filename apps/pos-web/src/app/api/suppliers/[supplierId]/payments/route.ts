import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> },
): Promise<NextResponse> {
  const { supplierId } = await params;
  const auth = req.headers.get('authorization');
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND_URL}/suppliers/${encodeURIComponent(supplierId)}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const resBody = await res.text();
    return new NextResponse(resBody, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upstream error' }, { status: 502 });
  }
}
