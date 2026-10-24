import { type NextRequest, NextResponse } from 'next/server';

const API = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// GET /api/staff/assignable-roles: the roles the signed-in user may give to staff.
// The backend decides (services/staff-access.ts); the /staff page only mirrors it.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization') ?? '';
  try {
    const res = await fetch(`${API}/staff/assignable-roles`, {
      headers: { authorization: token },
      signal: AbortSignal.timeout(10_000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
