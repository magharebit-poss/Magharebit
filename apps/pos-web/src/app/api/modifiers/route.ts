import { NextRequest, NextResponse } from 'next/server';
const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization') ?? '';
  const pid = req.nextUrl.searchParams.get('product_id') ?? '';
  const res = await fetch(`${API}/modifiers?product_id=${encodeURIComponent(pid)}`, {
    headers: { authorization: token },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
