import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

// GET /api/products — POS cashier product list (STAFF_ROLES)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/products${req.nextUrl.search}`, {
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(8_000),
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

// POST /api/products — create product (MANAGER/SUPERVISOR, multipart/form-data).
// Forward the raw body with its original Content-Type (including multipart boundary).
// Do NOT set Content-Type: application/json — that would destroy the boundary.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const contentType = req.headers.get('content-type') ?? '';
  try {
    const body = await req.arrayBuffer();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(`${BACKEND_URL}/products`, {
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
