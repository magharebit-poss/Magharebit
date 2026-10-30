'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationsDrawer from '@/components/portal/NotificationsDrawer';
import PortalProvider, { usePortal, type NetState } from './PortalProvider';
import PortalSidebar from './PortalSidebar';
import { NAV, SHELL_COPY } from './nav';
import type { Lang } from '@/components/landing/useLang';

/**
 * Merchant portal app shell: dark sidebar + light content (design system), RTL from the URL locale.
 *   ≥1280 px  full sidebar (264 px) · 1024–1279 px icon rail (72 px) by default · <1024 px drawer (native <dialog>:
 *   focus trap, Escape, focus returns to the menu button) sliding from the inline-start edge.
 * Page bodies are still Arabic-only (D1: translated in later phases), so they keep dir="rtl" inside the shell.
 */

const RAIL_KEY = 'mgh-portal-rail';
const RAIL_EVENT = 'mgh:portal-rail';
const LOCALES = ['ar', 'fr', 'en'] as const;
const NARROW = '(max-width: 1279px)';

// Browser state read through useSyncExternalStore (no setState in effects, no hydration mismatch)
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
function isNarrow() { return window.matchMedia(NARROW).matches; }
function subscribeRail(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(RAIL_EVENT, cb);
  return () => { window.removeEventListener('storage', cb); window.removeEventListener(RAIL_EVENT, cb); };
}
function readRail(): string | null {
  try { const v = localStorage.getItem(RAIL_KEY); return v === '1' || v === '0' ? v : null; } catch { return null; }
}
function writeRail(v: '0' | '1') {
  try { localStorage.setItem(RAIL_KEY, v); } catch { /* storage blocked: the choice lasts for this page only */ }
  window.dispatchEvent(new Event(RAIL_EVENT));
}

function langOf(locale: string): Lang {
  return locale === 'ar' || locale === 'fr' ? locale : 'en';
}

export default function PortalShell({ locale, children }: { locale: string; children: ReactNode }) {
  const lang = langOf(locale);
  const c = SHELL_COPY[lang];
  return (
    <PortalProvider locale={locale} messages={{ offlineWrite: c.toast.offlineWrite, sessionExpired: c.toast.sessionExpired }}>
      <ShellFrame locale={locale} lang={lang}>{children}</ShellFrame>
    </PortalProvider>
  );
}

