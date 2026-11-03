'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { DashboardScreen, ReceiptScreen } from './ScreenMockups';
import { useLang, type Lang } from './useLang';

type TileId = 'offline' | 'checkout' | 'whatsapp' | 'darija' | 'nocontract' | 'stock' | 'setup' | 'data' | 'ecosystem';

interface Tile { id: TileId; title: string; body: string }

/*
 * Claims, as approved by the coordinator (30/10/2026) and kept to what the product does:
 * - offline: sales continue and sync later. Not "100 %": card payments above the CMI offline floor are declined
 *   while offline (cash-only fallback), so the copy promises selling, not every payment method.
 * - darija: the support team speaks Darija (the interface itself is Arabic and French).
 * - data: what is verifiable today (encrypted on the device, no card data ever stored). "Hosted in Morocco" is NOT
 *   claimed: the database and the site are hosted outside Morocco today. Change DATA_HOSTED_IN_MOROCCO only once
 *   that is no longer true.
 */
const DATA_HOSTED_IN_MOROCCO = false;

/*
 * The "multi-screen ecosystem" tile (counter POS + tablet + kitchen display, KDS) was requested by the coordinator
 * (02/11/2026) as a differentiator. No KDS is mentioned anywhere else in this site, its docs or the engineering
 * rules, so this switch must be confirmed before launch: set it to false to remove the tile (and its photos).
 * Wording stays conservative: it names the screens, not capabilities such as automatic order routing.
 *
 * The photos are illustrations (labelled as such): none shows the MAGHAREBIT interface, and none may carry another
 * company's name, logo or contact details.
 */
const SHOW_KDS = true;

/*
 * Law 09-08: the copy says "designed along the principles of", never "compliant" or "certified": no certification or
 * CNDP filing is on record. "Offline first" promises selling without internet, not every payment method (see above).
 */

