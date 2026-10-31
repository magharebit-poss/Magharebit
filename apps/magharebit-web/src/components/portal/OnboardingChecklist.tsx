'use client';

/**
 * Onboarding checklist. Completion comes from real data (GET /api/portal/onboarding) and is re-read when the tab
 * regains focus. Labels are translated here by step id (the API's own labels are Arabic-only).
 * Dismissal lasts for the browser session; the card disappears for good once every step is done.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '@/components/landing/useLang';
import { portalJson } from '@/components/portal/shell/portalFetch';
import { CARD } from '@/components/portal/PortalDialog';

interface Step { id: string; href: string; done: boolean }
interface Status { steps: Step[]; completedCount: number; totalCount: number; allDone: boolean }

type StepId = 'settings' | 'product' | 'employee' | 'whatsapp' | 'sale';

const COPY: Record<Lang, {
  title: string; progress: (d: number, t: number) => string; hide: string; done: string; doneSub: string; tip: string; tipCta: string;
  steps: Record<StepId, { label: string; desc: string }>;
}> = {
  fr: {
    title: 'Bien démarrer avec MAGHAREBIT', progress: (d, t) => `${d} sur ${t} terminées`, hide: 'Masquer la liste de démarrage',
    done: 'Bravo, votre boutique est prête !', doneSub: 'Toutes les étapes de démarrage sont terminées. Bonnes ventes !',
    tip: 'Activez WhatsApp pour recevoir chaque soir le rapport de ventes et les alertes de stock.', tipCta: 'Configurer',
    steps: {
      settings: { label: 'Compléter les informations de la boutique', desc: 'Nom et secteur de votre commerce' },
      product: { label: 'Ajouter un premier produit', desc: 'Créez votre catalogue' },
      employee: { label: 'Ajouter un employé', desc: 'Enregistrez votre équipe' },
      whatsapp: { label: 'Activer les notifications WhatsApp', desc: 'Numéro et rapport du soir' },
      sale: { label: 'Faire une première vente', desc: 'Encaissez depuis l’application de caisse' },
    },
  },
  ar: {
    title: 'ابدأ مع MAGHAREBIT', progress: (d, t) => `${d} من ${t} مكتملة`, hide: 'إخفاء قائمة البدء',
    done: 'أحسنت، متجرك جاهز!', doneSub: 'اكتملت جميع خطوات الإعداد. حظاً موفقاً في مبيعاتك!',
    tip: 'فعّل واتساب لتصلك كل مساء تقارير المبيعات وتنبيهات المخزون.', tipCta: 'إعداد الآن',
    steps: {
      settings: { label: 'أكمل بيانات متجرك', desc: 'اسم متجرك وقطاعه' },
      product: { label: 'أضف أول منتج', desc: 'أنشئ كتالوج منتجاتك' },
      employee: { label: 'أضف موظفاً', desc: 'سجّل فريق العمل' },
      whatsapp: { label: 'فعّل إشعارات واتساب', desc: 'الرقم وتقرير المساء' },
      sale: { label: 'أتمم أول عملية بيع', desc: 'من تطبيق الصندوق' },
    },
  },
  en: {
    title: 'Get started with MAGHAREBIT', progress: (d, t) => `${d} of ${t} done`, hide: 'Hide the getting-started list',
    done: 'Well done, your shop is ready!', doneSub: 'Every setup step is complete. Happy selling!',
    tip: 'Turn on WhatsApp to get the sales report and stock alerts every evening.', tipCta: 'Set up',
    steps: {
      settings: { label: 'Complete your shop details', desc: 'Your shop’s name and sector' },
      product: { label: 'Add a first product', desc: 'Build your catalogue' },
      employee: { label: 'Add a staff member', desc: 'Register your team' },
      whatsapp: { label: 'Turn on WhatsApp notifications', desc: 'Number and evening report' },
      sale: { label: 'Make a first sale', desc: 'From the till app' },
    },
  },
};

const ICON: Record<StepId, string> = {
  settings: 'M3 9l1-5h16l1 5M4 9v11h16V9M3 9h18M9 20v-6h6v6',
  product: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  employee: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19v-1a5 5 0 0 1 10 0v1M16 11l2 2 4-4',
  whatsapp: 'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5Z',
  sale: 'M3 6h18v12H3zM3 10h18M7 15h4',
};

const SESSION_KEY = 'magharebit_onboarding_dismissed';

export default function OnboardingChecklist({ lang, locale }: { lang: Lang; locale: string }) {
  const c = COPY[lang];
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(() => {
    void portalJson<Status>('/api/portal/onboarding').then((r) => { if (r.ok) setStatus(r.data); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try { setDismissed(sessionStorage.getItem(SESSION_KEY) === '1'); } catch { /* private mode */ }
      load();
    }, 0);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  if (!status || dismissed || status.allDone) return null;

  const pct = Math.round((status.completedCount / Math.max(1, status.totalCount)) * 100);
  const whatsappPending = status.steps.some((s) => s.id === 'whatsapp' && !s.done);

  return (
    <section aria-label={c.title} className={`${CARD} p-5 sm:p-6`} data-testid="onboarding">
      <div className="mb-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[#111827]">{c.title}</h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">{c.progress(status.completedCount, status.totalCount)}</p>
        </div>
        <button
          type="button"
          onClick={() => { setDismissed(true); try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ } }}
          aria-label={c.hide}
          className="-me-2 -mt-1 grid h-9 w-9 place-items-center rounded-lg text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F1F2F4]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={c.progress(status.completedCount, status.totalCount)}>
        {/* data-driven width: the only inline style here */}
        <div data-dynamic className="h-full rounded-full bg-gradient-to-r from-[#0F3D2A] to-[#F0B429] transition-[width] duration-500 ease-out rtl:bg-gradient-to-l" style={{ width: `${pct}%` }} />
      </div>

      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {status.steps.map((s) => {
          const id = s.id as StepId;
          const label = c.steps[id] ?? { label: s.id, desc: '' };
          const inner = (
            <>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.done ? 'bg-[#0F3D2A] text-white' : 'border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]'}`}>
                {s.done
                  ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
                  : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[id] ?? ICON.settings} /></svg>}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${s.done ? 'text-[#9CA3AF] line-through' : 'font-semibold text-[#111827]'}`}>{label.label}</span>
                {!s.done && <span className="block truncate text-xs text-[#6B7280]">{label.desc}</span>}
              </span>
            </>
          );
          return (
            <li key={s.id}>
              {!s.done && s.href ? (
                <a href={`/${locale}/portal/${s.href}`} className="flex min-h-[52px] items-center gap-3 rounded-lg p-2 transition-colors hover:bg-[#F9FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                  {inner}
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#D1D5DB] rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                </a>
              ) : (
                <div className="flex min-h-[52px] items-center gap-3 p-2">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>

      {whatsappPending && (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#D1FAE5] bg-[#F0FDF6] px-4 py-2.5 text-[13px] text-[#065F46]">
          <span>{c.tip}</span>
          <a href={`/${locale}/portal/settings`} className="font-bold text-[#0F3D2A] underline underline-offset-2">{c.tipCta}</a>
        </p>
      )}
    </section>
  );
}
