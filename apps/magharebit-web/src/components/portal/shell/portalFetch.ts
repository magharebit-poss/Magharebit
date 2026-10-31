/**
 * JSON calls to the portal API. Runs through the shell's fetch guard (PortalProvider), so an offline write is refused
 * with a toast and a 401 sends the merchant to the login; callers only handle the result.
 *
 *   const r = await portalJson<{ products: Product[] }>('/api/portal/products?page=1')
 *   if (r.ok) use(r.data); else show(r.error)   // r.error: the API's error code, 'offline' or 'network'
 */

export type PortalResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function portalJson<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<PortalResult<T>> {
  const { json, headers, ...rest } = init;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) return { ok: false, status: res.status, error: typeof body.error === 'string' ? body.error : `http_${res.status}` };
    return { ok: true, status: res.status, data: body as T };
  } catch (e) {
    return { ok: false, status: 0, error: (e as { name?: string })?.name === 'OfflineWriteError' ? 'offline' : 'network' };
  }
}
