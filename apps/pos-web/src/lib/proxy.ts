// Server-side helper for the /api/* Next.js route handlers.
// Forwards the incoming client's Authorization header (Bearer JWT) to the
// backend so transport-layer auth is preserved across the proxy hop.

export function forwardHeaders(
  request: Request,
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}
