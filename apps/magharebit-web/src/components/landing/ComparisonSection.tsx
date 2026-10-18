'use client';

import { useLocale } from 'next-intl';

type Lang = 'ar' | 'fr' | 'en';
type Status = 'yes' | 'no' | 'partial' | 'unknown';

interface Cell {
  status: Status;
  text: string;
}

interface Row {
  metric: string;
  magharebit: Cell;
  traditional: Cell;
  other: Cell;
}

interface Copy {
  badge: string;
  title: string;
  subtitle: string;
  caption: string;
  featureCol: string;
  designedForMorocco: string;
  /** Column headers for the two anonymized competitor groups. */
  competitorNames: readonly [string, string];
  statusLabel: Record<Status, string>;
  rows: Row[];
}

/**
 * Competitor cells below are product/marketing claims about third parties.
 * Competitors are intentionally anonymized (generic categories, no brand names).
 * TODO(verify before launch): the claims in the `traditional` / `other` cells are
 * still assertions about third-party products; confirm they hold for the
 * categories described. Cells marked `unknown` were not specified in the brief
 * and render as an em dash until filled in.
 */
const UNKNOWN: Cell = { status: 'unknown', text: '—' };

const COPY: Record<Lang, Copy> = {
  ar: {
    badge: 'مقارنة صريحة',
    title: 'لماذا مغاربيت؟',
    subtitle: 'الفروقات التقنية التي تهم تاجراً مغربياً في يومه العادي.',
    caption: 'مقارنة بين مغاربيت والأنظمة التقليدية والحلول الأخرى',
    featureCol: 'الميزة',
    designedForMorocco: 'صُمم للمغرب',
    competitorNames: ['الأنظمة التقليدية', 'الحلول الأخرى'],
    statusLabel: { yes: 'متوفر', no: 'غير متوفر', partial: 'محدود', unknown: 'غير محدد' },
    rows: [
      {
        metric: 'الاستقرار بدون إنترنت',
        magharebit: { status: 'yes', text: 'طابور معاملات فعلي يعمل دون اتصال' },
        traditional: { status: 'no', text: 'يتطلب اتصالاً نشطاً' },
        other: { status: 'no', text: 'يتطلب اتصالاً نشطاً' },
      },
      {
        metric: 'تتبع الهدر وانتهاء الصلاحية بالذكاء الاصطناعي',
        magharebit: { status: 'yes', text: 'توقعات مدمجة بالدرهم' },
        traditional: { status: 'partial', text: 'غير متوفر أو أساسي' },
        other: { status: 'partial', text: 'غير متوفر أو أساسي' },
      },
      {
        metric: 'ربط الموازين الإلكترونية',
        magharebit: { status: 'yes', text: 'دعم أصلي لبروتوكولات DIBAL وCAS وBrecknell' },
        traditional: UNKNOWN,
        other: UNKNOWN,
      },
      {
        metric: 'اللغة والدعم',
        magharebit: { status: 'yes', text: 'عربية وفرنسية ودارجة، مع دعم هاتفي وواتساب مباشر' },
        traditional: { status: 'partial', text: 'تذاكر بالفرنسية فقط' },
        other: { status: 'partial', text: 'تذاكر بالفرنسية فقط' },
      },
      {
        metric: 'شفافية الأسعار',
        magharebit: { status: 'yes', text: '249 درهم/شهر شامل كل شيء' },
        traditional: { status: 'no', text: 'رسوم إضافية حسب الخيارات' },
        other: { status: 'no', text: 'رسوم إضافية حسب الخيارات' },
      },
    ],
  },
  fr: {
    badge: 'Comparaison franche',
    title: 'Pourquoi MAGHAREBIT ?',
    subtitle: 'Les écarts techniques qui comptent pour un commerçant marocain au quotidien.',
    caption: 'Comparaison entre MAGHAREBIT, les caisses traditionnelles et les autres solutions',
    featureCol: 'Critère',
    designedForMorocco: 'Conçu pour le Maroc',
    competitorNames: ['Caisses traditionnelles', 'Autres solutions'],
    statusLabel: { yes: 'Oui', no: 'Non', partial: 'Limité', unknown: 'Non précisé' },
    rows: [
      {
        metric: 'Stabilité hors-ligne',
        magharebit: { status: 'yes', text: 'Vraie file de transactions hors-ligne' },
        traditional: { status: 'no', text: 'Connexion active requise' },
        other: { status: 'no', text: 'Connexion active requise' },
      },
      {
        metric: 'Suivi IA des pertes et péremptions',
        magharebit: { status: 'yes', text: 'Prédiction intégrée, chiffrée en MAD' },
        traditional: { status: 'partial', text: 'Aucun ou basique' },
        other: { status: 'partial', text: 'Aucun ou basique' },
      },
      {
        metric: 'Intégration des balances électroniques',
        magharebit: { status: 'yes', text: 'Protocoles natifs DIBAL, CAS et Brecknell' },
        traditional: UNKNOWN,
        other: UNKNOWN,
      },
      {
        metric: 'Langues et support',
        magharebit: { status: 'yes', text: 'Arabe, français et darija, avec support téléphone / WhatsApp direct' },
        traditional: { status: 'partial', text: 'Tickets en français uniquement' },
        other: { status: 'partial', text: 'Tickets en français uniquement' },
      },
      {
        metric: 'Transparence tarifaire',
        magharebit: { status: 'yes', text: '249 MAD/mois, tout compris' },
        traditional: { status: 'no', text: 'Frais additionnels selon les options' },
        other: { status: 'no', text: 'Frais additionnels selon les options' },
      },
    ],
  },
  en: {
    badge: 'Straight comparison',
    title: 'Why MAGHAREBIT?',
    subtitle: 'The technical differences that matter to a Moroccan merchant day to day.',
    caption: 'Comparison of MAGHAREBIT, traditional POS systems and other platforms',
    featureCol: 'Feature',
    designedForMorocco: 'Designed for Morocco',
    competitorNames: ['Traditional POS', 'Other Platforms'],
    statusLabel: { yes: 'Yes', no: 'No', partial: 'Limited', unknown: 'Not specified' },
    rows: [
      {
        metric: 'Offline-first stability',
        magharebit: { status: 'yes', text: 'True offline transaction queue' },
        traditional: { status: 'no', text: 'Requires an active connection' },
        other: { status: 'no', text: 'Requires an active connection' },
      },
      {
        metric: 'AI waste & expiry tracking',
        magharebit: { status: 'yes', text: 'Built-in prediction, valued in MAD' },
        traditional: { status: 'partial', text: 'None or basic' },
        other: { status: 'partial', text: 'None or basic' },
      },
      {
        metric: 'Electronic scale integration',
        magharebit: { status: 'yes', text: 'Native protocol support for DIBAL, CAS and Brecknell' },
        traditional: UNKNOWN,
        other: UNKNOWN,
      },
      {
        metric: 'Language & support',
        magharebit: { status: 'yes', text: 'Arabic, French and Darija, with direct phone / WhatsApp support' },
        traditional: { status: 'partial', text: 'French tickets only' },
        other: { status: 'partial', text: 'French tickets only' },
      },
      {
        metric: 'Pricing transparency',
        magharebit: { status: 'yes', text: 'All-inclusive 249 MAD/month' },
        traditional: { status: 'no', text: 'Add-on fee model' },
        other: { status: 'no', text: 'Add-on fee model' },
      },
    ],
  },
};

