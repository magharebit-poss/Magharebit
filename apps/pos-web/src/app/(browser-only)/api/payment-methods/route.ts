import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const res = await fetch(`${API}/payment-methods`, {
      cache: 'no-store',
      headers: forwardHeaders(request),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
