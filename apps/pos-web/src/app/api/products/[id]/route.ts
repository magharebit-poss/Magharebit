import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = _req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}`, {
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

// Accepts both application/json and multipart/form-data (image upload).
// Passes the raw body + original Content-Type through unchanged.
export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = req.headers.get('authorization');
  const contentType = req.headers.get('content-type') ?? '';
  try {
    const body = await req.arrayBuffer();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
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

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const auth = _req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
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
