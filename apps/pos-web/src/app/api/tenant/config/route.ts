import { type NextRequest, NextResponse } from 'next/server';

const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization') ?? '';
  const res = await fetch(`${API}/tenant/config`, {
    headers: { authorization: token },
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
