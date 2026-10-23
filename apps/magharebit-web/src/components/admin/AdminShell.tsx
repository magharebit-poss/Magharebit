'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import Logo from '@/components/brand/Logo';

export type AdminRole = 'owner' | 'operator' | 'viewer';
export interface AdminActorInfo {
  name: string;
  role: AdminRole;
  email?: string;
}

type Lang = 'ar' | 'fr' | 'en';

const COPY: Record<Lang, {
  title: string; username: string; usernameHint: string; password: string; signIn: string; signOut: string;
  errBad: string; errLimit: string; errConfig: string; errNet: string; loading: string;
  nav: { merchants: string; licenses: string; leads: string; coupons: string; notifications: string; audit: string; admins: string };
  roles: Record<AdminRole, string>; menu: string; darkMode: string;
}> = {
  ar: {
    title: 'لوحة الإدارة', username: 'اسم المستخدم', usernameHint: 'اتركه فارغاً لحساب المالك',
    password: 'كلمة المرور', signIn: 'دخول', signOut: 'خروج',
    errBad: 'بيانات الدخول غير صحيحة', errLimit: 'محاولات كثيرة، حاول لاحقاً',
    errConfig: 'لوحة الإدارة غير مهيأة على الخادم', errNet: 'تعذّر الاتصال بالخادم', loading: 'جارٍ التحميل…',
    nav: { merchants: 'التجار', licenses: 'التراخيص', leads: 'العملاء المحتملون', coupons: 'القسائم', notifications: 'الإشعارات', audit: 'سجل التدقيق', admins: 'المسؤولون' },
    roles: { owner: 'مالك', operator: 'مشغّل', viewer: 'مشاهد' }, menu: 'القائمة', darkMode: 'الوضع الداكن',
  },
  fr: {
    title: 'Console d’administration', username: 'Identifiant', usernameHint: 'Laisser vide pour le compte propriétaire',
    password: 'Mot de passe', signIn: 'Se connecter', signOut: 'Déconnexion',
    errBad: 'Identifiants incorrects', errLimit: 'Trop de tentatives, réessayez plus tard',
    errConfig: 'Console non configurée sur le serveur', errNet: 'Serveur injoignable', loading: 'Chargement…',
    nav: { merchants: 'Commerçants', licenses: 'Licences', leads: 'Prospects', coupons: 'Coupons', notifications: 'Notifications', audit: 'Journal d’audit', admins: 'Administrateurs' },
    roles: { owner: 'Propriétaire', operator: 'Opérateur', viewer: 'Lecteur' }, menu: 'Menu', darkMode: 'Mode sombre',
  },
  en: {
    title: 'Admin console', username: 'Username', usernameHint: 'Leave empty for the owner account',
    password: 'Password', signIn: 'Sign in', signOut: 'Sign out',
    errBad: 'Incorrect credentials', errLimit: 'Too many attempts, try again later',
    errConfig: 'Console is not configured on the server', errNet: 'Cannot reach the server', loading: 'Loading…',
    nav: { merchants: 'Merchants', licenses: 'Licenses', leads: 'Leads', coupons: 'Coupons', notifications: 'Notifications', audit: 'Audit log', admins: 'Admins' },
    roles: { owner: 'Owner', operator: 'Operator', viewer: 'Viewer' }, menu: 'Menu', darkMode: 'Dark mode',
  },
};

type Theme = 'light' | 'dark';
const THEME_KEY = 'mgh-admin-theme';
function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // storage blocked: fall back to the default
  }
}

interface AdminCtx { actor: AdminActorInfo; lang: Lang; isRTL: boolean; locale: string }
const Ctx = createContext<AdminCtx | null>(null);
/** Session actor + language for pages rendered inside <AdminShell>. */
export function useAdmin(): AdminCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdmin must be used inside <AdminShell>');
  return v;
}

const INPUT =
  'w-full min-h-[44px] rounded-[4px] border border-[#E0E0E0] bg-white px-3 text-[15px] text-[#111827] ' +
  'focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/40';

