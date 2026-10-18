import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

type Ctx = { params: Promise<{ productId: string }> };

export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { productId } = await ctx.params;
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(
      `${BACKEND_URL}/ml/waste-risk/by-product/${productId}`,
      {
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'upstream error' },
      { status: 502 },
    );
  }
}
