import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

type Ctx = { params: Promise<{ id: string }> };

// DELETE — remove the image but keep the product.
export async function DELETE(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}/image`, {
      method: 'DELETE',
      headers: auth ? { Authorization: auth } : {},
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

// POST — multipart/form-data passthrough for image upload/replace.
export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = req.headers.get('authorization');
  const contentType = req.headers.get('content-type') ?? '';
  try {
    const body = await req.arrayBuffer();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
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
