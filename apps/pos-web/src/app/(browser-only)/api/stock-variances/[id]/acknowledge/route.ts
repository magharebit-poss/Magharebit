import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// PATCH /api/stock-variances/:id/acknowledge
// No body is forwarded: the backend takes the acknowledging person from the bearer token only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const res = await fetch(`${API}/stock-variances/${encodeURIComponent(id)}/acknowledge`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: forwardHeaders(request),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
