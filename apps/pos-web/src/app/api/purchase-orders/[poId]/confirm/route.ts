import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ poId: string }> },
): Promise<NextResponse> {
  const { poId } = await params;
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/purchase-orders/${encodeURIComponent(poId)}/confirm`, {
      method: 'POST',
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(15_000),
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
