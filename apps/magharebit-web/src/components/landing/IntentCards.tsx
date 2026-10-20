'use client';

import { useLang, type Lang } from './useLang';

interface Card {
  target: string;
  title: string;
  body: string;
}

const COPY: Record<Lang, { badge: string; title: string; subtitle: string; cta: string; cards: Card[] }> = {
  ar: {
    badge: 'ماذا تريد أن تفعل؟',
    title: 'ابدأ من حاجتك اليومية',
    subtitle: 'اختر ما يهمك أكثر وسننقلك مباشرة إلى التفاصيل.',
    cta: 'التفاصيل',
    cards: [
      { target: 'checkout', title: 'أبيع بسرعة', body: 'مسح الباركود والميزان والدفع في ثوانٍ.' },
      { target: 'insights', title: 'أفهم مبيعاتي', body: 'ما الذي يُباع، وفي أي وقت، وبأي هامش.' },
      { target: 'reports', title: 'أتابع متجري من هاتفي', body: 'تقرير يومي يصلك على واتساب.' },
      { target: 'offline', title: 'أبقى مفتوحاً بدون إنترنت', body: 'البيع يستمر والمزامنة تتم عند عودة الاتصال.' },
    ],
  },
  fr: {
    badge: 'Que voulez-vous faire ?',
    title: 'Partez de votre besoin quotidien',
    subtitle: 'Choisissez ce qui compte le plus, nous vous menons droit au détail.',
    cta: 'Voir le détail',
    cards: [
      { target: 'checkout', title: 'Vendre vite', body: 'Scan, balance et paiement en quelques secondes.' },
      { target: 'insights', title: 'Comprendre mes ventes', body: 'Ce qui se vend, quand, et avec quelle marge.' },
      { target: 'reports', title: 'Suivre ma boutique depuis mon téléphone', body: 'Un rapport quotidien sur WhatsApp.' },
      { target: 'offline', title: 'Rester ouvert sans internet', body: 'La vente continue, la synchro se fait au retour du réseau.' },
    ],
  },
  en: {
    badge: 'What do you want to do?',
    title: 'Start from your everyday need',
    subtitle: 'Pick what matters most and we take you straight to the detail.',
    cta: 'See details',
    cards: [
      { target: 'checkout', title: 'Sell fast', body: 'Scan, weigh and pay in seconds.' },
      { target: 'insights', title: 'Understand my sales', body: 'What sells, when, and at what margin.' },
      { target: 'reports', title: 'Follow my shop from my phone', body: 'A daily report delivered on WhatsApp.' },
      { target: 'offline', title: 'Stay open without internet', body: 'Selling continues; sync happens when the network returns.' },
    ],
  },
};

export default function IntentCards() {
  const { lang, isRTL } = useLang();
  const c = COPY[lang];

  return (
    // id="products" keeps the existing navbar anchor (/#products) working.
    <section
      id="products"
      aria-labelledby="intents-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} scroll-mt-20 bg-brand-950 px-4 py-16 sm:px-6 md:py-20`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2
            id="intents-heading"
            className="mb-3 font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}
          >
            {c.title}
          </h2>
          <p className="mx-auto max-w-[520px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.cards.map((card) => (
            <li key={card.target}>
              <a
                href={`#${card.target}`}
                className="group flex h-full min-h-[48px] flex-col rounded-2xl border border-white/10 bg-brand-900/60 p-5 transition-colors hover:border-[#F0B429]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
              >
                <h3 className="mb-2 text-lg font-bold text-white">{card.title}</h3>
                <p className="mb-4 flex-1 text-sm leading-[1.7] text-white/65">{card.body}</p>
                <span className="text-sm font-semibold text-[#F0B429]">
                  {c.cta}
                  <span aria-hidden="true" className="ms-1 inline-block rtl:rotate-180">→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