const COPY: Record<Lang, {
  badge: string; title: string; subtitle: string; more: string;
  tiles: Tile[]; dataMorocco: Tile; offline: { online: string; offline: string; synced: string };
  eco: { illustration: string; pos: string; tablet: string; kds: string; alts: { pos: string; tablet: string; kds: string } };
}> = {
  fr: {
    badge: 'Pourquoi MAGHAREBIT',
    title: 'Pensé pour le commerce au Maroc, pas adapté après coup',
    subtitle: 'Internet qui coupe, paiement en espèces, arabe et français au quotidien : MAGHAREBIT part de la réalité de votre boutique.',
    more: 'En savoir plus',
    tiles: [
      { id: 'offline', title: 'Hors ligne d’abord : la vente ne s’arrête jamais', body: 'Coupure d’internet ? Vous continuez d’encaisser, en espèces notamment, et tout se synchronise tout seul au retour du réseau.' },
      { id: 'checkout', title: 'Encaisser en quelques secondes', body: 'Code-barres, balance, espèces ou QR, et un ticket imprimé à votre nom.' },
      { id: 'whatsapp', title: 'Tickets WhatsApp automatiques', body: 'Le ticket numérique part sur WhatsApp chez votre client, et vos ventes, marge et alertes de stock arrivent chaque soir sur votre téléphone.' },
      { id: 'darija', title: 'Un support qui parle darija', body: 'Une équipe au Maroc qui vous répond dans votre langue, par téléphone ou WhatsApp.' },
      { id: 'nocontract', title: 'Sans engagement, sans surprise', body: 'Pas de contrat à signer, pas de frais cachés. Vous arrêtez quand vous voulez.' },
      { id: 'stock', title: 'Stock et ventes en temps réel', body: 'Chaque vente met le stock à jour. Vous savez ce qui se vend, et ce qu’il faut commander.' },
      { id: 'setup', title: 'Prêt en quelques minutes', body: 'Vous installez, vous ajoutez vos produits, vous vendez. Sans technicien.' },
      { id: 'data', title: 'Conçu selon la loi 09-08', body: 'Données isolées par commerce et chiffrées sur l’appareil, aucune donnée de carte enregistrée : les principes de la loi marocaine 09-08 dès la conception.' },
      { id: 'ecosystem', title: 'Un écosystème multi-écrans : caisse + écran cuisine (KDS)', body: 'Caisse au comptoir, tablette en salle et écran cuisine : chaque écran a son rôle, sur une seule plateforme.' },
    ],
    dataMorocco: { id: 'data', title: 'Vos données restent au Maroc', body: 'Hébergées au Maroc, chiffrées, et aucune donnée de carte bancaire n’est jamais enregistrée.' },
    offline: { online: 'En ligne', offline: 'Hors ligne — la vente continue', synced: 'Synchronisé' },
    eco: { illustration: 'Illustration', pos: 'Caisse', tablet: 'Tablette', kds: 'Écran cuisine (KDS)', alts: { pos: 'Illustration : caisse tactile sur un comptoir de restaurant', tablet: 'Illustration : prise de commande sur tablette', kds: 'Illustration : écran cuisine (KDS) affichant les commandes en cours' } },
  },
  ar: {
    badge: 'لماذا MAGHAREBIT',
    title: 'صُمِّم للتجارة في المغرب، لا مُكيَّف لها لاحقاً',
    subtitle: 'إنترنت ينقطع، دفع نقدي، عربية وفرنسية كل يوم: MAGHAREBIT ينطلق من واقع متجرك.',
    more: 'المزيد',
    tiles: [
      { id: 'offline', title: 'بدون إنترنت أولاً: البيع لا يتوقف أبداً', body: 'انقطع الإنترنت؟ تواصل البيع، نقداً خصوصاً، وتتم المزامنة تلقائياً فور عودة الشبكة.' },
      { id: 'checkout', title: 'الدفع في ثوانٍ', body: 'باركود، ميزان، نقداً أو QR، ووصل مطبوع باسم متجرك.' },
      { id: 'whatsapp', title: 'وصولات واتساب تلقائية', body: 'يصل الوصل الرقمي إلى زبونك على واتساب، وتصلك المبيعات والهامش وتنبيهات المخزون كل مساء على هاتفك.' },
      { id: 'darija', title: 'دعم يتحدث الدارجة', body: 'فريق في المغرب يجيبك بلغتك، عبر الهاتف أو واتساب.' },
      { id: 'nocontract', title: 'بدون التزام، بدون مفاجآت', body: 'لا عقد توقّعه ولا رسوم خفية. توقّف متى شئت.' },
      { id: 'stock', title: 'المخزون والمبيعات لحظة بلحظة', body: 'كل بيع يُحدِّث المخزون. تعرف ما يُباع وما يجب طلبه.' },
      { id: 'setup', title: 'جاهز في دقائق', body: 'ثبّت، أضف منتجاتك، وابدأ البيع. بدون تقني.' },
      { id: 'data', title: 'مصمم وفق القانون 09-08', body: 'بيانات معزولة لكل متجر ومشفّرة على الجهاز، ولا تُحفظ أي بيانات بطاقة: مبادئ القانون المغربي 09-08 منذ التصميم.' },
      { id: 'ecosystem', title: 'منظومة متعددة الشاشات: صندوق + شاشة المطبخ (KDS)', body: 'صندوق على الكونتوار، ولوحة في القاعة، وشاشة للمطبخ: لكل شاشة دورها داخل منصة واحدة.' },
    ],
    dataMorocco: { id: 'data', title: 'بياناتك تبقى في المغرب', body: 'مستضافة في المغرب ومشفّرة، ولا تُحفظ أي بيانات بطاقة بنكية أبداً.' },
    offline: { online: 'متصل', offline: 'بدون إنترنت — البيع مستمر', synced: 'تمت المزامنة' },
    eco: { illustration: 'صورة توضيحية', pos: 'الصندوق', tablet: 'اللوحة', kds: 'شاشة المطبخ (KDS)', alts: { pos: 'صورة توضيحية: صندوق بشاشة لمس على كونتوار مطعم', tablet: 'صورة توضيحية: أخذ طلب على لوحة', kds: 'صورة توضيحية: شاشة مطبخ (KDS) تعرض الطلبات الجارية' } },
  },
  en: {
    badge: 'Why MAGHAREBIT',
    title: 'Built for trade in Morocco, not adapted afterwards',
    subtitle: 'Patchy internet, cash payments, Arabic and French every day: MAGHAREBIT starts from how your shop really works.',
    more: 'Learn more',
    tiles: [
      { id: 'offline', title: 'Offline first: selling never stops', body: 'Internet down? Keep ringing up sales, cash in particular, and everything syncs on its own when the network returns.' },
      { id: 'checkout', title: 'Check out in seconds', body: 'Barcode, scale, cash or QR, and a printed receipt with your name.' },
      { id: 'whatsapp', title: 'Automatic WhatsApp receipts', body: 'The digital receipt goes to your customer on WhatsApp, and your sales, margin and stock alerts reach your phone every evening.' },
      { id: 'darija', title: 'Support that speaks Darija', body: 'A team in Morocco answers in your language, by phone or WhatsApp.' },
      { id: 'nocontract', title: 'No commitment, no surprises', body: 'No contract to sign, no hidden fees. Stop whenever you want.' },
      { id: 'stock', title: 'Real-time stock and sales', body: 'Every sale updates stock. You know what sells and what to reorder.' },
      { id: 'setup', title: 'Ready in minutes', body: 'Install, add your products, start selling. No technician needed.' },
      { id: 'data', title: 'Designed along Law 09-08', body: 'Data isolated per store and encrypted on the device, no card data stored: the principles of Moroccan Law 09-08 from the design stage.' },
      { id: 'ecosystem', title: 'A multi-screen ecosystem: till + kitchen display (KDS)', body: 'A till at the counter, a tablet on the floor and a kitchen display: each screen has its role, on one platform.' },
    ],
    dataMorocco: { id: 'data', title: 'Your data stays in Morocco', body: 'Hosted in Morocco, encrypted, and no card data is ever stored.' },
    offline: { online: 'Online', offline: 'Offline — selling continues', synced: 'Synced' },
    eco: { illustration: 'Illustration', pos: 'Till', tablet: 'Tablet', kds: 'Kitchen display (KDS)', alts: { pos: 'Illustration: touchscreen till on a restaurant counter', tablet: 'Illustration: taking an order on a tablet', kds: 'Illustration: kitchen display (KDS) showing live orders' } },
  },
};

