'use client';

import { useState } from 'react';
import type { Lang } from '@/components/landing/useLang';
import { BRAND } from '@/lib/brand';
import { BTN, CARD } from '@/components/portal/PortalDialog';
import { longDate } from '@/components/portal/format';

export interface LicenseCardProps {
  lang: Lang;
  licenseKey: string | null;
  plan: string | null;
  isTrial: boolean;
  daysRemaining: number | null;
  expiresAt: string | null;
}

const COPY: Record<Lang, {
  title: string; key: string; noKey: string; copy: string; copied: string; copyFail: string; days: string; expires: string;
  status: { active: string; trial: string; expired: string };
  trialNote: (n: number) => string; soonNote: string; renew: string; upgrade: string; support: string;
  waRenew: string; waSupport: string;
}> = {
  fr: {
    title: 'Abonnement et licence', key: 'Clé de licence', noKey: 'Aucune clé émise pour le moment',
    copy: 'Copier', copied: 'Copiée', copyFail: 'Échec de la copie', days: 'Jours restants', expires: 'Expire le',
    status: { active: 'Actif', trial: 'Essai', expired: 'Expiré' },
    trialNote: (n) => `Vous êtes en période d’essai gratuite. Pour continuer après ${n} jour${n > 1 ? 's' : ''}, choisissez une formule.`,
    soonNote: 'Votre abonnement expire bientôt. Renouvelez-le pour éviter toute interruption.',
    renew: 'Renouveler', upgrade: 'Changer de formule', support: 'Support',
    waRenew: 'Bonjour, je souhaite renouveler mon abonnement MAGHAREBIT.', waSupport: 'Bonjour, j’ai besoin d’aide avec ma licence MAGHAREBIT.',
  },
  ar: {
    title: 'الاشتراك والترخيص', key: 'مفتاح الترخيص', noKey: 'لم يُصدر مفتاح بعد',
    copy: 'نسخ', copied: 'تم النسخ', copyFail: 'تعذّر النسخ', days: 'الأيام المتبقية', expires: 'ينتهي في',
    status: { active: 'نشط', trial: 'تجريبي', expired: 'منتهي' },
    trialNote: (n) => `أنت في الفترة التجريبية المجانية. للاستمرار بعد ${n} ${n > 10 ? 'يوماً' : n > 2 ? 'أيام' : n === 2 ? 'يومين' : 'يوم'}، اختر خطة.`,
    soonNote: 'اشتراكك ينتهي قريباً. جدّده لتجنب انقطاع الخدمة.',
    renew: 'تجديد الاشتراك', upgrade: 'تغيير الخطة', support: 'الدعم',
    waRenew: 'مرحباً، أريد تجديد اشتراك MAGHAREBIT.', waSupport: 'مرحباً، أحتاج مساعدة في ترخيص MAGHAREBIT.',
  },
  en: {
    title: 'Subscription and license', key: 'License key', noKey: 'No key issued yet',
    copy: 'Copy', copied: 'Copied', copyFail: 'Copy failed', days: 'Days left', expires: 'Expires on',
    status: { active: 'Active', trial: 'Trial', expired: 'Expired' },
    trialNote: (n) => `You are on the free trial. To keep going after ${n} day${n > 1 ? 's' : ''}, choose a plan.`,
    soonNote: 'Your subscription ends soon. Renew it to avoid any interruption.',
    renew: 'Renew', upgrade: 'Change plan', support: 'Support',
    waRenew: 'Hello, I would like to renew my MAGHAREBIT subscription.', waSupport: 'Hello, I need help with my MAGHAREBIT license.',
  },
};

export default function LicenseCard({ lang, licenseKey, plan, isTrial, daysRemaining, expiresAt }: LicenseCardProps) {
  const c = COPY[lang];
  const [copy, setCopy] = useState<'idle' | 'copied' | 'error'>('idle');
  const expired = daysRemaining !== null && daysRemaining <= 0;
  const soon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7;
  const status = expired ? 'expired' : isTrial ? 'trial' : 'active';
  const badge = { active: 'bg-[#ECFDF3] text-[#166534] ring-[#BBF7D0]', trial: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/40', expired: 'bg-[#FEF2F2] text-[#B91C1C] ring-[#FECACA]' }[status];
  const dot = { active: 'bg-[#22C55E]', trial: 'bg-[#F0B429]', expired: 'bg-[#DC2626]' }[status];
  const wa = (text: string) => `${BRAND.contact.waLink}?text=${encodeURIComponent(text)}`;

  const doCopy = () => {
    if (!licenseKey) return;
    navigator.clipboard.writeText(licenseKey)
      .then(() => setCopy('copied'), () => setCopy('error'))
      .finally(() => setTimeout(() => setCopy('idle'), 2000));
  };

  return (
    <section aria-label={c.title} className={`${CARD} overflow-hidden ${soon || expired ? 'ring-2 ring-[#FECACA]' : ''}`} data-testid="license-card">
      <div className="flex items-center gap-3 bg-gradient-to-br from-[#0F3D2A] to-[#1A5C3A] px-5 py-4 text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#F0B429]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 7a4 4 0 1 1-4 4 4 4 0 0 1 4-4zM11 11 3 19v2h3l1-1v-2h2v-2h2" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60">{c.title}</p>
          <p className="truncate text-lg font-bold">{plan ?? 'Starter'}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {c.status[status]}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
          <p className="mb-1.5 text-xs font-semibold text-[#64748B]">{c.key}</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {licenseKey
              ? <code dir="ltr" className="break-all font-mono text-[15px] font-bold tracking-wider text-[#0F172A]" data-testid="license-key">{licenseKey}</code>
              : <span className="text-sm text-[#94A3B8]">{c.noKey}</span>}
            {licenseKey && (
              <button type="button" onClick={doCopy} disabled={copy !== 'idle'} aria-live="polite" className={copy === 'idle' ? BTN.primary : `inline-flex min-h-[40px] items-center rounded-lg px-4 text-sm font-semibold ${copy === 'copied' ? 'bg-[#ECFDF3] text-[#166534]' : 'bg-[#FEF2F2] text-[#B91C1C]'}`}>
                {copy === 'copied' ? c.copied : copy === 'error' ? c.copyFail : c.copy}
              </button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <dt className="text-xs font-semibold text-[#64748B]">{c.days}</dt>
            <dd className={`mt-0.5 text-2xl font-bold tabular-nums ${expired || soon ? 'text-[#DC2626]' : isTrial ? 'text-[#B8860B]' : 'text-[#166534]'}`}>{daysRemaining ?? '—'}</dd>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <dt className="text-xs font-semibold text-[#64748B]">{c.expires}</dt>
            <dd className="mt-1 text-sm font-semibold text-[#0F172A]">{expiresAt ? longDate(expiresAt, lang) : '—'}</dd>
          </div>
        </dl>

        {isTrial && daysRemaining !== null && daysRemaining > 0 && (
          <p className="rounded-lg border border-[#F0B429]/40 bg-[#FFF8E1] px-3.5 py-2.5 text-[13px] text-[#7A5600]">{c.trialNote(daysRemaining)}</p>
        )}
        {!isTrial && soon && (
          <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#B91C1C]">{c.soonNote}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <a href={wa(c.waRenew)} target="_blank" rel="noopener noreferrer" className={BTN.gold}>{isTrial ? c.upgrade : c.renew}</a>
          <a href={wa(c.waSupport)} target="_blank" rel="noopener noreferrer" className={BTN.secondary}>{c.support}</a>
        </div>
      </div>
    </section>
  );
}
