'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { STORE_LOGO_EVENT } from '@/lib/store-logo';

/**
 * Portal data + network state, shared by the shell and the pages.
 *
 * - The merchant (`/api/portal/auth/me`) is fetched once and refreshed on focus and on reconnect.
 * - Connectivity: navigator.onLine plus a light heartbeat to /api/health (navigator.onLine says "online" on a dead
 *   Wi-Fi). States: online | reconnecting | offline | degraded (server answers 503 = database down).
 * - Fetch guard, installed while the shell is mounted, for /api/portal/* only:
 *     · a write (non-GET) while offline is refused at once with a toast (D2: read-only while offline, no queue:
 *       queuing offline writes is the POS's job under LAW 1/3, not the portal's);
 *     · any 401 turns into one "session expired" toast and a redirect to the portal login.
 *   It lets the existing pages get this behaviour without rewriting their fetch calls; it is removed on unmount.
 */

export type NetState = 'online' | 'reconnecting' | 'offline' | 'degraded';

export interface PortalMe {
  merchantId: string;
  storeName: string;
  logoUrl: string | null;
  plan: string | null;
  daysRemaining: number | null;
  isTrial: boolean;
  lowStockCount: number;
}

export interface Toast { id: number; kind: 'warning' | 'error' | 'success'; text: string }

interface PortalCtx {
  me: PortalMe | null;
  net: NetState;
  refreshMe: () => void;
  toasts: Toast[];
  toast: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<PortalCtx | null>(null);

export function usePortal(): PortalCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePortal() must be used inside <PortalProvider>');
  return c;
}

const HEARTBEAT_MS = 30_000;
const PROBE_TIMEOUT_MS = 10_000;
const TOAST_MS = 5_000;

/** Error thrown by the guard for an offline write (pages that catch fetch errors see it as a normal failure). */
export class OfflineWriteError extends Error {
  constructor() { super('offline_write_blocked'); this.name = 'OfflineWriteError'; }
}

export default function PortalProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: { offlineWrite: string; sessionExpired: string };
  children: ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [net, setNet] = useState<NetState>('online');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const netRef = useRef<NetState>('online');
  const expiredRef = useRef(false);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, kind, text }].slice(-3));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  const setNetState = useCallback((s: NetState) => { netRef.current = s; setNet(s); }, []);

  // ── merchant ───────────────────────────────────────────────────────────────
  const refreshMe = useCallback(() => {
    fetch('/api/portal/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return; // 401 is handled by the guard below
        const d = await res.json() as Partial<PortalMe>;
        setMe({
          merchantId: d.merchantId ?? '',
          storeName: d.storeName ?? '',
          logoUrl: d.logoUrl ?? null,
          plan: d.plan ?? null,
          daysRemaining: d.daysRemaining ?? null,
          isTrial: d.isTrial ?? false,
          lowStockCount: d.lowStockCount ?? 0,
        });
      })
      .catch(() => { /* network state is tracked by the heartbeat */ });
  }, []);

  // ── connectivity ───────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // A network error means offline. A slow answer does not: one timeout keeps the current state, two in a row
    // mean the server is not answering (degraded), never "offline" (the merchant's own connection may be fine).
    let timeouts = 0;
    const probe = async () => {
      if (!navigator.onLine) { setNetState('offline'); return; }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
        if (cancelled) return;
        timeouts = 0;
        const was = netRef.current;
        setNetState(res.ok ? 'online' : 'degraded');
        if (res.ok && was !== 'online') refreshMe();
      } catch (e) {
        if (cancelled) return;
        if ((e as { name?: string })?.name === 'AbortError') {
          timeouts += 1;
          if (timeouts >= 2) setNetState('degraded');
        } else {
          setNetState('offline');
        }
      } finally {
        clearTimeout(t);
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => { if (document.visibilityState === 'visible') await probe(); schedule(); }, HEARTBEAT_MS);
    };
    const onOffline = () => setNetState('offline');
    const onOnline = () => { setNetState('reconnecting'); void probe(); };
    const onVisible = () => { if (document.visibilityState === 'visible') { void probe(); refreshMe(); } };

    void probe(); // first check right away (also catches "offline at load")
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    refreshMe();
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshMe, setNetState]);

  // The settings page fires this after a logo upload/removal: refresh the sidebar's store card
  useEffect(() => {
    window.addEventListener(STORE_LOGO_EVENT, refreshMe);
    return () => window.removeEventListener(STORE_LOGO_EVENT, refreshMe);
  }, [refreshMe]);

  // ── fetch guard (portal API only) ──────────────────────────────────────────
  useEffect(() => {
    const original = window.fetch;
    const guarded: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      if (!path.startsWith('/api/portal/')) return original(input, init);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const isWrite = method !== 'GET' && method !== 'HEAD';
      const offline = netRef.current === 'offline' || !navigator.onLine;
      if (isWrite && offline && !path.startsWith('/api/portal/auth/logout')) {
        toast('warning', messages.offlineWrite);
        throw new OfflineWriteError();
      }
      let res: Response;
      try {
        res = await original(input, init);
      } catch (e) {
        if (isWrite) { setNetState('offline'); toast('warning', messages.offlineWrite); }
        throw e;
      }
      if (res.status === 401 && !path.startsWith('/api/portal/auth/login') && !expiredRef.current) {
        expiredRef.current = true;
        toast('error', messages.sessionExpired);
        setTimeout(() => router.push(`/${locale}/portal/login?expired=1`), 1200);
      }
      return res;
    };
    window.fetch = guarded;
    return () => { if (window.fetch === guarded) window.fetch = original; };
  }, [locale, messages.offlineWrite, messages.sessionExpired, router, setNetState, toast]);

  return <Ctx.Provider value={{ me, net, refreshMe, toasts, toast, dismiss }}>{children}</Ctx.Provider>;
}
