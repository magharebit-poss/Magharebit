import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = req.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  const { id } = await params;

  const upstream = await fetch(
    `${BACKEND_URL}/analytics/customer-suggestions/${id}/act`,
    {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  );

  const data: unknown = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
