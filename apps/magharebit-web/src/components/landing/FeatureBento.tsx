'use client';

import type { ReactNode } from 'react';
import { InsightsIllustration, ReceiptIllustration, ScanIllustration } from './illustrations';
import { useLang, type Lang } from './useLang';

type TileId = 'offline' | 'checkout' | 'whatsapp' | 'stock' | 'receipt' | 'insights' | 'bilingual' | 'hardware';

interface Tile { id: TileId; title: string; body: string }

const COPY: Record<Lang, {
  badge: string; title: string; subtitle: string; more: string;
  tiles: Tile[]; offline: { online: string; offline: string; synced: string };
}> = {
  ar: {
    badge: 'لماذا MAGHAREBIT',
    title: 'كل ما يحتاجه متجرك، في مكان واحد',
    subtitle: 'مصمم لواقع التجارة في المغرب: الإنترنت المتقطع، الدفع نقداً، والعربية والفرنسية معاً.',
    more: 'المزيد',
    tiles: [
      { id: 'offline', title: 'البيع لا يتوقف بدون إنترنت', body: 'تُسجَّل العمليات على الجهاز وتُزامن تلقائياً عند عودة الاتصال.' },
      { id: 'checkout', title: 'دفع في ثوانٍ', body: 'باركود، ميزان، نقد أو بطاقة أو QR.' },
      { id: 'whatsapp', title: 'تقرير كل مساء على واتساب', body: 'المبيعات والهامش وتنبيهات المخزون، دون فتح أي تطبيق.' },
      { id: 'stock', title: 'مخزون في الوقت الفعلي', body: 'كل بيع يُخصم من المخزون، مع تنبيه قبل النفاد.' },
      { id: 'receipt', title: 'وصل باسم متجرك', body: 'طابعة حرارية 80 مم وشعارك في أعلى الوصل.' },
      { id: 'insights', title: 'افهم ما يُباع', body: 'المنتجات الأكثر مبيعاً ومقارنة الأيام والأسابيع.' },
      { id: 'bilingual', title: 'عربية وفرنسية', body: 'واجهة ووصولات باللغتين، وأسعار بالدرهم.' },
      { id: 'hardware', title: 'معدات متوافقة', body: 'طابعات وقارئات وموازين شائعة في المغرب.' },
    ],
    offline: { online: 'متصل', offline: 'بدون إنترنت — البيع مستمر', synced: 'تمت المزامنة' },
  },
  fr: {
    badge: 'Pourquoi MAGHAREBIT',
    title: 'Tout ce qu’il faut à votre commerce, au même endroit',
    subtitle: 'Pensé pour le commerce au Maroc : internet qui coupe, paiement en espèces, arabe et français ensemble.',
    more: 'En savoir plus',
    tiles: [
      { id: 'offline', title: 'La vente continue sans internet', body: 'Les ventes sont enregistrées sur l’appareil et synchronisées automatiquement au retour du réseau.' },
      { id: 'checkout', title: 'Encaisser en quelques secondes', body: 'Code-barres, balance, espèces, carte ou QR.' },
      { id: 'whatsapp', title: 'Un rapport chaque soir sur WhatsApp', body: 'Ventes, marge et alertes de stock, sans ouvrir d’application.' },
      { id: 'stock', title: 'Stock en temps réel', body: 'Chaque vente déduit le stock, avec une alerte avant la rupture.' },
      { id: 'receipt', title: 'Un ticket à votre nom', body: 'Imprimante thermique 80 mm et votre logo en haut du ticket.' },
      { id: 'insights', title: 'Comprendre ce qui se vend', body: 'Meilleures ventes, comparaison des jours et des semaines.' },
      { id: 'bilingual', title: 'Arabe et français', body: 'Interface et tickets dans les deux langues, prix en dirhams.' },
      { id: 'hardware', title: 'Matériel compatible', body: 'Imprimantes, lecteurs et balances courants au Maroc.' },
    ],
    offline: { online: 'En ligne', offline: 'Hors ligne — la vente continue', synced: 'Synchronisé' },
  },
  en: {
    badge: 'Why MAGHAREBIT',
    title: 'Everything your shop needs, in one place',
    subtitle: 'Built for trade in Morocco: patchy internet, cash payments, Arabic and French side by side.',
    more: 'Learn more',
    tiles: [
      { id: 'offline', title: 'Selling continues without internet', body: 'Sales are saved on the device and synced automatically when the network returns.' },
      { id: 'checkout', title: 'Check out in seconds', body: 'Barcode, scale, cash, card or QR.' },
      { id: 'whatsapp', title: 'A report every evening on WhatsApp', body: 'Sales, margin and stock alerts, without opening an app.' },
      { id: 'stock', title: 'Real-time stock', body: 'Every sale updates stock, with an alert before you run out.' },
      { id: 'receipt', title: 'A receipt with your name', body: '80 mm thermal printer and your logo at the top.' },
      { id: 'insights', title: 'See what sells', body: 'Best sellers, day and week comparisons.' },
      { id: 'bilingual', title: 'Arabic and French', body: 'Interface and receipts in both languages, prices in dirhams.' },
      { id: 'hardware', title: 'Compatible hardware', body: 'Printers, scanners and scales common in Morocco.' },
    ],
    offline: { online: 'Online', offline: 'Offline — selling continues', synced: 'Synced' },
  },
};

