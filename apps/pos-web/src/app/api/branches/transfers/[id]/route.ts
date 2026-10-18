import { NextRequest, NextResponse } from 'next/server';
const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.headers.get('authorization') ?? '';
  const body = await req.json();
  const res = await fetch(`${API}/branches/transfers/${id}`, {
    method: 'PATCH',
    headers: { authorization: token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
