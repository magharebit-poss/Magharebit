import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ whatsappOrderId: string }> },
): Promise<NextResponse> {
  const { whatsappOrderId } = await params;
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(
      `${BACKEND_URL}/kds/orders/from-whatsapp/${encodeURIComponent(whatsappOrderId)}`,
      {
        method: 'POST',
        headers: auth ? { Authorization: auth } : {},
        signal: AbortSignal.timeout(10_000),
      },
    );
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upstream error' }, { status: 502 });
  }
}
