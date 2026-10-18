/**
 * Native API client for Capacitor APK.
 * When running as a native Android app, API calls go directly to the backend
 * instead of through Next.js proxy routes (which don't exist in a static export).
 */

const NATIVE_API_URL =
  process.env['NEXT_PUBLIC_NATIVE_API_URL'] ??
  process.env['NEXT_PUBLIC_BACKEND_URL'] ??
  process.env['NEXT_PUBLIC_API_URL'] ??
  'http://localhost:3001';

export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    process.env['NEXT_PUBLIC_IS_NATIVE'] === 'true' ||
    window.location.protocol === 'capacitor:' ||
    (window as unknown as Record<string, unknown>)['Capacitor'] !== undefined
  );
}

export function apiUrl(path: string): string {
  if (isNative()) {
    return `${NATIVE_API_URL}${path}`;
  }
  return `/api${path}`;
}

/**
 * Fetch wrapper that handles native vs web routing.
 *
 * Usage: nativeFetch('/customers?q=م', { headers: { authorization: 'Bearer ...' } })
 * In web:    → calls /api/customers?q=م  (Next.js proxy)
 * In native: → calls http://backend:3001/customers?q=م  (direct)
 */
export async function nativeFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), init);
}
