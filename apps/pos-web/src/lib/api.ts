// Centralized client→proxy fetch helper.
// Attaches the shift JWT (stored in sessionStorage at login) as a Bearer token
// on every call to /api/*. Use this instead of bare fetch() for backend calls.

export const TOKEN_KEY = 'greengo_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // sessionStorage first (current tab); fall back to localStorage so the KDS
  // page on a separate tab (kitchen tablet) can pick up the shift token.
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_KEY, token);
  // Mirror to localStorage so other tabs (e.g. KDS screen) can read the token.
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage quota */ }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage quota */ }
}

// True when running inside the Tauri desktop shell (webview), false in a browser.
const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Backend base URL used ONLY in the Tauri context (direct calls, no Next proxy).
const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

/**
 * Resolve a request path to the correct target for the current runtime:
 *  - Tauri  → call the Fastify backend directly (strip the `/api` prefix).
 *  - Browser/dev → call the Next.js proxy route (`/api/*`) unchanged.
 */
const resolveUrl = (path: string): string => {
  if (isTauri()) {
    const backendPath = path.replace(/^\/api/, '');
    return `${BACKEND_URL}${backendPath}`;
  }
  return path;
};

/**
 * fetch wrapper that injects `Authorization: Bearer <token>` when a token is
 * present. Preserves any headers/body passed in `init`. Routes to the
 * Next.js proxy in the browser and directly to the backend inside Tauri.
 *
 * Pass `skipAuth: true` for the two pre-auth public routes:
 *   /api/staff/login-options  (cashier picker, no token exists yet)
 *   /api/shifts/open          (PIN verify + token issuance, no token exists yet)
 * All other calls require a token and get a synthetic 401 if none is present.
 */
export function apiFetch(
  input: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<Response> {
  const { skipAuth, ...fetchInit } = init;
  const token = getToken();
  if (!token && !skipAuth) {
    // No token — return a synthetic 401 so callers handle it without a network round-trip.
    return Promise.resolve(
      new Response(JSON.stringify({ error: 'No auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  const headers = new Headers(fetchInit.headers ?? {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(resolveUrl(input), { ...fetchInit, headers });
}
