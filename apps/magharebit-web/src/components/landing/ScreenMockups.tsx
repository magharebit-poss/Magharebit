import type { Lang } from './useLang';

/**
 * Illustrative product screens drawn with HTML/Tailwind, shown inside DeviceFrame until real screenshots exist
 * (src/content/media.ts). Sizes use container-query units (cqw) so each screen scales with its frame and stays
 * sharp at any width. Demo data only: generic products, no brands, no real merchant figures.
 * Western digits everywhere (design system), Arabic labels RTL.
 */

type Money = (n: number) => string;
const money: Record<Lang, Money> = {
  fr: (n) => `${n.toFixed(2).replace('.', ',')} MAD`,
  en: (n) => `${n.toFixed(2)} MAD`,
  ar: (n) => `${n.toFixed(2)} درهم`,
};

const CQ = { containerType: 'inline-size' } as const;

// ── Shared bits ───────────────────────────────────────────────────────────────

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-[1.2cqw]">
      <span className={`grid place-items-center rounded-[1cqw] bg-gradient-to-br from-gold-400 to-[#D99A12] font-extrabold text-brand-950 ${small ? 'h-[3.4cqw] w-[3.4cqw] text-[1.8cqw]' : 'h-[4cqw] w-[4cqw] text-[2.2cqw]'}`}>M</span>
      <span className={`font-bold text-white ${small ? 'text-[1.9cqw]' : 'text-[2.2cqw]'}`}>MAGHAREBIT</span>
    </span>
  );
}

function Dot({ online = true }: { online?: boolean }) {
  return <span className={`inline-block h-[1.2cqw] w-[1.2cqw] rounded-full ${online ? 'bg-[#5EC485] shadow-[0_0_0_0.5cqw_rgba(94,196,133,0.25)]' : 'bg-gold-400'}`} />;
}

// ── 1. Checkout (desktop till / tablet order) ────────────────────────────────

const CHECKOUT: Record<Lang, {
  search: string; cats: string[]; ticket: string; table: string; sub: string; vat: string; total: string; pay: string; cash: string; card: string; qr: string; online: string;
  shop: { name: string; price: number }[]; cafe: { name: string; price: number }[];
}> = {
  fr: {
    search: 'Rechercher ou scanner…', cats: ['Tout', 'Épicerie', 'Frais', 'Boissons'], ticket: 'Ticket n° 0132', table: 'Table 4',
    sub: 'Sous-total', vat: 'TVA', total: 'Total', pay: 'Payer', cash: 'Espèces', card: 'Carte', qr: 'QR', online: 'En ligne',
    shop: [{ name: 'Lait frais 1 L', price: 7 }, { name: 'Thé vert 200 g', price: 18.5 }, { name: 'Huile d’olive 1 L', price: 62 }, { name: 'Pain complet', price: 3.5 }, { name: 'Sucre 1 kg', price: 9.5 }, { name: 'Œufs ×12', price: 16 }, { name: 'Dattes 500 g', price: 25 }, { name: 'Eau 1,5 L', price: 6 }],
    cafe: [{ name: 'Thé à la menthe', price: 12 }, { name: 'Café noir', price: 10 }, { name: 'Msemen', price: 6 }, { name: 'Jus d’orange', price: 15 }, { name: 'Harcha', price: 5 }, { name: 'Croissant', price: 7 }, { name: 'Café crème', price: 14 }, { name: 'Eau minérale', price: 6 }],
  },
  en: {
    search: 'Search or scan…', cats: ['All', 'Grocery', 'Fresh', 'Drinks'], ticket: 'Receipt #0132', table: 'Table 4',
    sub: 'Subtotal', vat: 'VAT', total: 'Total', pay: 'Pay', cash: 'Cash', card: 'Card', qr: 'QR', online: 'Online',
    shop: [{ name: 'Fresh milk 1 L', price: 7 }, { name: 'Green tea 200 g', price: 18.5 }, { name: 'Olive oil 1 L', price: 62 }, { name: 'Wholemeal bread', price: 3.5 }, { name: 'Sugar 1 kg', price: 9.5 }, { name: 'Eggs ×12', price: 16 }, { name: 'Dates 500 g', price: 25 }, { name: 'Water 1.5 L', price: 6 }],
    cafe: [{ name: 'Mint tea', price: 12 }, { name: 'Black coffee', price: 10 }, { name: 'Msemen', price: 6 }, { name: 'Orange juice', price: 15 }, { name: 'Harcha', price: 5 }, { name: 'Croissant', price: 7 }, { name: 'Café crème', price: 14 }, { name: 'Mineral water', price: 6 }],
  },
  ar: {
    search: 'ابحث أو امسح…', cats: ['الكل', 'بقالة', 'طازج', 'مشروبات'], ticket: 'وصل رقم 0132', table: 'الطاولة 4',
    sub: 'المجموع الفرعي', vat: 'الضريبة', total: 'المجموع', pay: 'الدفع', cash: 'نقداً', card: 'بطاقة', qr: 'QR', online: 'متصل',
    shop: [{ name: 'حليب طازج 1 ل', price: 7 }, { name: 'شاي أخضر 200 غ', price: 18.5 }, { name: 'زيت زيتون 1 ل', price: 62 }, { name: 'خبز كامل', price: 3.5 }, { name: 'سكر 1 كغ', price: 9.5 }, { name: 'بيض ×12', price: 16 }, { name: 'تمر 500 غ', price: 25 }, { name: 'ماء 1.5 ل', price: 6 }],
    cafe: [{ name: 'شاي بالنعناع', price: 12 }, { name: 'قهوة سوداء', price: 10 }, { name: 'مسمن', price: 6 }, { name: 'عصير برتقال', price: 15 }, { name: 'حرشة', price: 5 }, { name: 'كرواسون', price: 7 }, { name: 'قهوة بالحليب', price: 14 }, { name: 'ماء معدني', price: 6 }],
  },
};

