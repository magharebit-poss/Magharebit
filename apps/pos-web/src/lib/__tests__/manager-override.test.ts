import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestManagerOverride } from '../manager-override';

const reply = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The actions the existing callers pass to ManagerPinModal, plus the two void flows.
const CALLERS = [
  { action: 'discount_over_limit', who: 'DiscountModal and the POS page discount approval', note: 'Discount over limit' },
  { action: 'waste_over_threshold', who: 'waste page', note: 'Waste over threshold' },
  { action: 'card_approval_void', who: 'card void', note: 'card approval not saved: manager authorised close', referenceId: 'c-1' },
  { action: 'lana_payment_void', who: 'Lana void', note: 'lana payment not saved: manager authorised close', referenceId: 'c-2' },
] as const;

afterEach(() => vi.unstubAllGlobals());

describe('requestManagerOverride keeps working for every existing caller', () => {
  it.each(CALLERS)('$who ($action): same endpoint, method and body keys', async (c) => {
    const send = vi.fn().mockResolvedValue(reply(200, { authorized: true, manager_id: 'm-1', action: c.action }));
    const ref = 'referenceId' in c ? { referenceId: c.referenceId } : {};
    const out = await requestManagerOverride({ pin: '1234', action: c.action, note: c.note, ...ref }, send);

    expect(out).toEqual({ ok: true, result: { authorized: true, manager_id: 'm-1', action: c.action } });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/auth/manager-override');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ managerPin: '1234', action: c.action, note: c.note, ...ref });
  });

  it('a wrong PIN returns the server message when there is one, otherwise null (the modal then shows its own text)', async () => {
    const withMessage = vi.fn().mockResolvedValue(reply(401, { error: 'invalid_manager_pin', message: 'رمز PIN غير صحيح أو غير مخول' }));
    expect(await requestManagerOverride({ pin: '0000', action: 'discount_over_limit' }, withMessage))
      .toEqual({ ok: false, message: 'رمز PIN غير صحيح أو غير مخول' });
    const without = vi.fn().mockResolvedValue(reply(429, { error: 'rate_limited' }));
    expect(await requestManagerOverride({ pin: '0000', action: 'discount_over_limit' }, without))
      .toEqual({ ok: false, message: null });
  });

  it('a 200 that is not an authorisation is not accepted', async () => {
    const send = vi.fn().mockResolvedValue(reply(200, { something: 'else' }));
    expect(await requestManagerOverride({ pin: '1234', action: 'waste_over_threshold' }, send)).toEqual({ ok: false, message: null });
  });

  it('a network failure or an unreadable reply rejects, so the modal shows its connection error', async () => {
    await expect(requestManagerOverride({ pin: '1234', action: 'a' }, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).rejects.toThrow();
    const html = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(requestManagerOverride({ pin: '1234', action: 'a' }, html)).rejects.toThrow();
  });
});

describe('through the real apiFetch', () => {
  const stubBrowser = (opts: { token: string | null; tauri: boolean }) => {
    const win: Record<string, unknown> = opts.tauri ? { __TAURI_INTERNALS__: {} } : {};
    vi.stubGlobal('window', win);
    vi.stubGlobal('sessionStorage', { getItem: () => opts.token });
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { authorized: true, manager_id: 'm-1', action: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('browser: relative /api URL through the Next proxy, with the shift token attached', async () => {
    const fetchMock = stubBrowser({ token: 'shift-token', tauri: false });
    const out = await requestManagerOverride({ pin: '1234', action: 'discount_over_limit' });
    expect(out.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('/api/auth/manager-override');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer shift-token');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('Tauri/Android: goes straight to the backend, not to a relative /api URL that does not exist there', async () => {
    const fetchMock = stubBrowser({ token: 'shift-token', tauri: true });
    await requestManagerOverride({ pin: '1234', action: 'card_approval_void', referenceId: 'c-1' });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url.startsWith('/')).toBe(false);
    expect(url.endsWith('/auth/manager-override')).toBe(true);
    expect(url.includes('/api/')).toBe(false);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer shift-token');
  });

  it('no shift token: no network call, and the result is a rejection (the modal shows its invalid-PIN text)', async () => {
    const fetchMock = stubBrowser({ token: null, tauri: false });
    expect(await requestManagerOverride({ pin: '1234', action: 'discount_over_limit' })).toEqual({ ok: false, message: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