function ShellFrame({ locale, lang, children }: { locale: string; lang: Lang; children: ReactNode }) {
  const c = SHELL_COPY[lang];
  const isRTL = lang === 'ar';
  const pathname = usePathname() ?? '';
  const { net, me } = usePortal();

  // Icon rail: the merchant's remembered choice, else automatic (rail below 1280 px)
  const narrowDesktop = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const railPref = useSyncExternalStore(subscribeRail, readRail, () => null);
  const rail = railPref === null ? narrowDesktop : railPref === '1';
  const toggleRail = () => writeRail(rail ? '0' : '1');

  // Mobile drawer
  const drawer = useRef<HTMLDialogElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const openDrawer = () => drawer.current?.showModal();
  const closeDrawer = () => drawer.current?.close();

  // Navigation progress (thin gold bar between a click and the new page)
  const [navigating, setNavigating] = useState(false);
  // Route changed: stop the bar (setState-during-render pattern, as in Navbar; the drawer closes via onNavigate)
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setNavigating(false);
  }
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin === location.origin && url.pathname !== location.pathname && url.pathname.includes('/portal/')) setNavigating(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const current = NAV.find((n) => pathname.includes(`/portal/${n.slug}`));
  const title = current ? c.nav[current.slug] : c.portal;
  const switchTo = (l: string) => pathname.replace(/^\/(ar|fr|en)(?=\/|$)/, `/${l}`);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} lang={lang} className={`${isRTL ? 'font-arabic' : 'font-sans'} min-h-screen bg-[#F8F9FA] text-[#111827]`}>
      <a href="#main-content" className="sr-only z-[80] rounded-md bg-gold-400 px-4 py-2 font-semibold text-brand-950 focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {c.skip}
      </a>

      {/* progress bar */}
      <div aria-hidden="true" className={`fixed inset-x-0 top-0 z-[70] h-[3px] origin-[0%_50%] bg-gold-400 transition-[transform,opacity] duration-500 ease-out rtl:origin-[100%_50%] motion-reduce:transition-none ${navigating ? 'scale-x-[0.85] opacity-100' : 'scale-x-0 opacity-0'}`} />

      <div className="flex min-h-screen">
        {/* docked sidebar (lg+) */}
        <aside className="sticky top-0 hidden h-screen shrink-0 lg:block" data-testid="shell-sidebar" data-rail={rail ? '1' : '0'}>
          <PortalSidebar lang={lang} locale={locale} rail={rail} onToggleRail={toggleRail} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* header */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#E5E7EB] bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <button
              ref={menuBtn}
              type="button"
              onClick={openDrawer}
              aria-label={c.menu}
              aria-haspopup="dialog"
              data-testid="shell-menu"
              className="grid h-11 w-11 place-items-center rounded-lg text-[#374151] transition-colors hover:bg-[#F3F4F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] lg:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-[#111827]" data-testid="shell-title">{title}</h1>

            <StatusPill net={net} labels={c.status} />

            <nav aria-label={c.language} className="hidden items-center rounded-full bg-[#F3F4F6] p-1 sm:flex">
              {LOCALES.map((l) => (
                <Link
                  key={l}
                  href={switchTo(l)}
                  hrefLang={l}
                  aria-current={l === locale ? 'true' : undefined}
                  className={`min-w-[40px] rounded-full px-2.5 py-1 text-center text-xs font-bold transition-colors ${l === locale ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label={c.notifications}
              className="relative grid h-11 w-11 place-items-center rounded-lg text-[#374151] transition-colors hover:bg-[#F3F4F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0" /></svg>
              {(me?.lowStockCount ?? 0) > 0 && !notifRead && <span aria-hidden="true" className="absolute end-2.5 top-2.5 h-2 w-2 rounded-full bg-[#D32F2F] ring-2 ring-white" />}
            </button>
          </header>

          {/* offline / server banner: persistent, not dismissible, warning colour (not red) */}
          {(net === 'offline' || net === 'degraded') && (
            <div role="status" data-testid="shell-banner" className="sticky top-16 z-20 flex items-start gap-3 border-b border-[#F0B429]/60 bg-[#FFF8E1] px-4 py-2.5 text-sm font-medium text-[#7A5600] sm:px-6 lg:px-8">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-[#B8860B]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {net === 'offline' ? <path d="M2 8.8a15 15 0 0 1 4.2-2.8M10 5.1A15 15 0 0 1 22 8.8M5 12.5a10 10 0 0 1 3-2M12.6 9.5a10 10 0 0 1 6.4 3M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18" /> : <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />}
              </svg>
              <span>{net === 'offline' ? c.banner.offline : c.banner.degraded}</span>
            </div>
          )}

          {/* Page bodies are Arabic-only until their own phase: they keep RTL regardless of the shell language */}
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
            <div dir="rtl" lang="ar" className="font-arabic">{children}</div>
          </main>
        </div>
      </div>

      {/* mobile drawer */}
      <dialog
        ref={drawer}
        aria-label={c.portal}
        data-testid="shell-drawer"
        onClick={(e) => { if (e.target === drawer.current) closeDrawer(); }}
        onClose={() => menuBtn.current?.focus()}
        className={`portal-drawer fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-none w-auto max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px] ${isRTL ? 'portal-drawer--rtl' : ''}`}
      >
        <div className="relative h-full shadow-2xl">
          <PortalSidebar lang={lang} locale={locale} onNavigate={closeDrawer} />
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={c.closeMenu}
            className="absolute end-2 top-3 grid h-10 w-10 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </dialog>

      <NotificationsDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} onReadAll={() => setNotifRead(true)} />
      <Toaster closeLabel={c.toast.close} />
    </div>
  );
}

function StatusPill({ net, labels }: { net: NetState; labels: Record<NetState, string> }) {
  const tone: Record<NetState, string> = {
    online: 'bg-[#ECFDF3] text-[#166534] ring-[#BBF7D0]',
    reconnecting: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/40',
    offline: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/50',
    degraded: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/50',
  };
  const dot: Record<NetState, string> = {
    online: 'bg-[#22C55E]',
    reconnecting: 'bg-[#F0B429] animate-pulse',
    offline: 'bg-[#B8860B]',
    degraded: 'bg-[#B8860B]',
  };
  return (
    <span role="status" aria-live="polite" data-testid="shell-status" data-state={net} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors duration-200 ${tone[net]}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot[net]}`} />
      <span className="hidden sm:inline">{labels[net]}</span>
      <span className="sr-only sm:hidden">{labels[net]}</span>
    </span>
  );
}

function Toaster({ closeLabel }: { closeLabel: string }) {
  const { toasts, dismiss } = usePortal();
  return (
    // Bottom centre: the corners belong to the floating WhatsApp support button (inline end) and the page.
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] mx-auto flex w-[min(440px,calc(100vw-2rem))] flex-col gap-2" data-testid="shell-toasts">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`portal-toast pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_12px_32px_rgba(17,24,39,0.18)] ${
            t.kind === 'success' ? 'border-[#BBF7D0] bg-white text-[#166534]' : t.kind === 'error' ? 'border-[#FECACA] bg-white text-[#991B1B]' : 'border-[#F0B429]/60 bg-[#FFF8E1] text-[#7A5600]'
          }`}
        >
          <span className="flex-1 leading-relaxed">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label={closeLabel} className="-me-1 grid h-7 w-7 shrink-0 place-items-center rounded-md opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