/** Where each tile leads ('#…' = a section of the home page). bilingual has no detail page. */
const TARGET: Record<TileId, string | null> = {
  offline: '/features#offline',
  checkout: '#pos',
  whatsapp: '#reports',
  stock: '/features#inventory',
  receipt: '#hardware',
  insights: '/features#ai',
  bilingual: null,
  hardware: '/materiel',
};

/** Grid placement on lg (12 columns); md is 2 columns with the visual tiles spanning both. */
const SPAN: Record<TileId, string> = {
  offline: 'md:col-span-2 lg:col-span-7',
  checkout: 'lg:col-span-5',
  whatsapp: 'lg:col-span-4',
  stock: 'lg:col-span-4',
  receipt: 'lg:col-span-4',
  insights: 'md:col-span-2 lg:col-span-6',
  bilingual: 'lg:col-span-3',
  hardware: 'lg:col-span-3',
};

const ICON: Record<TileId, ReactNode> = {
  offline: <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />,
  checkout: <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" />,
  whatsapp: <><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></>,
  stock: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  bilingual: <><path d="M4 5h9M8.5 5v2c0 4-2.5 7-5 8" /><path d="M6 10c1.5 2.5 4 4.5 7 5" /><path d="m13 20 4-9 4 9M14.5 17h5" /></>,
  hardware: <><rect x="5" y="3" width="14" height="10" rx="1.5" /><path d="M7 13v4h10v-4M9 21h6M12 17v4" /></>,
};

function OfflineDemo({ labels }: { labels: { online: string; offline: string; synced: string } }) {
  const states = [
    { text: labels.online, color: '#5EC485' },
    { text: labels.offline, color: '#F0B429' },
    { text: labels.synced, color: '#5EC485' },
  ];
  return (
    <div className="relative h-full w-full">
      {states.map((s, i) => (
        <div key={i} className="offline-demo__state">
          <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full" style={{ background: s.color, boxShadow: `0 0 0 8px ${s.color}22` }} />
          <span className="px-4 text-center text-base font-bold text-white sm:text-lg">{s.text}</span>
        </div>
      ))}
    </div>
  );
}

function WhatsAppBubbles() {
  return (
    <div aria-hidden="true" className="flex h-full w-full flex-col justify-center gap-2 px-2">
      <span className="h-3 w-3/4 self-start rounded-full bg-white/10" />
      <span className="flex w-[82%] flex-col gap-1.5 self-end rounded-xl rounded-ee-sm bg-[#25D366]/20 p-3 ring-1 ring-[#25D366]/30">
        <span className="h-2 w-1/2 rounded-full bg-white/30" />
        <span className="h-2 w-5/6 rounded-full bg-white/20" />
        <span className="h-2 w-2/3 rounded-full bg-gold-400/60" />
      </span>
    </div>
  );
}

export default function FeatureBento() {
  const { lang, isRTL, locale } = useLang();
  const c = COPY[lang];

  const visual = (id: TileId): ReactNode => {
    if (id === 'offline') return <OfflineDemo labels={c.offline} />;
    if (id === 'checkout') return <ScanIllustration />;
    if (id === 'receipt') return <ReceiptIllustration />;
    if (id === 'insights') return <InsightsIllustration />;
    if (id === 'whatsapp') return <WhatsAppBubbles />;
    return null;
  };

  return (
    // id="products" keeps the navbar's /#products anchor working.
    <section
      id="products"
      aria-labelledby="bento-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} scroll-mt-20 bg-brand-950 px-4 py-16 sm:px-6 md:py-24`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2 id="bento-heading" className="mb-3 font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}>
            {c.title}
          </h2>
          <p className="mx-auto max-w-[620px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          {c.tiles.map((tile) => {
            const v = visual(tile.id);
            const target = TARGET[tile.id];
            const href = target === null ? null : target.startsWith('#') ? target : `/${locale}${target}`;
            const inner = (
              <>
                {v && (
                  <div aria-hidden="true" className="relative mb-5 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-900 to-brand-950 ring-1 ring-white/5 sm:h-44">
                    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 55%, rgba(240,180,41,0.14), transparent 70%)' }} />
                    <div className="relative h-full w-full p-3">{v}</div>
                  </div>
                )}
                <span aria-hidden="true" className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-brand-900 text-gold-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[tile.id]}</svg>
                </span>
                <h3 className="mb-1.5 text-lg font-bold text-white">{tile.title}</h3>
                <p className="flex-1 text-sm leading-[1.7] text-white/65">{tile.body}</p>
                {href && (
                  <span className="mt-4 text-sm font-semibold text-gold-400">
                    {c.more}
                    <span aria-hidden="true" className="ms-1 inline-block rtl:rotate-180">→</span>
                  </span>
                )}
              </>
            );
            const box = 'flex h-full flex-col rounded-2xl border border-white/10 bg-brand-900/50 p-5 sm:p-6';
            return (
              <li key={tile.id} className={SPAN[tile.id]}>
                {href ? (
                  <a
                    href={href}
                    className={`${box} group transition-colors hover:border-gold-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400`}
                  >
                    {inner}
                  </a>
                ) : (
                  <div className={box}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
