'use client';

import DeviceFrame from './DeviceFrame';
import { useLang, type Lang } from './useLang';
import type { ScreenId } from '@/content/media';

// Row ids are page anchors (#mobile, #backoffice, #pos, #engagement); the bento links to #pos.
type RowId = 'mobile' | 'backoffice' | 'pos' | 'engagement';

interface Row {
  id: RowId;
  screen: ScreenId;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  link: { label: string; path: string };
}

// Order requested by the coordinator (30/10/2026): phone, portal, till, customer engagement.
// Engagement = what exists: WhatsApp receipts to customers and WhatsApp campaigns (portal → Marketing).
// SMS is only used for sign-in codes today, so it is not promised here.
const COPY: Record<Lang, { badge: string; title: string; subtitle: string; rows: Row[] }> = {
  fr: {
    badge: 'Le produit',
    title: 'Toute votre boutique, sur chaque écran',
    subtitle: 'Les mêmes produits, les mêmes prix et les mêmes chiffres sur le téléphone, le portail et la caisse.',
    rows: [
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'Dans votre poche',
        title: 'Votre boutique sur votre téléphone',
        body: 'Vendez, vérifiez le stock et suivez le chiffre du jour depuis l’application Android, que vous soyez au comptoir ou au souk.',
        points: ['Vente complète sur téléphone', 'Le chiffre du jour en un coup d’œil', 'Alerte quand un produit va manquer'],
        link: { label: 'Télécharger pour Android', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'Depuis n’importe quel ordinateur',
        title: 'Le portail qui vous montre où va l’argent',
        body: 'Ventes par jour, meilleures ventes, panier moyen, stock bas : tout votre commerce dans le navigateur, sans rien installer.',
        points: ['Produits, prix et stock', 'Employés et droits d’accès', 'Rapports de ventes et clients'],
        link: { label: 'Toutes les fonctionnalités', path: '/features' },
      },
      {
        id: 'pos', screen: 'pos-sale', kicker: 'Au comptoir',
        title: 'Une caisse rapide, même quand internet coupe',
        body: 'Grand écran tactile, lecteur code-barres, balance et imprimante de tickets. La file avance, la connexion peut attendre.',
        points: ['Scan et pesée automatiques', 'Espèces, carte ou QR', 'Ticket 80 mm à votre nom'],
        link: { label: 'Matériel compatible', path: '/materiel' },
      },
      {
        id: 'engagement', screen: 'phone-whatsapp', kicker: 'Vos clients',
        title: 'Restez proche de vos clients sur WhatsApp',
        body: 'Le ticket arrive sur le WhatsApp du client après l’achat, et vos offres partent en quelques clics vers ceux qui reviennent.',
        points: ['Ticket numérique sur WhatsApp', 'Offres et nouveautés à vos clients', 'Votre fichier clients dans le portail'],
        link: { label: 'Découvrir les rapports WhatsApp', path: '/features#whatsapp' },
      },
    ],
  },
  ar: {
    badge: 'المنتج',
    title: 'متجرك بالكامل، على كل شاشة',
    subtitle: 'نفس المنتجات ونفس الأسعار ونفس الأرقام على الهاتف والبوابة والصندوق.',
    rows: [
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'في جيبك',
        title: 'متجرك على هاتفك',
        body: 'بِع، راقب المخزون وتابع مداخيل اليوم من تطبيق أندرويد، سواء كنت عند الصندوق أو في السوق.',
        points: ['بيع كامل من الهاتف', 'مداخيل اليوم في لمحة', 'تنبيه عندما يقترب منتج من النفاد'],
        link: { label: 'تحميل تطبيق أندرويد', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'من أي حاسوب',
        title: 'البوابة التي تريك أين يذهب مالك',
        body: 'المبيعات اليومية، الأكثر مبيعاً، متوسط السلة، المخزون المنخفض: تجارتك كلها في المتصفح، دون تثبيت أي شيء.',
        points: ['المنتجات والأسعار والمخزون', 'الموظفون والصلاحيات', 'تقارير المبيعات والعملاء'],
        link: { label: 'كل الميزات', path: '/features' },
      },
      {
        id: 'pos', screen: 'pos-sale', kicker: 'على المنضدة',
        title: 'صندوق سريع، حتى عندما ينقطع الإنترنت',
        body: 'شاشة لمس كبيرة، قارئ باركود، ميزان وطابعة وصل. الطابور يتقدّم، والاتصال يمكنه الانتظار.',
        points: ['مسح الباركود والوزن تلقائياً', 'نقداً، بالبطاقة أو QR', 'وصل 80 مم باسم متجرك'],
        link: { label: 'المعدات المدعومة', path: '/materiel' },
      },
      {
        id: 'engagement', screen: 'phone-whatsapp', kicker: 'زبائنك',
        title: 'ابقَ قريباً من زبائنك على واتساب',
        body: 'يصل الوصل إلى واتساب الزبون بعد الشراء، وتنطلق عروضك في نقرات إلى من يعودون إليك.',
        points: ['وصل رقمي على واتساب', 'عروض ومستجدات لزبائنك', 'قائمة زبائنك في البوابة'],
        link: { label: 'اكتشف تقارير واتساب', path: '/features#whatsapp' },
      },
    ],
  },
  en: {
    badge: 'The product',
    title: 'Your whole shop, on every screen',
    subtitle: 'The same products, prices and figures on the phone, the portal and the till.',
    rows: [
      {
        id: 'mobile', screen: 'phone-pos', kicker: 'In your pocket',
        title: 'Your shop on your phone',
        body: 'Sell, check stock and follow today’s takings from the Android app, at the counter or at the market.',
        points: ['Full sales on the phone', 'Today’s takings at a glance', 'Alert when a product runs low'],
        link: { label: 'Download for Android', path: '/download' },
      },
      {
        id: 'backoffice', screen: 'portal-dashboard', kicker: 'From any computer',
        title: 'The portal that shows where the money goes',
        body: 'Daily sales, best sellers, average basket, low stock: your whole business in the browser, nothing to install.',
        points: ['Products, prices and stock', 'Staff and access rights', 'Sales and customer reports'],
        link: { label: 'All features', path: '/features' },
      },
      {
        id: 'pos', screen: 'pos-sale', kicker: 'At the counter',
        title: 'A fast till, even when the internet drops',
        body: 'Large touchscreen, barcode scanner, scale and receipt printer. The queue keeps moving; the connection can wait.',
        points: ['Automatic scan and weighing', 'Cash, card or QR', '80 mm receipt with your name'],
        link: { label: 'Supported hardware', path: '/materiel' },
      },
      {
        id: 'engagement', screen: 'phone-whatsapp', kicker: 'Your customers',
        title: 'Stay close to your customers on WhatsApp',
        body: 'The receipt lands in the customer’s WhatsApp after the sale, and your offers reach returning customers in a few clicks.',
        points: ['Digital receipt on WhatsApp', 'Offers and news for your customers', 'Your customer list in the portal'],
        link: { label: 'See WhatsApp reports', path: '/features#whatsapp' },
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
