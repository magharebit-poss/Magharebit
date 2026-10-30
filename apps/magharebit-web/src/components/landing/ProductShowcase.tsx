'use client';

import DeviceFrame from './DeviceFrame';
import { useLang, type Lang } from './useLang';
import type { ScreenId } from '@/content/media';

type RowId = 'pos' | 'tablet' | 'mobile' | 'backoffice';

interface Row {
  id: RowId;
  screen: ScreenId;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  link: { label: string; path: string };
}

const COPY: Record<Lang, { badge: string; title: string; subtitle: string; rows: Row[] }> = {
  ar: {
    badge: 'المنتج',
    title: 'صندوق واحد، على كل شاشة في متجرك',
    subtitle: 'نفس المنتجات ونفس الأسعار على الصندوق واللوحة والهاتف، وكل شيء يُدار من بوابة واحدة.',
    rows: [
      {
        id: 'pos', screen: 'pos-sale', kicker: 'على المنضدة',
        title: 'صندوق سريع لساعات الذروة',
        body: 'شاشة لمس كبيرة مع قارئ باركود وميزان وطابعة وصل، لبيع بدون انتظار.',
        points: ['مسح الباركود والوزن تلقائياً', 'نقد، بطاقة أو QR', 'وصل 80 مم باسم متجرك'],
        link: { label: 'المعدات المدعومة', path: '/materiel' },
      },
      {
        id: 'tablet', screen: 'tablet-order', kicker: 'في القاعة',
        title: 'خذ الطلبات بين الطاولات',
        body: 'لوحة خفيفة للنادل أو للبيع في المحل، متصلة بنفس الصندوق.',
        points: ['نفس القائمة والأسعار', 'الطلب يصل مباشرة إلى الصندوق', 'يعمل بدون إنترنت'],
        link: { label: 'تحميل التطبيق', path: '/download' },
      },
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'في جيبك',
        title: 'البيع والمتابعة من الهاتف',
        body: 'تطبيق أندرويد للبيع المتنقل أو للمحلات الصغيرة، وأرقام اليوم أينما كنت.',
        points: ['بيع كامل من الهاتف', 'مبيعات اليوم في لمحة', 'تقرير يومي على واتساب'],
        link: { label: 'تحميل تطبيق أندرويد', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'من أي حاسوب',
        title: 'بوابة التاجر لإدارة كل شيء',
        body: 'المنتجات والمخزون والموظفون والتقارير، من المتصفح، بدون تثبيت.',
        points: ['المنتجات والأسعار والمخزون', 'الموظفون والصلاحيات', 'تقارير المبيعات والعملاء'],
        link: { label: 'كل الميزات', path: '/features' },
      },
    ],
  },
  fr: {
    badge: 'Le produit',
    title: 'Une seule caisse, sur chaque écran de votre commerce',
    subtitle: 'Les mêmes produits et les mêmes prix sur la caisse, la tablette et le téléphone, le tout géré depuis un seul portail.',
    rows: [
      {
        id: 'pos', screen: 'pos-sale', kicker: 'Au comptoir',
        title: 'Une caisse rapide pour les heures de pointe',
        body: 'Grand écran tactile avec lecteur code-barres, balance et imprimante de tickets, pour encaisser sans attente.',
        points: ['Scan et pesée automatiques', 'Espèces, carte ou QR', 'Ticket 80 mm à votre nom'],
        link: { label: 'Matériel compatible', path: '/materiel' },
      },
      {
        id: 'tablet', screen: 'tablet-order', kicker: 'En salle',
        title: 'Prenez les commandes entre les tables',
        body: 'Une tablette légère pour le serveur ou la vente en boutique, reliée à la même caisse.',
        points: ['Même carte, mêmes prix', 'La commande arrive à la caisse', 'Fonctionne sans internet'],
        link: { label: 'Télécharger l’application', path: '/download' },
      },
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'Dans votre poche',
        title: 'Vendre et suivre depuis le téléphone',
        body: 'Une application Android pour la vente mobile ou les petits espaces, et vos chiffres du jour partout.',
        points: ['Vente complète sur téléphone', 'Les ventes du jour en un coup d’œil', 'Rapport quotidien sur WhatsApp'],
        link: { label: 'Télécharger pour Android', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'Depuis n’importe quel ordinateur',
        title: 'Le portail commerçant pour tout gérer',
        body: 'Produits, stock, équipe et rapports, dans le navigateur, sans installation.',
        points: ['Produits, prix et stock', 'Employés et droits d’accès', 'Rapports de ventes et clients'],
        link: { label: 'Toutes les fonctionnalités', path: '/features' },
      },
    ],
  },
  en: {
    badge: 'The product',
    title: 'One till, on every screen in your shop',
    subtitle: 'The same products and prices on the till, the tablet and the phone, all managed from one portal.',
    rows: [
      {
        id: 'pos', screen: 'pos-sale', kicker: 'At the counter',
        title: 'A fast till for the rush hour',
        body: 'A large touchscreen with barcode scanner, scale and receipt printer, so nobody waits.',
        points: ['Automatic scan and weighing', 'Cash, card or QR', '80 mm receipt with your name'],
        link: { label: 'Supported hardware', path: '/materiel' },
      },
      {
        id: 'tablet', screen: 'tablet-order', kicker: 'On the floor',
        title: 'Take orders between the tables',
        body: 'A light tablet for waiters or in-store selling, linked to the same till.',
        points: ['Same menu, same prices', 'Orders go straight to the till', 'Works without internet'],
        link: { label: 'Download the app', path: '/download' },
      },
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'In your pocket',
        title: 'Sell and follow from your phone',
        body: 'An Android app for mobile selling or small spaces, and today’s figures wherever you are.',
        points: ['Full sales on the phone', 'Today’s sales at a glance', 'Daily report on WhatsApp'],
        link: { label: 'Download for Android', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'From any computer',
        title: 'The merchant portal to run it all',
        body: 'Products, stock, team and reports, in the browser, nothing to install.',
        points: ['Products, prices and stock', 'Staff and access rights', 'Sales and customer reports'],
        link: { label: 'All features', path: '/features' },
      },
    ],
  },
};

