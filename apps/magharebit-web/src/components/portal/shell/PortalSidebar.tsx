'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/brand/Logo';
import { usePortal } from './PortalProvider';
import { GROUP_ORDER, NAV, SHELL_COPY, type NavSlug } from './nav';
import type { Lang } from '@/components/landing/useLang';

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/**
 * Dark sidebar (design system: dark shell, light content). Used twice by PortalShell: docked on lg+ (full or
 * icon rail) and inside the mobile drawer. `rail` shows icons only; labels stay available as accessible names.
 */
export default function PortalSidebar({
  lang,
  locale,
  rail = false,
  onToggleRail,
  onNavigate,
}: {
  lang: Lang;
  locale: string;
  rail?: boolean;
  onToggleRail?: () => void;
  onNavigate?: () => void;
}) {
  const c = SHELL_COPY[lang];
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { me } = usePortal();
  const isRTL = lang === 'ar';

  const logout = () => {
    fetch('/api/portal/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(() => { /* leave anyway: the cookie expires on its own */ })
      .finally(() => router.push(`/${locale}/portal/login`));
  };

  const initial = me?.storeName?.trim().charAt(0) || 'M';

  return (
    <div className={`flex h-full flex-col bg-brand-950 text-white ${rail ? 'w-[72px]' : 'w-[264px]'} transition-[width] duration-200 ease-out motion-reduce:transition-none`}>
      {/* Brand */}
      <div className={`flex h-16 shrink-0 items-center border-b border-white/[0.07] ${rail ? 'justify-center px-2' : 'px-5'}`}>
        {rail ? (
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-gold-400 to-[#D99A12] text-sm font-extrabold text-brand-950">M</span>
        ) : (
          <Logo height={28} on="dark" variant="horizontal" />
        )}
      </div>

      {/* Store card */}
      <div className={`shrink-0 ${rail ? 'px-2 py-4' : 'px-4 py-4'}`}>
        <div className={`flex items-center gap-3 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.07] ${rail ? 'justify-center p-1.5' : 'p-3'}`} title={rail ? me?.storeName : undefined}>
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-base font-bold text-brand-950 ring-1 ring-gold-400/40">
            {me?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={me.logoUrl} alt="" className="h-full w-full object-contain" />
              : <span className={isRTL ? 'font-arabic' : ''}>{initial}</span>}
          </span>
          {!rail && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white" data-testid="shell-store-name">{me?.storeName || '…'}</span>
              <span className="mt-1 flex items-center gap-2">
                <span className="rounded-full bg-gold-400 px-2 py-[1px] text-[11px] font-bold text-brand-950">{me?.isTrial ? c.trial : (me?.plan ?? 'Starter')}</span>
                {me?.daysRemaining != null && <span className="truncate text-[11px] text-white/50">{c.daysLeft(me.daysRemaining)}</span>}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label={c.portal} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {GROUP_ORDER.map((g) => (
          <div key={g} className="mb-4">
            {rail ? (
              <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 bg-white/10" />
            ) : (
              <p className={`mb-1.5 px-3 text-[11px] font-semibold text-white/40 ${isRTL ? '' : 'uppercase tracking-[0.08em]'}`}>{c.groups[g]}</p>
            )}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const href = `/${locale}/portal/${n.slug}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const badge = n.slug === 'products' && (me?.lowStockCount ?? 0) > 0 ? me!.lowStockCount : null;
                const label = c.nav[n.slug as NavSlug];
                return (
                  <li key={n.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      aria-label={rail ? label : undefined}
                      title={rail ? label : undefined}
                      className={`group relative flex min-h-[44px] items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-400 ${rail ? 'justify-center px-0' : 'px-3'} ${
                        active ? 'bg-white/[0.09] text-white' : 'text-white/65 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {/* start-edge indicator (right in Arabic, left in French/English) */}
                      <span aria-hidden="true" className={`absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-gold-400 transition-opacity duration-150 ${active ? 'opacity-100' : 'opacity-0'}`} />
                      <Icon d={n.icon} className={active ? 'text-gold-400' : 'text-white/55 group-hover:text-white/85'} />
                      {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
                      {badge != null && (
                        <span className={`grid min-w-[20px] place-items-center rounded-full bg-[#D32F2F] px-1.5 text-[11px] font-bold leading-5 text-white ${rail ? 'absolute end-1.5 top-1.5' : ''}`}>{badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: collapse + sign out */}
      <div className={`shrink-0 space-y-1 border-t border-white/[0.07] p-3 ${rail ? 'flex flex-col items-center' : ''}`}>
        {onToggleRail && (
          <button
            type="button"
            onClick={onToggleRail}
            aria-label={rail ? c.expand : c.collapse}
            title={rail ? c.expand : c.collapse}
            className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 ${rail ? 'justify-center' : 'px-3'}`}
          >
            <Icon d={rail ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} className="rtl:-scale-x-100" />
            {!rail && <span>{c.collapse}</span>}
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          aria-label={rail ? c.logout : undefined}
          title={rail ? c.logout : undefined}
          className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg text-sm text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 ${rail ? 'justify-center' : 'px-3'}`}
        >
          <Icon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" className="rtl:-scale-x-100" />
          {!rail && <span>{c.logout}</span>}
        </button>
      </div>
    </div>
  );
}
