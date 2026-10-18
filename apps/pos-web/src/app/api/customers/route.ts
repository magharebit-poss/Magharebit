import { NextRequest, NextResponse } from 'next/server';
const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization') ?? '';
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const res = await fetch(
      `${API}/customers?q=${encodeURIComponent(q)}`,
      { headers: { authorization: token }, signal: AbortSignal.timeout(5000) },
    );
    console.log('[customers] backend status:', res.status, 'token:', token ? 'present' : 'missing');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[/api/customers GET]', err);
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization') ?? '';
    const body = await req.json();
    const res = await fetch(`${API}/customers`, {
      method: 'POST',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    console.log('[customers POST] backend status:', res.status);
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    console.error('[/api/customers POST]', err);
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }
}
