import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!tenantId) {
    return Response.json({ error: 'tenantId required' }, { status: 400 });
  }
  const params = new URLSearchParams({ tenantId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  try {
    const res = await fetch(`${API}/analytics/summary?${params.toString()}`, {
      cache: 'no-store',
      headers: forwardHeaders(request),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
