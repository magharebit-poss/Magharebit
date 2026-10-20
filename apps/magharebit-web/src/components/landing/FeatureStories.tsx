'use client';

import type { ReactNode } from 'react';
import MediaFrame from './MediaFrame';
import { InsightsIllustration, ReceiptIllustration, ScanIllustration } from './illustrations';
import { useLang, type Lang } from './useLang';

interface Story {
  id: 'checkout' | 'receipt' | 'insights' | 'offline';
  media: string;
  title: string;
  body: string;
  points: string[];
  mediaLabel: string;
}

interface Copy {
  badge: string;
  title: string;
  subtitle: string;
  stories: Story[];
  offline: { online: string; offline: string; synced: string };
}

const COPY: Record<Lang, Copy> = {
  ar: {
    badge: 'كيف يعمل',
    title: 'أربع لحظات في يوم تاجر',
    subtitle: 'من الصندوق إلى نهاية اليوم، كل خطوة مصممة لتكون واضحة وسريعة.',
    stories: [
      {
        id: 'checkout', media: 'C1',
        title: 'الدفع في ثوانٍ',
        body: 'امسح الباركود أو ضع المنتج على الميزان، ويُحتسب السعر تلقائياً.',
        points: ['قارئ باركود وميزان متصلان', 'أسعار بالدرهم، أرقام واضحة', 'نقد، بطاقة أو QR'],
        mediaLabel: 'رسم توضيحي لمسح باركود منتج عند الصندوق',
      },
      {
        id: 'receipt', media: 'C2',
        title: 'وصل مطبوع باسم متجرك',
        body: 'طابعة حرارية 80 مم، وصل واضح بالعربية والفرنسية.',
        points: ['شعار متجرك في أعلى الوصل', 'طباعة سريعة بدون حبر', 'نسخة رقمية عند الطلب'],
        mediaLabel: 'رسم توضيحي لوصل حراري مطبوع',
      },
      {
        id: 'insights', media: 'C3',
        title: 'افهم ما يباع فعلاً',
        body: 'لوحة بسيطة تعرض المبيعات حسب اليوم والمنتج، دون جداول معقدة.',
        points: ['المنتجات الأكثر مبيعاً', 'مقارنة الأيام والأسابيع', 'تنبيه عند اقتراب نفاد المخزون'],
        mediaLabel: 'رسم توضيحي لرسم بياني للمبيعات',
      },
      {
        id: 'offline', media: 'D1',
        title: 'لا يتوقف البيع إذا انقطع الإنترنت',
        body: 'يسجل النظام العمليات محلياً ثم يزامنها تلقائياً عند عودة الاتصال.',
        points: ['العمل مستمر بدون اتصال', 'مزامنة تلقائية', 'لا حاجة لأي إجراء من الكاشير'],
        mediaLabel: 'رسم متحرك يوضح الانتقال من الاتصال إلى عدم الاتصال ثم المزامنة',
      },
    ],
    offline: { online: 'متصل', offline: 'بدون إنترنت — البيع مستمر', synced: 'تمت المزامنة' },
  },
  fr: {
    badge: 'Comment ça marche',
    title: 'Quatre moments d’une journée de commerçant',
    subtitle: 'De la caisse à la clôture, chaque étape est pensée pour être claire et rapide.',
    stories: [
      {
        id: 'checkout', media: 'C1',
        title: 'Encaisser en quelques secondes',
        body: 'Scannez le code-barres ou posez le produit sur la balance : le prix se calcule seul.',
        points: ['Lecteur code-barres et balance connectés', 'Prix en dirhams, chiffres lisibles', 'Espèces, carte ou QR'],
        mediaLabel: 'Illustration d’un scan de code-barres à la caisse',
      },
      {
        id: 'receipt', media: 'C2',
        title: 'Un ticket à l’image de votre boutique',
        body: 'Imprimante thermique 80 mm, ticket clair en arabe et en français.',
        points: ['Votre logo en haut du ticket', 'Impression rapide, sans encre', 'Version numérique sur demande'],
        mediaLabel: 'Illustration d’un ticket thermique imprimé',
      },
      {
        id: 'insights', media: 'C3',
        title: 'Comprendre ce qui se vend vraiment',
        body: 'Un tableau simple des ventes par jour et par produit, sans tableur compliqué.',
        points: ['Produits les plus vendus', 'Comparaison jours et semaines', 'Alerte avant la rupture de stock'],
        mediaLabel: 'Illustration d’un graphique de ventes',
      },
      {
        id: 'offline', media: 'D1',
        title: 'La vente ne s’arrête pas sans internet',
        body: 'Le système enregistre localement puis synchronise automatiquement au retour du réseau.',
        points: ['Travail continu hors ligne', 'Synchronisation automatique', 'Rien à faire côté caissier'],
        mediaLabel: 'Animation : passage de en ligne à hors ligne puis synchronisation',
      },
    ],
    offline: { online: 'En ligne', offline: 'Hors ligne — la vente continue', synced: 'Synchronisé' },
  },
  en: {
    badge: 'How it works',
    title: 'Four moments in a shopkeeper’s day',
    subtitle: 'From the till to closing time, every step is built to be clear and fast.',
    stories: [
      {
        id: 'checkout', media: 'C1',
        title: 'Check out in seconds',
        body: 'Scan the barcode or place the item on the scale and the price works itself out.',
        points: ['Barcode scanner and scale connected', 'Prices in dirhams, easy-to-read figures', 'Cash, card or QR'],
        mediaLabel: 'Illustration of a product barcode being scanned at the till',
      },
      {
        id: 'receipt', media: 'C2',
        title: 'A receipt that looks like your shop',
        body: '80 mm thermal printer, clear receipts in Arabic and French.',
        points: ['Your logo at the top of the receipt', 'Fast, inkless printing', 'Digital copy on request'],
        mediaLabel: 'Illustration of a printed thermal receipt',
      },
      {
        id: 'insights', media: 'C3',
        title: 'See what actually sells',
        body: 'A simple view of sales by day and by product, no complicated spreadsheets.',
        points: ['Best-selling products', 'Day and week comparisons', 'Alert before you run out of stock'],
        mediaLabel: 'Illustration of a sales chart',
      },
      {
        id: 'offline', media: 'D1',
        title: 'Selling doesn’t stop when the internet does',
        body: 'The system records sales locally, then syncs automatically when the network returns.',
        points: ['Keeps working offline', 'Automatic sync', 'Nothing for the cashier to do'],
        mediaLabel: 'Animation: from online to offline, then synced',
      },
    ],
    offline: { online: 'Online', offline: 'Offline — selling continues', synced: 'Synced' },
  },
};

