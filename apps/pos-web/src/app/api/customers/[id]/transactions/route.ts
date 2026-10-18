import { NextRequest, NextResponse } from 'next/server';
const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.headers.get('authorization') ?? '';
  const res = await fetch(`${API}/customers/${id}/transactions`, {
    headers: { authorization: token },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
