const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// Public, pre-auth bootstrap list for the login screen. No token exists yet,
// so no Authorization header is forwarded. The tenantId query param is required
// (the backend 400s without it) and is forwarded verbatim. Backend returns a
// minimal shape (staff_id, name_ar, name_fr, role) — never a PIN hash.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) {
    return Response.json({ error: 'tenantId query param required' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${API}/staff/login-options?tenantId=${encodeURIComponent(tenantId)}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