function OfflineDemo({ labels }: { labels: Copy['offline'] }) {
  const states: { text: string; color: string }[] = [
    { text: labels.online, color: '#5EC485' },
    { text: labels.offline, color: '#F0B429' },
    { text: labels.synced, color: '#5EC485' },
  ];
  return (
    <div className="relative h-full w-full">
      {states.map((s, i) => (
        <div key={i} className="offline-demo__state">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full"
            style={{ background: s.color, boxShadow: `0 0 0 8px ${s.color}22` }}
          />
          <span className="px-4 text-center text-base font-bold text-white sm:text-lg">{s.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function FeatureStories() {
  const { lang, isRTL } = useLang();
  const c = COPY[lang];

  const visual = (s: Story): ReactNode => {
    if (s.id === 'checkout') return <ScanIllustration />;
    if (s.id === 'receipt') return <ReceiptIllustration />;
    if (s.id === 'insights') return <InsightsIllustration />;
    return <OfflineDemo labels={c.offline} />;
  };

  return (
    <section
      aria-labelledby="stories-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} bg-brand-900 px-4 py-16 sm:px-6 md:py-24`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2
            id="stories-heading"
            className="mb-3 font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}
          >
            {c.title}
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        <div className="space-y-16 md:space-y-24">
          {c.stories.map((s, i) => (
            <article
              key={s.id}
              id={s.id}
              className="grid scroll-mt-24 grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-14"
            >
              {/* Alternate sides on md+; DOM order stays text-first for screen readers. */}
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <h3 className="mb-3 text-2xl font-bold text-white">{s.title}</h3>
                <p className="mb-5 text-base leading-[1.8] text-white/70">{s.body}</p>
                <ul className="space-y-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-white/85">
                      <span aria-hidden="true" className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                <MediaFrame mediaId={s.media} label={s.mediaLabel}>
                  {visual(s)}
                </MediaFrame>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