/**
 * Alternating feature rows, each with its device mock-up. DOM order is text first; sides swap visually on md+.
 * `currentPath` (e.g. '/features') drops a row link that would point at the page it is shown on.
 */
export default function ProductShowcase({ currentPath }: { currentPath?: string } = {}) {
  const { lang, isRTL, locale } = useLang();
  const c = COPY[lang];

  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} scroll-mt-20 bg-brand-900 px-4 py-16 sm:px-6 md:py-24`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2 id="showcase-heading" className="mb-3 font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}>
            {c.title}
          </h2>
          <p className="mx-auto max-w-[620px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        <div className="space-y-16 md:space-y-28">
          {c.rows.map((r, i) => (
            <article key={r.id} id={r.id} className="grid scroll-mt-24 grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-14">
              <div className={`md:col-span-5 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                {/* letter-spacing would break the joins between Arabic letters */}
                <p className={`mb-2 text-sm font-semibold text-gold-400 ${isRTL ? '' : 'uppercase tracking-wide'}`}>{r.kicker}</p>
                <h3 className="mb-3 text-2xl font-bold leading-snug text-white md:text-[1.75rem]">{r.title}</h3>
                <p className="mb-5 text-base leading-[1.8] text-white/70">{r.body}</p>
                <ul className="mb-6 space-y-2.5">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] text-white/85">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F0B429" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
                      {p}
                    </li>
                  ))}
                </ul>
                {r.link.path !== currentPath && (
                  <a
                    href={`/${locale}${r.link.path}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold text-gold-400 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
                  >
                    {r.link.label}
                    <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
                  </a>
                )}
              </div>
              <div className={`relative md:col-span-7 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                <div aria-hidden="true" className="pointer-events-none absolute inset-[8%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(240,180,41,0.16), transparent 70%)', filter: 'blur(20px)' }} />
                <div className="relative">
                  <DeviceFrame screen={r.screen} lang={lang} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