/** Product grid + ticket with lines, VAT, total and the Pay button. `variant` picks shop or café items. */
export function CheckoutScreen({ lang, variant = 'shop' }: { lang: Lang; variant?: 'shop' | 'cafe' }) {
  const c = CHECKOUT[lang];
  const m = money[lang];
  const items = variant === 'shop' ? c.shop : c.cafe;
  const lines = variant === 'shop'
    ? [{ i: 0, q: 2 }, { i: 1, q: 1 }, { i: 2, q: 1 }, { i: 5, q: 1 }]
    : [{ i: 0, q: 2 }, { i: 2, q: 3 }, { i: 3, q: 1 }, { i: 4, q: 2 }];
  const sub = lines.reduce((s, l) => s + items[l.i].price * l.q, 0);
  const vat = Math.round(sub * 0.2 / 1.2 * 100) / 100; // prices are VAT-inclusive (20 %)
  const tints = ['from-[#1E5A3F] to-[#123828]', 'from-[#5A4A1E] to-[#33290F]', 'from-[#1E4A5A] to-[#0F2A33]', 'from-[#4A1E3A] to-[#2A1121]'];

  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col bg-gradient-to-br from-[#0C2A1D] to-[#081B12] text-white" style={CQ}>
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0A2318]/80 px-[2.4cqw] py-[1.4cqw]">
        <Brand small />
        <div className="flex flex-1 justify-center px-[3cqw]">
          <span className="flex w-full max-w-[42cqw] items-center gap-[1cqw] rounded-[1.2cqw] bg-white/[0.06] px-[1.6cqw] py-[0.9cqw] text-[1.6cqw] text-white/45 ring-1 ring-white/[0.06]">
            <svg viewBox="0 0 24 24" className="h-[1.8cqw] w-[1.8cqw]" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            {c.search}
          </span>
        </div>
        <span className="flex items-center gap-[0.8cqw] text-[1.5cqw] text-white/60"><Dot />{c.online}</span>
      </div>

      <div className="flex min-h-0 flex-1 gap-[1.8cqw] p-[1.8cqw]">
        {/* products */}
        <div className="flex min-w-0 flex-[1.55] flex-col gap-[1.4cqw]">
          <div className="flex gap-[0.9cqw]">
            {c.cats.map((cat, i) => (
              <span key={cat} className={`rounded-full px-[1.6cqw] py-[0.6cqw] text-[1.45cqw] font-semibold ${i === 0 ? 'bg-gold-400 text-brand-950 shadow-[0_0.4cqw_1.2cqw_rgba(240,180,41,0.35)]' : 'bg-white/[0.06] text-white/70'}`}>{cat}</span>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-[1.2cqw]">
            {items.map((it, i) => {
              const inTicket = lines.some((l) => l.i === i);
              return (
                <div key={it.name} className={`flex flex-col overflow-hidden rounded-[1.2cqw] bg-white/[0.045] shadow-lg ring-1 ${inTicket ? 'ring-gold-400/70' : 'ring-white/[0.06]'}`}>
                  <div className={`relative flex-1 bg-gradient-to-br ${tints[i % 4]}`}>
                    <span className="absolute inset-[22%] rounded-full bg-white/[0.08]" />
                    {inTicket && <span className="absolute end-[6%] top-[8%] rounded-full bg-gold-400 px-[0.8cqw] text-[1.2cqw] font-bold text-brand-950">✓</span>}
                  </div>
                  <div className="px-[1cqw] py-[0.8cqw]">
                    <p className="truncate text-[1.35cqw] font-semibold leading-tight text-white/90">{it.name}</p>
                    <p className="text-[1.3cqw] font-bold text-gold-400" dir="ltr">{m(it.price)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ticket */}
        <div className="flex min-w-0 flex-1 flex-col rounded-[1.6cqw] bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-[1.8cqw] shadow-[0_1cqw_3cqw_rgba(0,0,0,0.35)] ring-1 ring-white/[0.08]">
          <div className="mb-[1.2cqw] flex items-baseline justify-between">
            <span className="text-[1.75cqw] font-bold">{c.ticket}</span>
            {variant === 'cafe' && <span className="rounded-full bg-white/[0.08] px-[1cqw] py-[0.2cqw] text-[1.3cqw] text-white/70">{c.table}</span>}
          </div>
          <div className="flex flex-1 flex-col gap-[1cqw]">
            {lines.map((l) => (
              <div key={l.i} className="flex items-center gap-[1cqw] text-[1.45cqw]">
                <span className="grid h-[2.6cqw] w-[2.6cqw] shrink-0 place-items-center rounded-[0.7cqw] bg-white/[0.08] text-[1.3cqw] font-bold text-gold-400">{l.q}</span>
                <span className="min-w-0 flex-1 truncate text-white/85">{items[l.i].name}</span>
                <span className="font-semibold text-white/90" dir="ltr">{m(items[l.i].price * l.q)}</span>
              </div>
            ))}
          </div>
          <div className="mt-[1.2cqw] space-y-[0.6cqw] border-t border-dashed border-white/15 pt-[1.2cqw] text-[1.4cqw] text-white/60">
            <div className="flex justify-between"><span>{c.sub}</span><span dir="ltr">{m(sub)}</span></div>
            <div className="flex justify-between"><span>{c.vat} 20 %</span><span dir="ltr">{m(vat)}</span></div>
            <div className="flex items-baseline justify-between pt-[0.4cqw] text-white">
              <span className="text-[1.7cqw] font-bold">{c.total}</span>
              <span className="text-[2.6cqw] font-extrabold text-gold-400" dir="ltr">{m(sub)}</span>
            </div>
          </div>
          <div className="mt-[1.2cqw] grid grid-cols-3 gap-[0.8cqw] text-[1.3cqw] font-semibold">
            {[c.cash, c.card, c.qr].map((p, i) => (
              <span key={p} className={`rounded-[0.9cqw] py-[0.8cqw] text-center ${i === 0 ? 'bg-white/[0.12] text-white ring-1 ring-gold-400/50' : 'bg-white/[0.05] text-white/60'}`}>{p}</span>
            ))}
          </div>
          <span className="mt-[1cqw] rounded-[1.1cqw] bg-gradient-to-b from-gold-400 to-[#DDA21A] py-[1.3cqw] text-center text-[1.9cqw] font-extrabold text-brand-950 shadow-[0_0.8cqw_2cqw_rgba(240,180,41,0.4)]">
            {c.pay} · <span dir="ltr">{m(sub)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 2. Mobile app (phone) ─────────────────────────────────────────────────────

const MOBILE: Record<Lang, { hello: string; today: string; sales: string; search: string; title: string; nav: string[]; cart: string; items: { name: string; stock: string; price: number }[] }> = {
  fr: {
    hello: 'Épicerie Atlas', today: 'Ventes du jour', sales: '2 340,00', search: 'Rechercher un produit', title: 'Produits',
    nav: ['Accueil', 'Produits', 'Ventes', 'Plus'], cart: 'Panier',
    items: [{ name: 'Lait frais 1 L', stock: '48 en stock', price: 7 }, { name: 'Thé vert 200 g', stock: '22 en stock', price: 18.5 }, { name: 'Huile d’olive 1 L', stock: '9 en stock', price: 62 }, { name: 'Dattes 500 g', stock: '3 en stock', price: 25 }, { name: 'Sucre 1 kg', stock: '35 en stock', price: 9.5 }],
  },
  en: {
    hello: 'Atlas Grocery', today: 'Today’s sales', sales: '2,340.00', search: 'Search a product', title: 'Products',
    nav: ['Home', 'Products', 'Sales', 'More'], cart: 'Cart',
    items: [{ name: 'Fresh milk 1 L', stock: '48 in stock', price: 7 }, { name: 'Green tea 200 g', stock: '22 in stock', price: 18.5 }, { name: 'Olive oil 1 L', stock: '9 in stock', price: 62 }, { name: 'Dates 500 g', stock: '3 in stock', price: 25 }, { name: 'Sugar 1 kg', stock: '35 in stock', price: 9.5 }],
  },
  ar: {
    hello: 'بقالة الأطلس', today: 'مبيعات اليوم', sales: '2340.00', search: 'ابحث عن منتج', title: 'المنتجات',
    nav: ['الرئيسية', 'المنتجات', 'المبيعات', 'المزيد'], cart: 'السلة',
    items: [{ name: 'حليب طازج 1 ل', stock: '48 في المخزون', price: 7 }, { name: 'شاي أخضر 200 غ', stock: '22 في المخزون', price: 18.5 }, { name: 'زيت زيتون 1 ل', stock: '9 في المخزون', price: 62 }, { name: 'تمر 500 غ', stock: '3 في المخزون', price: 25 }, { name: 'سكر 1 كغ', stock: '35 في المخزون', price: 9.5 }],
  },
};

/** Phone: today's sales card, product list with stock, floating cart button, bottom navigation. */
export function MobileScreen({ lang }: { lang: Lang }) {
  const c = MOBILE[lang];
  const m = money[lang];
  const tints = ['from-[#1E5A3F] to-[#123828]', 'from-[#5A4A1E] to-[#33290F]', 'from-[#1E4A5A] to-[#0F2A33]', 'from-[#4A1E3A] to-[#2A1121]', 'from-[#2D4A1E] to-[#1A2A11]'];
  const navIcons = [
    <path key="h" d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" />,
    <><path key="p1" d="M21 8 12 3 3 8v8l9 5 9-5z" /><path key="p2" d="M3 8l9 5 9-5M12 13v8" /></>,
    <path key="s" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    <><circle key="m1" cx="5" cy="12" r="1.6" /><circle key="m2" cx="12" cy="12" r="1.6" /><circle key="m3" cx="19" cy="12" r="1.6" /></>,
  ];
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#0C2A1D] to-[#081B12] text-white" style={CQ}>
      <div className="px-[6cqw] pb-[3cqw] pt-[13cqw]">
        <p className="text-[4cqw] text-white/55">{c.hello}</p>
        <div className="mt-[2.5cqw] rounded-[5cqw] bg-gradient-to-br from-[#1F5A40] to-[#0F3D2A] p-[5cqw] shadow-lg ring-1 ring-white/10">
          <p className="flex items-center gap-[2cqw] text-[3.6cqw] text-white/70"><Dot />{c.today}</p>
          <p className="mt-[1.5cqw] text-[8.5cqw] font-extrabold leading-none text-white" dir="ltr">{c.sales} <span className="text-[4.2cqw] font-bold text-gold-400">MAD</span></p>
          <div className="mt-[3cqw] flex h-[7cqw] items-end gap-[1.6cqw]">
            {[35, 55, 40, 70, 50, 85, 62].map((h, i) => <span key={i} className={`flex-1 rounded-t-[1cqw] ${i === 5 ? 'bg-gold-400' : 'bg-white/20'}`} style={{ height: `${h}%` }} />)}
          </div>
        </div>
        <span className="mt-[3.5cqw] flex items-center gap-[2cqw] rounded-[3.5cqw] bg-white/[0.06] px-[4cqw] py-[2.6cqw] text-[3.6cqw] text-white/45 ring-1 ring-white/[0.06]">
          <svg viewBox="0 0 24 24" className="h-[4cqw] w-[4cqw]" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          {c.search}
        </span>
        <p className="mt-[4cqw] text-[4.4cqw] font-bold">{c.title}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[2.4cqw] overflow-hidden px-[6cqw]">
        {c.items.map((it, i) => (
          <div key={it.name} className="flex items-center gap-[3cqw] rounded-[3.5cqw] bg-white/[0.045] p-[2.6cqw] ring-1 ring-white/[0.06]">
            <span className={`h-[11cqw] w-[11cqw] shrink-0 rounded-[2.6cqw] bg-gradient-to-br ${tints[i]}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[3.7cqw] font-semibold">{it.name}</span>
              <span className={`block text-[3.1cqw] ${i === 3 ? 'text-gold-400' : 'text-white/50'}`}>{it.stock}</span>
            </span>
            <span className="text-[3.6cqw] font-bold text-white/90" dir="ltr">{m(it.price)}</span>
            <span className="grid h-[7cqw] w-[7cqw] shrink-0 place-items-center rounded-full bg-gold-400 text-[5cqw] font-bold leading-none text-brand-950">+</span>
          </div>
        ))}
      </div>
      {/* floating cart */}
      <span className="absolute bottom-[19cqw] end-[6cqw] flex items-center gap-[2cqw] rounded-full bg-gradient-to-b from-gold-400 to-[#DDA21A] py-[2.8cqw] pe-[4.5cqw] ps-[3.5cqw] text-[3.8cqw] font-extrabold text-brand-950 shadow-[0_2cqw_5cqw_rgba(240,180,41,0.45)]">
        <svg viewBox="0 0 24 24" className="h-[4.6cqw] w-[4.6cqw]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11h11L21 8H6.2" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="17" cy="19.5" r="1.4" /></svg>
        {c.cart}
        <span className="grid h-[5.4cqw] min-w-[5.4cqw] place-items-center rounded-full bg-brand-950 px-[1cqw] text-[3.2cqw] text-gold-400">3</span>
      </span>
      {/* bottom navigation */}
      <div className="grid grid-cols-4 border-t border-white/[0.08] bg-[#071711]/95 px-[3cqw] pb-[5cqw] pt-[2.6cqw]">
        {c.nav.map((n, i) => (
          <span key={n} className={`flex flex-col items-center gap-[1cqw] text-[2.9cqw] ${i === 1 ? 'font-semibold text-gold-400' : 'text-white/45'}`}>
            <svg viewBox="0 0 24 24" className="h-[5.4cqw] w-[5.4cqw]" fill={i === 3 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{navIcons[i]}</svg>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 3. Portal dashboard (laptop) ──────────────────────────────────────────────

const DASH: Record<Lang, { nav: string[]; title: string; period: string; kpis: { label: string; value: string; delta: string; up: boolean }[]; chart: string; days: string[]; top: string; products: { name: string; qty: string }[] }> = {
  fr: {
    nav: ['Tableau de bord', 'Produits', 'Stock', 'Clients', 'Équipe', 'Rapports'], title: 'Tableau de bord', period: '7 derniers jours',
    kpis: [{ label: 'Ventes', value: '31 480 MAD', delta: '+12 %', up: true }, { label: 'Tickets', value: '864', delta: '+8 %', up: true }, { label: 'Panier moyen', value: '36,4 MAD', delta: '+3 %', up: true }, { label: 'Stock bas', value: '3', delta: 'à commander', up: false }],
    chart: 'Ventes par jour', days: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], top: 'Meilleures ventes',
    products: [{ name: 'Thé vert 200 g', qty: '142' }, { name: 'Lait frais 1 L', qty: '128' }, { name: 'Pain complet', qty: '96' }, { name: 'Huile d’olive 1 L', qty: '41' }],
  },
  en: {
    nav: ['Dashboard', 'Products', 'Stock', 'Customers', 'Team', 'Reports'], title: 'Dashboard', period: 'Last 7 days',
    kpis: [{ label: 'Sales', value: '31,480 MAD', delta: '+12%', up: true }, { label: 'Receipts', value: '864', delta: '+8%', up: true }, { label: 'Average basket', value: '36.4 MAD', delta: '+3%', up: true }, { label: 'Low stock', value: '3', delta: 'to reorder', up: false }],
    chart: 'Sales per day', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], top: 'Best sellers',
    products: [{ name: 'Green tea 200 g', qty: '142' }, { name: 'Fresh milk 1 L', qty: '128' }, { name: 'Wholemeal bread', qty: '96' }, { name: 'Olive oil 1 L', qty: '41' }],
  },
  ar: {
    nav: ['لوحة التحكم', 'المنتجات', 'المخزون', 'العملاء', 'الفريق', 'التقارير'], title: 'لوحة التحكم', period: 'آخر 7 أيام',
    kpis: [{ label: 'المبيعات', value: '31480 درهم', delta: '+12%', up: true }, { label: 'الوصولات', value: '864', delta: '+8%', up: true }, { label: 'متوسط السلة', value: '36.4 درهم', delta: '+3%', up: true }, { label: 'مخزون منخفض', value: '3', delta: 'للطلب', up: false }],
    chart: 'المبيعات اليومية', days: ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'], top: 'الأكثر مبيعاً',
    products: [{ name: 'شاي أخضر 200 غ', qty: '142' }, { name: 'حليب طازج 1 ل', qty: '128' }, { name: 'خبز كامل', qty: '96' }, { name: 'زيت زيتون 1 ل', qty: '41' }],
  },
};

const SALES = [3900, 4300, 3700, 4800, 5200, 5900, 3680];

/** Sidebar + KPI cards + area chart + best sellers. `compact` drops the sidebar and list (bento tile). */
export function DashboardScreen({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const c = DASH[lang];
  const max = 6400;
  const pts = SALES.map((v, i) => [(i / (SALES.length - 1)) * 100, 100 - (v / max) * 100] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // The chart reads in time order like the admin console: right-to-left in Arabic.
  const flip = lang === 'ar' ? 'scale(-1,1) translate(-100,0)' : undefined;
  const chart = (
    <div className={`flex min-h-0 flex-1 flex-col rounded-[1.4cqw] bg-white/[0.045] p-[1.8cqw] shadow-lg ring-1 ring-white/[0.06] ${compact ? '' : ''}`}>
      <div className="mb-[1cqw] flex items-center justify-between">
        <span className={`${compact ? 'text-[2.4cqw]' : 'text-[1.6cqw]'} font-bold`}>{c.chart}</span>
        <span className={`${compact ? 'text-[2cqw]' : 'text-[1.25cqw]'} rounded-full bg-white/[0.06] px-[1cqw] py-[0.3cqw] text-white/55`}>{c.period}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="min-h-0 w-full flex-1 overflow-visible">
        <defs>
          <linearGradient id={`area-${compact ? 'c' : 'f'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F0B429" stopOpacity="0.45" />
            <stop offset="1" stopColor="#F0B429" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />)}
        <g transform={flip}>
          <path d={`${line} L100,100 L0,100 Z`} fill={`url(#area-${compact ? 'c' : 'f'})`} />
          <path d={line} fill="none" stroke="#F0B429" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </g>
      </svg>
      {/* Compact tile: no day row (Arabic day names have no short form; the period chip says "7 days") */}
      {!compact && (
        <div className="mt-[0.8cqw] flex justify-between text-[1.15cqw] text-white/40">
          {c.days.map((d) => <span key={d}>{d}</span>)}
        </div>
      )}
    </div>
  );

  if (compact) {
    // Bento tile: short and wide, so figures stack on the start side and the chart takes the rest.
    return (
      // cqw on the container element itself would resolve against its ancestor: padding/gap live one level down.
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0C2A1D] to-[#081B12] text-white" style={CQ}>
       <div className="grid h-full grid-cols-[32%_1fr] grid-rows-1 gap-[2.6cqw] p-[3cqw]">
        <div className="flex min-h-0 flex-col gap-[2.2cqw]">
          {c.kpis.slice(0, 2).map((k, i) => (
            <div key={k.label} className={`flex flex-1 flex-col justify-center rounded-[2cqw] px-[2.4cqw] ring-1 ${i === 0 ? 'bg-gradient-to-br from-[#1F5A40] to-[#0F3D2A] ring-gold-400/30' : 'bg-white/[0.05] ring-white/[0.06]'}`}>
              <p className="truncate text-[2.2cqw] text-white/55">{k.label}</p>
              <p className="truncate text-[3.6cqw] font-extrabold leading-tight" dir="ltr">{k.value}</p>
              <p className="text-[2.1cqw] font-semibold text-[#5EC485]" dir="ltr">{k.delta}</p>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-col">{chart}</div>
       </div>
      </div>
    );
  }

  const navIcons = ['M3 11 12 4l9 7v9h-6v-6H9v6H3z', 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', 'M4 7h16M4 12h16M4 17h10', 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M17 20v-1a4 4 0 0 0-3-3.9M7 20v-1a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v1M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M4 20V10M10 20V4M16 20v-7M22 20H2'];
  return (
    <div aria-hidden="true" className="absolute inset-0 flex bg-gradient-to-br from-[#0C2A1D] to-[#081B12] text-white" style={CQ}>
      <aside className="flex w-[19cqw] shrink-0 flex-col gap-[0.6cqw] border-e border-white/[0.06] bg-[#071711] p-[1.6cqw]">
        <div className="mb-[1.6cqw]"><Brand small /></div>
        {c.nav.map((n, i) => (
          <span key={n} className={`flex items-center gap-[1cqw] rounded-[0.9cqw] px-[1cqw] py-[0.8cqw] text-[1.35cqw] ${i === 0 ? 'bg-gold-400 font-bold text-brand-950' : 'text-white/60'}`}>
            <svg viewBox="0 0 24 24" className="h-[1.7cqw] w-[1.7cqw] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={navIcons[i]} /></svg>
            <span className="truncate">{n}</span>
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-[1.6cqw] p-[2cqw]">
        <div className="flex items-center justify-between">
          <span className="text-[2.1cqw] font-extrabold">{c.title}</span>
          <span className="flex items-center gap-[1cqw]">
            <span className="rounded-full bg-white/[0.06] px-[1.2cqw] py-[0.4cqw] text-[1.25cqw] text-white/60">{c.period}</span>
            <span className="h-[3cqw] w-[3cqw] rounded-full bg-gradient-to-br from-gold-400 to-[#B8860B] ring-2 ring-white/10" />
          </span>
        </div>
        <div className="grid grid-cols-4 gap-[1.2cqw]">
          {c.kpis.map((k, i) => (
            <div key={k.label} className={`rounded-[1.3cqw] p-[1.4cqw] shadow-lg ring-1 ${i === 0 ? 'bg-gradient-to-br from-[#1F5A40] to-[#0F3D2A] ring-gold-400/30' : 'bg-white/[0.045] ring-white/[0.06]'}`}>
              <p className="truncate text-[1.25cqw] text-white/55">{k.label}</p>
              <p className="mt-[0.5cqw] truncate text-[2.1cqw] font-extrabold" dir="ltr">{k.value}</p>
              <p className={`text-[1.2cqw] font-semibold ${k.up ? 'text-[#5EC485]' : 'text-gold-400'}`}>{k.delta}</p>
            </div>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 gap-[1.4cqw]">
          <div className="flex min-w-0 flex-[1.7] flex-col">{chart}</div>
          <div className="flex min-w-0 flex-1 flex-col rounded-[1.4cqw] bg-white/[0.045] p-[1.6cqw] shadow-lg ring-1 ring-white/[0.06]">
            <span className="mb-[1.2cqw] text-[1.6cqw] font-bold">{c.top}</span>
            <div className="flex flex-col gap-[1.1cqw]">
              {c.products.map((p, i) => (
                <div key={p.name} className="text-[1.3cqw]">
                  <div className="mb-[0.4cqw] flex justify-between gap-[1cqw]"><span className="truncate text-white/80">{p.name}</span><span className="font-semibold text-white/90">{p.qty}</span></div>
                  <span className="block h-[0.7cqw] overflow-hidden rounded-full bg-white/[0.06]"><span className={`block h-full rounded-full ${i === 0 ? 'bg-gold-400' : 'bg-[#2E8B57]'}`} style={{ width: `${[100, 90, 68, 29][i]}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4. Printed receipt (bento tile) ───────────────────────────────────────────

const RECEIPT: Record<Lang, { shop: string; city: string; thanks: string }> = {
  fr: { shop: 'Épicerie Atlas', city: 'Fès · ICE 0000000000', thanks: 'Merci de votre visite !' },
  en: { shop: 'Atlas Grocery', city: 'Fès · ICE 0000000000', thanks: 'Thank you for your visit!' },
  ar: { shop: 'بقالة الأطلس', city: 'فاس · ICE 0000000000', thanks: 'شكراً لزيارتكم!' },
};

/** An 80 mm thermal receipt with the shop's name and logo at the top, on a dark plate. */
export function ReceiptScreen({ lang }: { lang: Lang }) {
  const c = RECEIPT[lang];
  const k = CHECKOUT[lang];
  const m = money[lang];
  const lines = [{ i: 0, q: 2 }, { i: 1, q: 1 }, { i: 5, q: 1 }];
  const total = lines.reduce((s, l) => s + k.shop[l.i].price * l.q, 0);
  return (
    <div aria-hidden="true" className="absolute inset-0 grid place-items-center" style={CQ}>
      <div className="relative w-[52cqw] rotate-[-2deg] bg-[#FBFAF6] px-[5cqw] pb-[7cqw] pt-[5cqw] text-[#1A1A1A] shadow-[0_3cqw_6cqw_rgba(0,0,0,0.45)]"
        style={{ WebkitMaskImage: 'linear-gradient(#000 calc(100% - 3cqw), transparent calc(100% - 3cqw)), radial-gradient(circle at 2cqw calc(100% - 1.5cqw), transparent 1.4cqw, #000 1.5cqw)', WebkitMaskSize: '100% 100%, 4cqw 100%', WebkitMaskRepeat: 'no-repeat, repeat-x' }}>
        <div className="mx-auto mb-[2cqw] grid h-[8cqw] w-[8cqw] place-items-center rounded-full bg-[#0A2318] text-[4.4cqw] font-extrabold text-gold-400">A</div>
        <p className="text-center text-[4cqw] font-extrabold">{c.shop}</p>
        <p className="mb-[3cqw] text-center text-[2.6cqw] text-black/50">{c.city}</p>
        <div className="space-y-[1.4cqw] border-y border-dashed border-black/25 py-[2.6cqw] font-mono text-[2.8cqw]">
          {lines.map((l) => (
            <div key={l.i} className="flex justify-between gap-[2cqw]"><span className="truncate">{l.q}× {k.shop[l.i].name}</span><span dir="ltr">{m(k.shop[l.i].price * l.q)}</span></div>
          ))}
        </div>
        <div className="mt-[2.4cqw] flex justify-between text-[3.6cqw] font-extrabold"><span>{k.total}</span><span dir="ltr">{m(total)}</span></div>
        <p className="mt-[3cqw] text-center text-[2.6cqw] text-black/55">{c.thanks}</p>
      </div>
    </div>
  );
}
