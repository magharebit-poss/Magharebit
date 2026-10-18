import { NextRequest, NextResponse } from 'next/server';

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }
  const days =
    req.nextUrl.searchParams.get('days') ?? '30';
  const res = await fetch(
    `${API}/analytics/cashflow?days=${days}`,
    {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(20_000),
    }
  );
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
