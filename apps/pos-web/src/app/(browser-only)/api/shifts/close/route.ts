import { forwardHeaders } from '@/lib/proxy';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

interface CloseBody {
  shiftId: string;
  closingFloat: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CloseBody>;
    if (!body.shiftId || typeof body.closingFloat !== 'number') {
      return Response.json(
        { error: 'shiftId and closingFloat (piastres) required' },
        { status: 400 },
      );
    }
    const res = await fetch(
      `${API}/shifts/${encodeURIComponent(body.shiftId)}/close`,
      {
        method: 'POST',
        headers: forwardHeaders(request, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ closingFloat: body.closingFloat }),
      },
    );
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
