import { type NextRequest, NextResponse } from 'next/server';

const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization') ?? '';
  try {
    const res = await fetch(`${API}/staff/manage`, {
      headers: { authorization: token },
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upstream error' }, { status: 502 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization') ?? '';
  try {
    const body = await req.json();
    const res = await fetch(`${API}/staff/manage`, {
      method: 'POST',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'upstream error' }, { status: 502 });
  }
}
