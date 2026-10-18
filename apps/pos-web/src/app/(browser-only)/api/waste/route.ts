import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('shiftId');
  if (!shiftId) {
    return Response.json({ error: 'shiftId query param required' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${API}/waste?shiftId=${encodeURIComponent(shiftId)}`,
      { cache: 'no-store', headers: forwardHeaders(request) },
    );
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${API}/waste`, {
      method: 'POST',
      headers: forwardHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
