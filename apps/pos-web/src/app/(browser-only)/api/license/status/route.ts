const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// Public license status — no auth header needed. The UI polls this (even
// pre-login) to decide whether to show the license-error screen.
export async function GET() {
  try {
    const res = await fetch(`${API}/license/status`, { cache: 'no-store' });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
