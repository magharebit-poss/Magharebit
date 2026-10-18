import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const upstream = await fetch(`${BACKEND_URL}/analytics/reorder-alerts`, {
    headers: { Authorization: token },
  });

  const data: unknown = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