const MARK: Record<Status, { glyph: string; color: string }> = {
  yes: { glyph: '✓', color: '#5EC485' },
  no: { glyph: '✗', color: '#F87171' },
  partial: { glyph: '⚠', color: '#F0B429' },
  unknown: { glyph: '—', color: 'rgba(255,255,255,0.35)' },
};

function Mark({ status, label }: { status: Status; label: string }) {
  const m = MARK[status];
  return (
    <>
      <span aria-hidden="true" className="text-lg font-bold leading-none" style={{ color: m.color }}>
        {m.glyph}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

export default function ComparisonSection() {
  const locale = useLocale();
  const lang: Lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  const c = COPY[lang];
  const isRTL = lang === 'ar';
  const fontBody = isRTL ? 'font-arabic' : 'font-sans';
  const competitors = c.competitorNames;

  return (
    <section
      aria-labelledby="comparison-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${fontBody} bg-brand-950 px-4 py-16 sm:px-6 md:py-20`}
    >
      <div className="mx-auto max-w-[1000px]">
        {/* Heading */}
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2
            id="comparison-heading"
            className="mb-3 font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}
          >
            {c.title}
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        {/* Desktop / tablet: table */}
        <div className="hidden md:block">
          <table className="w-full border-separate border-spacing-0 text-start">
            <caption className="sr-only">{c.caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="p-4 text-start text-sm font-semibold text-white/55">
                  {c.featureCol}
                </th>
                <th
                  scope="col"
                  className="relative rounded-t-2xl border-x border-t border-[#F0B429]/40 bg-[#F0B429]/[0.06] px-4 pb-4 pt-7 text-center"
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-brand-950">
                    {c.designedForMorocco}
                  </span>
                  <span className="font-display text-base font-extrabold text-white">MAGHAREBIT</span>
                </th>
                {competitors.map((name) => (
                  <th
                    key={name}
                    scope="col"
                    className="p-4 text-center font-display text-sm font-bold text-white/65"
                  >
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => {
                const isLast = i === c.rows.length - 1;
                const rowBorder = i === 0 ? '' : 'border-t border-white/[0.06]';
                return (
                  <tr key={row.metric}>
                    <th
                      scope="row"
                      className={`p-4 text-start text-sm font-semibold text-white ${rowBorder}`}
                    >
                      {row.metric}
                    </th>
                    <td
                      className={`border-x border-[#F0B429]/40 bg-[#F0B429]/[0.06] p-4 align-top ${rowBorder} ${
                        isLast ? 'rounded-b-2xl border-b' : ''
                      }`}
                    >
                      <div className="flex items-start justify-center gap-2 text-start text-sm text-white">
                        <Mark status={row.magharebit.status} label={c.statusLabel[row.magharebit.status]} />
                        <span>{row.magharebit.text}</span>
                      </div>
                    </td>
                    {([row.traditional, row.other] as const).map((cell, idx) => (
                      <td key={idx} className={`p-4 align-top ${rowBorder}`}>
                        <div className="flex items-start justify-center gap-2 text-start text-sm text-white/65">
                          <Mark status={cell.status} label={c.statusLabel[cell.status]} />
                          <span>{cell.text}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: one card per metric */}
        <ul className="space-y-4 md:hidden">
          {c.rows.map((row) => (
            <li
              key={row.metric}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <h3 className="mb-3 text-base font-bold text-white">{row.metric}</h3>
              <div className="space-y-2">
                <div className="relative rounded-xl border border-[#F0B429]/40 bg-[#F0B429]/[0.06] p-3">
                  <span className="mb-1 block font-display text-xs font-extrabold text-[#F0B429]">
                    MAGHAREBIT · {c.designedForMorocco}
                  </span>
                  <div className="flex items-start gap-2 text-sm text-white">
                    <Mark status={row.magharebit.status} label={c.statusLabel[row.magharebit.status]} />
                    <span>{row.magharebit.text}</span>
                  </div>
                </div>
                {([
                  [competitors[0], row.traditional],
                  [competitors[1], row.other],
                ] as const).map(([name, cell]) => (
                  <div key={name} className="rounded-xl border border-white/[0.06] p-3">
                    <span className="mb-1 block font-display text-xs font-bold text-white/50">{name}</span>
                    <div className="flex items-start gap-2 text-sm text-white/65">
                      <Mark status={cell.status} label={c.statusLabel[cell.status]} />
                      <span>{cell.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