/** Where each tile leads ('#…' = a section of the home page). null = no detail page. */
const TARGET: Record<TileId, string | null> = {
  offline: '/features#offline',
  checkout: '#pos',
  whatsapp: '#reports',
  darija: '/demo',
  nocontract: '/pricing',
  stock: '/features#inventory',
  setup: '/download',
  data: null,
  ecosystem: null,
};

/** Grid placement on lg (12 columns): 7+5 / 4+4+4 / 6+3+3 / 12 (ecosystem). md is 2 columns, the wide visual tiles span both. */
const SPAN: Record<TileId, string> = {
  offline: 'md:col-span-2 lg:col-span-7',
  checkout: 'lg:col-span-5',
  whatsapp: 'lg:col-span-4',
  darija: 'lg:col-span-4',
  nocontract: 'lg:col-span-4',
  stock: 'md:col-span-2 lg:col-span-6',
  setup: 'lg:col-span-3',
  data: 'lg:col-span-3',
  ecosystem: 'md:col-span-2 lg:col-span-12',
};

const ICON: Record<TileId, ReactNode> = {
  offline: <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />,
  checkout: <path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12" />,
  whatsapp: <><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></>,
  darija: <><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3.5-3" /></>,
  nocontract: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 12l6 6M15 12l-6 6" /></>,
  stock: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  setup: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  ecosystem: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  data: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
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
  const base = DATA_HOSTED_IN_MOROCCO ? c.tiles.map((t) => (t.id === 'data' ? c.dataMorocco : t)) : c.tiles;
  const tiles = SHOW_KDS ? base : base.filter((t) => t.id !== 'ecosystem');

  const visual = (id: TileId): ReactNode => {
    if (id === 'offline') return <OfflineDemo labels={c.offline} />;
    if (id === 'checkout') return <ReceiptScreen lang={lang} />;
    if (id === 'stock') return <DashboardScreen lang={lang} compact />;
    if (id === 'whatsapp') return <WhatsAppBubbles />;
    return null;
  };

  return (
    // id="products" keeps the navbar's /#products anchor working.
    <section
      id="products"
      aria-labelledby="bento-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} relative scroll-mt-20 overflow-hidden bg-[#F8F9FA] px-4 py-16 sm:px-6 md:py-24`}
    >
      {/* light section of the white / green / gold rhythm (same language as /about): green zellige watermark, gold badge */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#0F3D2A] opacity-[0.035] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
      <div className="relative mx-auto max-w-[1100px]">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#B8860B]/40 bg-[#F0B429]/10 px-4 py-1.5 text-sm font-semibold text-[#8A6508]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#B8860B]" fill="currentColor"><path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" /></svg>
            {c.badge}
          </span>
          <h2 id="bento-heading" className={`${isRTL ? 'font-arabic' : 'font-display'} mb-3 text-balance font-bold text-[#111827]`} style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}>
            {c.title}
          </h2>
          <p className="mx-auto max-w-[640px] text-base leading-[1.8] text-[#6B7280]">{c.subtitle}</p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
          {tiles.map((tile) => {
            const v = visual(tile.id);
            const target = TARGET[tile.id];
            const href = target === null ? null : target.startsWith('#') ? target : `/${locale}${target}`;
            const inner = (
              <>
                {tile.id === 'ecosystem' && (
                  <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([['pos', '/media/pos-restaurant.jpg'], ['tablet', '/media/pos-tablet.jpg'], ['kds', '/media/kds-kitchen.jpg']] as const).map(([k, src]) => (
                      <figure key={k} className="group/img relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#E5E7EB] shadow-xl transition-colors duration-200 hover:border-[#B8860B]/70">
                        <Image src={src} alt={c.eco.alts[k]} fill sizes="(min-width: 1100px) 340px, (min-width: 640px) 30vw, 92vw" className="object-cover" />
                        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0A2318]/75 via-transparent to-transparent" />
                        <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3 text-sm font-semibold text-white">
                          <span>{c.eco[k]}</span>
                          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/80">{c.eco.illustration}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {v && (
                  <div aria-hidden="true" className="relative mb-5 flex h-40 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-900 to-brand-950 ring-1 ring-white/5 sm:h-44">
                    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 55%, rgba(240,180,41,0.14), transparent 70%)' }} />
                    {/* the dashboard screen fills the plate; the other visuals keep a small inset */}
                    <div className={`relative h-full w-full ${tile.id === 'stock' ? '!absolute inset-3 !h-auto !w-auto overflow-hidden rounded-lg ring-1 ring-white/10' : 'p-3'}`}>{v}</div>
                  </div>
                )}
                <span aria-hidden="true" className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#0F3D2A] text-gold-400 transition-colors group-hover:bg-[#145236]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[tile.id]}</svg>
                </span>
                <h3 className="mb-1.5 text-lg font-bold text-[#111827]">{tile.title}</h3>
                <p className="flex-1 text-sm leading-[1.7] text-[#6B7280]">{tile.body}</p>
                {href && (
                  <span className="mt-4 text-sm font-semibold text-[#8A6508] transition-colors group-hover:text-[#0F3D2A]">
                    {c.more}
                    <span aria-hidden="true" className="ms-1 inline-block transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">→</span>
                  </span>
                )}
              </>
            );
            const box = 'group flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(10,35,24,0.06)] sm:p-6';
            return (
              <li key={tile.id} className={SPAN[tile.id]}>
                {href ? (
                  <a
                    href={href}
                    className={`${box} transition-[border-color,box-shadow] duration-200 hover:border-[#B8860B]/60 hover:shadow-[0_12px_32px_rgba(10,35,24,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B]`}
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
