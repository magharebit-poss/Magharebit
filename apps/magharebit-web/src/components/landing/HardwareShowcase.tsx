'use client';

import { useState } from 'react';
import MediaFrame from './MediaFrame';
import { DesktopIllustration, MobileIllustration, PrinterIllustration } from './illustrations';
import { useLang, type Lang } from './useLang';

type SectorId = 'bakery' | 'cafe' | 'grocery';

interface Copy {
  badge: string;
  title: string;
  subtitle: string;
  sectorsLabel: string;
  sectors: Record<SectorId, { name: string; text: string }>;
  devices: { id: 'R1' | 'R2' | 'R3'; name: string; text: string; label: string }[];
  note: string;
  link: string;
}

const COPY: Record<Lang, Copy> = {
  ar: {
    badge: 'المعدات',
    title: 'يعمل مع معدات متجرك',
    subtitle: 'شاشة، هاتف أو طابعة: اختر ما يناسب مساحتك وميزانيتك.',
    sectorsLabel: 'نوع المتجر',
    sectors: {
      bakery: { name: 'مخبزة', text: 'صندوق على المنضدة مع طابعة وصل، لسرعة البيع وقت الذروة.' },
      cafe: { name: 'مقهى', text: 'هاتف أو لوحة للنادل لأخذ الطلبات بين الطاولات، ووصل عند الصندوق.' },
      grocery: { name: 'بقالة', text: 'قارئ باركود وميزان متصلان بالصندوق لتسعير الوزن تلقائياً.' },
    },
    devices: [
      { id: 'R1', name: 'صندوق مكتبي', text: 'شاشة لمس على المنضدة للمتاجر ذات الحركة الكثيفة.', label: 'رسم توضيحي لصندوق مكتبي' },
      { id: 'R2', name: 'هاتف أو لوحة', text: 'للبيع المتنقل أو المساحات الصغيرة.', label: 'رسم توضيحي لهاتف نقطة بيع' },
      { id: 'R3', name: 'طابعة حرارية 80 مم', text: 'تتوافق مع طابعات Epson وStar وXprinter وBixolon.', label: 'رسم توضيحي لطابعة حرارية' },
    ],
    note: 'التوافق حسب الطراز. راجع قائمة المعدات المدعومة.',
    link: 'قائمة المعدات المدعومة',
  },
  fr: {
    badge: 'Matériel',
    title: 'Compatible avec le matériel de votre boutique',
    subtitle: 'Écran, téléphone ou imprimante : choisissez selon votre espace et votre budget.',
    sectorsLabel: 'Type de commerce',
    sectors: {
      bakery: { name: 'Boulangerie', text: 'Caisse au comptoir avec imprimante de tickets pour tenir le rythme aux heures de pointe.' },
      cafe: { name: 'Café', text: 'Téléphone ou tablette pour prendre les commandes en salle, ticket à la caisse.' },
      grocery: { name: 'Épicerie', text: 'Lecteur code-barres et balance reliés à la caisse pour le prix au poids.' },
    },
    devices: [
      { id: 'R1', name: 'Caisse de comptoir', text: 'Écran tactile sur le comptoir pour les commerces à fort passage.', label: 'Illustration d’une caisse de comptoir' },
      { id: 'R2', name: 'Téléphone ou tablette', text: 'Pour la vente mobile ou les petits espaces.', label: 'Illustration d’un téléphone caisse' },
      { id: 'R3', name: 'Imprimante thermique 80 mm', text: 'Compatible avec les imprimantes Epson, Star, Xprinter et Bixolon.', label: 'Illustration d’une imprimante thermique' },
    ],
    note: 'La compatibilité dépend du modèle. Consultez la liste du matériel pris en charge.',
    link: 'Voir le matériel pris en charge',
  },
  en: {
    badge: 'Hardware',
    title: 'Works with your shop’s equipment',
    subtitle: 'Screen, phone or printer: choose what fits your space and budget.',
    sectorsLabel: 'Type of shop',
    sectors: {
      bakery: { name: 'Bakery', text: 'A counter till with a receipt printer to keep up at peak hours.' },
      cafe: { name: 'Café', text: 'A phone or tablet to take orders on the floor, receipt at the till.' },
      grocery: { name: 'Grocery', text: 'Barcode scanner and scale linked to the till for price-by-weight.' },
    },
    devices: [
      { id: 'R1', name: 'Counter till', text: 'A touchscreen on the counter for busy shops.', label: 'Illustration of a counter till' },
      { id: 'R2', name: 'Phone or tablet', text: 'For mobile selling or small spaces.', label: 'Illustration of a phone POS' },
      { id: 'R3', name: '80 mm thermal printer', text: 'Works with Epson, Star, Xprinter and Bixolon printers.', label: 'Illustration of a thermal printer' },
    ],
    note: 'Compatibility depends on the model. See the supported-hardware list.',
    link: 'See supported hardware',
  },
};

const ILLUSTRATION = {
  R1: DesktopIllustration,
  R2: MobileIllustration,
  R3: PrinterIllustration,
} as const;

export default function HardwareShowcase() {
  const { lang, isRTL, locale } = useLang();
  const c = COPY[lang];
  const [sector, setSector] = useState<SectorId>('bakery');
  const ids = Object.keys(c.sectors) as SectorId[];

  return (
    <section
      id="hardware"
      aria-labelledby="hardware-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} scroll-mt-20 bg-brand-950 px-4 py-16 sm:px-6 md:py-24`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2
            id="hardware-heading"
            className="mb-3 font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}
          >
            {c.title}
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        {/* Sector selector */}
        <div role="group" aria-label={c.sectorsLabel} className="mb-4 flex flex-wrap justify-center gap-2">
          {ids.map((id) => {
            const active = id === sector;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setSector(id)}
                className={`min-h-[48px] rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 ${
                  active
                    ? 'border-gold-400 bg-gold-400 text-brand-950'
                    : 'border-white/20 text-white/80 hover:border-white/40'
                }`}
              >
                {c.sectors[id].name}
              </button>
            );
          })}
        </div>
        <p aria-live="polite" className="mx-auto mb-10 min-h-[3.5rem] max-w-[560px] text-center text-base leading-[1.8] text-white/80">
          {c.sectors[sector].text}
        </p>

        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {c.devices.map((d) => {
            const Illustration = ILLUSTRATION[d.id];
            return (
              <li key={d.id} className="rounded-2xl border border-white/10 bg-brand-900/50 p-4">
                <MediaFrame mediaId={d.id} aspect="4/3" label={d.label}>
                  <Illustration />
                </MediaFrame>
                <h3 className="mb-1 mt-4 text-lg font-bold text-white">{d.name}</h3>
                <p className="text-sm leading-[1.7] text-white/65">{d.text}</p>
              </li>
            );
          })}
        </ul>

        <p className="mt-8 text-center text-sm text-white/60">
          {c.note}{' '}
          <a
            href={`/${locale}/materiel`}
            className="font-semibold text-[#F0B429] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            {c.link}
          </a>
        </p>
      </div>
    </section>
  );
}