export default function AdminShell({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const lang: Lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  const isRTL = lang === 'ar';
  const c = COPY[lang];
  const pathname = usePathname();

  const [actor, setActor] = useState<AdminActorInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Read once on the client; the first render is the neutral loading screen, so this cannot mismatch.
  const [theme, setTheme] = useState<Theme>(readTheme);
  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* not persisted: still applies for this visit */
    }
  }

  // Restore an existing session (HttpOnly cookie) after a reload.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/session')
      .then(async (r) => (r.ok ? ((await r.json()).actor as AdminActorInfo) : null))
      .catch(() => null)
      .then((a) => {
        if (cancelled) return;
        setActor(a);
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function signIn() {
    setError('');
    setBusy(true);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(username.trim() ? { username: username.trim() } : {}), password }),
      });
      if (r.ok) {
        setPassword('');
        setActor((await r.json()).actor as AdminActorInfo);
      } else if (r.status === 429) setError(c.errLimit);
      else if (r.status === 503) setError(c.errConfig);
      else setError(c.errBad);
    } catch {
      setError(c.errNet);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setActor(null);
  }

  const font = isRTL ? 'font-arabic' : 'font-sans';

  if (checking) {
    return <div className={`${font} flex min-h-screen items-center justify-center bg-[#F8F9FA] text-[#6B7280]`}>{c.loading}</div>;
  }

  // ── Sign-in (dark shell) ────────────────────────────────────────────────
  if (!actor) {
    return (
      <main dir={isRTL ? 'rtl' : 'ltr'} className={`${font} flex min-h-screen items-center justify-center bg-brand-950 px-4`}>
        <form
          onSubmit={(e) => { e.preventDefault(); void signIn(); }}
          className="w-full max-w-[380px] rounded-[8px] border border-brand-900 bg-brand-900/60 p-8 shadow-xl"
        >
          <div className="mb-6 flex justify-center"><Logo height={30} on="dark" variant="horizontal" priority /></div>
          <h1 className="mb-6 text-center text-xl font-bold text-white">{c.title}</h1>
          <label className="mb-1 block text-sm font-semibold text-white/80" htmlFor="adm-user">{c.username}</label>
          <input id="adm-user" className={`${INPUT} mb-1`} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <p className="mb-4 text-xs text-white/50">{c.usernameHint}</p>
          <label className="mb-1 block text-sm font-semibold text-white/80" htmlFor="adm-pass">{c.password}</label>
          <input id="adm-pass" type="password" className={`${INPUT} mb-3`} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p role="alert" className="mb-3 text-sm text-[#FCA5A5]">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="min-h-[48px] w-full rounded-[4px] bg-gold-400 font-bold text-brand-950 transition-opacity disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {c.signIn}
          </button>
        </form>
      </main>
    );
  }

  // ── Console (dark sidebar, light content) ───────────────────────────────
  const links: { href: string; label: string; show: boolean }[] = [
    { href: `/${locale}/admin/merchants`, label: c.nav.merchants, show: true },
    { href: `/${locale}/admin/licenses`, label: c.nav.licenses, show: true },
    { href: `/${locale}/admin/leads`, label: c.nav.leads, show: true },
    { href: `/${locale}/admin/coupons`, label: c.nav.coupons, show: true },
    { href: `/${locale}/admin/notifications`, label: c.nav.notifications, show: true },
    { href: `/${locale}/admin/audit-log`, label: c.nav.audit, show: true },
    { href: `/${locale}/admin/admins`, label: c.nav.admins, show: actor.role === 'owner' },
  ];

  const nav = (
    <nav aria-label={c.title} className="flex flex-col gap-1 p-3">
      {links.filter((l) => l.show).map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] items-center rounded-[4px] px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 ${
              active ? 'bg-gold-400 text-brand-950' : 'text-white/80 hover:bg-brand-900 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <Ctx.Provider value={{ actor, lang, isRTL, locale }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={`${font} min-h-screen bg-[var(--adm-bg)] md:flex admin-theme`} data-theme={theme}>
        {/* Sidebar: static on md+, drawer below */}
        <aside className={`${menuOpen ? 'block' : 'hidden'} border-b border-brand-900 bg-brand-950 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:w-[240px] md:shrink-0 md:border-b-0 md:border-e`}>
          <div className="hidden items-center px-4 py-5 md:flex"><Logo height={26} on="dark" variant="horizontal" /></div>
          {nav}
          <div className="mt-auto border-t border-brand-900 p-3">
            <button
              type="button"
              role="switch"
              aria-checked={theme === 'dark'}
              onClick={toggleTheme}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[4px] px-3 text-sm font-semibold text-white/80 transition-colors hover:bg-brand-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
            >
              <span>{theme === 'dark' ? '☾' : '☀'} {c.darkMode}</span>
              <span aria-hidden="true" className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${theme === 'dark' ? 'bg-gold-400' : 'bg-white/25'}`}>
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                  style={{ insetInlineStart: theme === 'dark' ? 22 : 2 }}
                />
              </span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex min-h-[56px] items-center justify-between gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                className="min-h-[44px] min-w-[44px] rounded-[4px] border border-[var(--adm-border)] px-3 text-sm font-semibold text-[var(--adm-text)] md:hidden"
              >
                {c.menu}
              </button>
              <span className="text-sm font-semibold text-[var(--adm-text)] md:hidden">{c.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-end leading-tight">
                <div dir="auto" className="text-sm font-semibold text-[var(--adm-text)]">{actor.name}</div>
                <div className="text-xs text-[var(--adm-muted)]">{actor.email ? `${actor.email} · ` : ''}{c.roles[actor.role]}</div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="min-h-[44px] rounded-[4px] border border-[var(--adm-border)] px-3 text-sm font-semibold text-[var(--adm-text)] hover:border-[var(--adm-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
              >
                {c.signOut}
              </button>
            </div>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
