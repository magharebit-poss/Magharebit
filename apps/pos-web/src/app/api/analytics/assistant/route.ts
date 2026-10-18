import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const body: unknown = await req.json();

  const upstream = await fetch(`${BACKEND_URL}/analytics/assistant`, {
    method:  'POST',
    headers: { Authorization: token, 'content-type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(30_000),
  });

  const data: unknown = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
