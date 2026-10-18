'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { formatNumber } from '@/lib/formatters';

// ─── Model (per product spec) ────────────────────────────────────────────────
const MIN_REVENUE = 20000;
const MAX_REVENUE = 300000;
const REVENUE_STEP = 5000;
const DEFAULT_REVENUE = 80000;

/** Share of spoilage avoided via smart expiry alerts + dynamic repricing. */
const REDUCTION_RATE = 0.35;
/** Subscription price used in the net-benefit calculation (MAD / month). */
const MONTHLY_PRICE_MAD = 249;

type CategoryKey = 'produce' | 'minimarket' | 'bakery';

const SPOILAGE_RATE: Record<CategoryKey, number> = {
  produce: 0.06,
  minimarket: 0.04,
  bakery: 0.08,
};

const CATEGORY_ORDER: CategoryKey[] = ['produce', 'minimarket', 'bakery'];

export function calcWaste(monthlyRevenue: number, spoilageRate: number) {
  const spoilageCost = monthlyRevenue * spoilageRate;
  const monthlySavings = spoilageCost * REDUCTION_RATE;
  const netAnnualBenefit = monthlySavings * 12 - MONTHLY_PRICE_MAD * 12;
  return { spoilageCost, monthlySavings, netAnnualBenefit };
}

// ─── Copy ────────────────────────────────────────────────────────────────────
type Lang = 'ar' | 'fr' | 'en';

interface Copy {
  badge: string;
  title: string;
  subtitle: string;
  revenueLabel: string;
  categoryLabel: string;
  categories: Record<CategoryKey, string>;
  currency: string;
  headlineBefore: string;
  headlineAfter: string;
  spoilageCostLabel: string;
  monthlySavingsLabel: string;
  annualBenefitLabel: string;
  assumptions: (reductionPct: number, price: number, currency: string) => string;
  cta: string;
}

