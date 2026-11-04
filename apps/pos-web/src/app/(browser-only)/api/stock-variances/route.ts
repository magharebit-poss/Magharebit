import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// GET /api/stock-variances?acknowledged=&product=&from=&to=&limit=&offset=
// The tenant comes from the bearer token on the backend; the query string is passed through untouched.
export async function GET(request: Request) {
  try {
    const res = await fetch(`${API}/stock-variances${new URL(request.url).search}`, {
      cache: 'no-store',
      headers: forwardHeaders(request),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
