import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

// POST — asks the backend to call Green API's getStateInstance. Sends no message.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  try {
    const res = await fetch(`${BACKEND_URL}/settings/integrations/test-green`, {
      method: 'POST',
      headers: auth ? { Authorization: auth } : {},
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }
}