const COPY: Record<Lang, Copy> = {
  ar: {
    badge: 'حاسبة الهدر',
    title: 'كم تخسر شهرياً بسبب الهدر؟',
    subtitle: 'حرّك المؤشر واختر نوع نشاطك لتعرف كم يمكنك أن توفّر.',
    revenueLabel: 'رقم المعاملات الشهري',
    categoryLabel: 'نوع النشاط (نسبة الهدر التقديرية)',
    categories: {
      produce: 'خضر وفواكه / بقالة',
      minimarket: 'ميني ماركت / متجر عام',
      bakery: 'مخبزة / أطعمة محضّرة',
    },
    currency: 'درهم',
    headlineBefore: 'نظام مغاربيت يوفر لك شهرياً ما يصل إلى',
    headlineAfter: '',
    spoilageCostLabel: 'خسارة الهدر الشهرية',
    monthlySavingsLabel: 'التوفير الشهري',
    annualBenefitLabel: 'صافي الفائدة السنوية بعد الاشتراك',
    assumptions: (pct, price, cur) =>
      `تقدير تقريبي: يفترض نسبة هدر متوسطة للقطاع وخفضاً بنسبة ${pct}% عبر تنبيهات انتهاء الصلاحية وإعادة التسعير الديناميكي، بعد خصم اشتراك ${price} ${cur} شهرياً. تختلف النتائج الفعلية من متجر لآخر.`,
    cta: 'احجز عرضك التجريبي',
  },
  fr: {
    badge: 'Calculateur de pertes',
    title: 'Combien perdez-vous chaque mois à cause du gaspillage ?',
    subtitle: 'Ajustez le curseur et choisissez votre activité pour estimer vos économies.',
    revenueLabel: 'Chiffre d’affaires mensuel',
    categoryLabel: 'Type de commerce (taux de perte estimé)',
    categories: {
      produce: 'Fruits & légumes / Épicerie',
      minimarket: 'Supérette / Commerce général',
      bakery: 'Boulangerie / Produits préparés',
    },
    currency: 'DH',
    headlineBefore: 'MAGHAREBIT peut vous faire économiser jusqu’à',
    headlineAfter: 'par mois',
    spoilageCostLabel: 'Coût mensuel du gaspillage',
    monthlySavingsLabel: 'Économie mensuelle',
    annualBenefitLabel: 'Bénéfice annuel net après abonnement',
    assumptions: (pct, price, cur) =>
      `Estimation indicative : suppose un taux de perte moyen du secteur et une réduction de ${pct} % grâce aux alertes de péremption et au repricing dynamique, après déduction de l’abonnement de ${price} ${cur}/mois. Les résultats réels varient selon le commerce.`,
    cta: 'Réserver ma démo',
  },
  en: {
    badge: 'Waste calculator',
    title: 'How much does waste cost you every month?',
    subtitle: 'Move the slider and pick your business type to estimate your savings.',
    revenueLabel: 'Monthly revenue',
    categoryLabel: 'Business type (estimated spoilage rate)',
    categories: {
      produce: 'Fresh produce / Groceries',
      minimarket: 'Minimarket / General store',
      bakery: 'Bakery / Prepared foods',
    },
    currency: 'DH',
    headlineBefore: 'MAGHAREBIT can save you up to',
    headlineAfter: 'per month',
    spoilageCostLabel: 'Monthly spoilage cost',
    monthlySavingsLabel: 'Monthly savings',
    annualBenefitLabel: 'Net annual benefit after subscription',
    assumptions: (pct, price, cur) =>
      `Rough estimate: assumes a sector-average spoilage rate and a ${pct}% reduction from smart expiry alerts and dynamic repricing, net of the ${price} ${cur}/month subscription. Actual results vary by store.`,
    cta: 'Book my demo',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function WasteCalculator() {
  const locale = useLocale();
  const lang: Lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  const c = COPY[lang];
  const isRTL = lang === 'ar';
  const fontBody = isRTL ? 'font-arabic' : 'font-sans';

  const [monthlyRevenue, setMonthlyRevenue] = useState(DEFAULT_REVENUE);
  const [category, setCategory] = useState<CategoryKey>('produce');

  const headingId = useId();
  const sliderId = useId();
  const groupName = useId();

  const spoilageRate = SPOILAGE_RATE[category];
  const { spoilageCost, monthlySavings, netAnnualBenefit } = calcWaste(monthlyRevenue, spoilageRate);

  // Non-breaking space keeps the amount and its currency on one line at 375px.
  const money = (n: number) => `${formatNumber(Math.round(n), lang)} ${c.currency}`;
  const netIsNegative = netAnnualBenefit < 0;

  return (
    <section
      aria-labelledby={headingId}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${fontBody} bg-brand-950 px-4 py-16 sm:px-6 md:py-20`}
    >
      <div className="mx-auto max-w-[1000px]">
        {/* Heading */}
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2
            id={headingId}
            className="mb-3 font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}
          >
            {c.title}
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        {/* Card */}
        <div className="grid gap-8 rounded-3xl border border-emerald-800/40 bg-white/[0.03] p-5 sm:p-8 lg:grid-cols-2 lg:gap-10">
          {/* Inputs */}
          <div className="flex flex-col gap-8">
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <label htmlFor={sliderId} className="text-sm font-semibold text-white/85">
                  {c.revenueLabel}
                </label>
                <output
                  htmlFor={sliderId}
                  className="whitespace-nowrap font-display text-xl font-extrabold text-[#F0B429]"
                >
                  {money(monthlyRevenue)}
                </output>
              </div>
              <input
                id={sliderId}
                type="range"
                min={MIN_REVENUE}
                max={MAX_REVENUE}
                step={REVENUE_STEP}
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                aria-valuetext={money(monthlyRevenue)}
                className="h-12 w-full cursor-pointer"
                style={{ accentColor: '#F0B429' }}
              />
              <div className="mt-1 flex justify-between text-xs text-white/40">
                <span>{formatNumber(MIN_REVENUE, lang)}</span>
                <span>{formatNumber(MAX_REVENUE, lang)}</span>
              </div>
            </div>

            <fieldset className="border-0 p-0">
              <legend className="mb-3 text-sm font-semibold text-white/85">{c.categoryLabel}</legend>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {CATEGORY_ORDER.map((key) => (
                  <label key={key} className="block cursor-pointer">
                    <input
                      type="radio"
                      name={groupName}
                      value={key}
                      checked={category === key}
                      onChange={() => setCategory(key)}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition-colors peer-checked:border-[#F0B429] peer-checked:bg-[#F0B429]/10 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#F0B429]">
                      <span>{c.categories[key]}</span>
                      <span className="font-display font-bold text-[#F0B429]">
                        {Math.round(SPOILAGE_RATE[key] * 100)}%
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Results */}
          <div
            aria-live="polite"
            className="flex flex-col justify-between gap-6 rounded-2xl border border-[#F0B429]/30 bg-brand-900/60 p-5 sm:p-6"
          >
            <p className="text-lg leading-[1.7] text-white">
              {c.headlineBefore}{' '}
              <span className="whitespace-nowrap font-display text-3xl font-extrabold text-[#F0B429] sm:text-4xl">
                {money(monthlySavings)}
              </span>{' '}
              {c.headlineAfter}
            </p>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div>
                <dt className="text-xs text-white/55">{c.spoilageCostLabel}</dt>
                <dd className="font-display text-lg font-bold text-white">{money(spoilageCost)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/55">{c.monthlySavingsLabel}</dt>
                <dd className="font-display text-lg font-bold text-[#F0B429]">{money(monthlySavings)}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/55">{c.annualBenefitLabel}</dt>
                <dd
                  className={`font-display text-lg font-bold ${netIsNegative ? 'text-red-400' : 'text-[#F0B429]'}`}
                >
                  {netIsNegative ? '−' : ''}
                  {money(Math.abs(netAnnualBenefit))}
                </dd>
              </div>
            </dl>

            <Link
              href={`/${locale}/demo`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gold-400 px-8 py-3 text-base font-bold text-brand-950 transition-transform hover:-translate-y-0.5"
            >
              {c.cta}
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-[760px] text-center text-xs leading-[1.7] text-white/40">
          {c.assumptions(Math.round(REDUCTION_RATE * 100), MONTHLY_PRICE_MAD, c.currency)}
        </p>
      </div>
    </section>
  );
}
