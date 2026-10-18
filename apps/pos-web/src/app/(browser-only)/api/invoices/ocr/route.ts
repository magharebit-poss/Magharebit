import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

// POST /api/invoices/ocr — supplier invoice OCR (MANAGER/SUPERVISOR).
// Forward the raw multipart body with its original Content-Type (including the
// boundary). Do NOT parse/re-serialize — that would destroy the image part.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const contentType = req.headers.get('content-type') ?? '';
  try {
    const body = await req.arrayBuffer();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    if (auth) headers['Authorization'] = auth;

    const res = await fetch(`${BACKEND_URL}/invoices/ocr`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const resBody = await res.text();
    return new NextResponse(resBody, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'upstream error' },
      { status: 502 },
    );
  }
}
