import { NextRequest, NextResponse } from 'next/server';
const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization') ?? '';
  const res = await fetch(`${API}/branches/transfers`, { headers: { authorization: token } });
  return NextResponse.json(await res.json(), { status: res.status });
}
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization') ?? '';
  const body = await req.json();
  const res = await fetch(`${API}/branches/transfers`, {
    method: 'POST',
    headers: { authorization: token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
