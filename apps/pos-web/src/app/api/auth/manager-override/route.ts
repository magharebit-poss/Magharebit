import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const upstream = await fetch(`${BACKEND_URL}/auth/manager-override`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
