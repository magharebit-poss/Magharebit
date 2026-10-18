import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/products/:id/cost-history — last 20 supplier-invoice cost records.
export async function GET(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}/cost-history`, {
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upstream error' }, { status: 502 });
  }
}
