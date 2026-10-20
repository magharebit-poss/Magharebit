'use client';

import { useLang, type Lang } from './useLang';

// Product facts only — no merchant counts, uptime or revenue figures until they can be evidenced.
const COPY: Record<Lang, { label: string; items: string[] }> = {
  ar: {
    label: 'ما يميز مغاربيت',
    items: ['يعمل بدون إنترنت', 'عربي · فرنسي · دارجة', 'تجربة مجانية 14 يوماً بدون بطاقة', 'صُمم في المغرب'],
  },
  fr: {
    label: 'Ce qui distingue MAGHAREBIT',
    items: ['Fonctionne hors ligne', 'Arabe · Français · Darija', 'Essai gratuit 14 jours, sans carte', 'Conçu au Maroc'],
  },
  en: {
    label: 'What sets MAGHAREBIT apart',
    items: ['Works offline', 'Arabic · French · Darija', '14-day free trial, no card', 'Designed in Morocco'],
  },
};

export default function ProofStrip() {
  const { lang, isRTL } = useLang();
  const c = COPY[lang];

  return (
    <section
      aria-label={c.label}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} border-y border-white/10 bg-brand-900 px-4 py-5 sm:px-6`}
    >
      <ul className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-white/85">
        {c.items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
