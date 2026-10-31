'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { portalJson } from '@/components/portal/shell/portalFetch';
import PortalDialog, { BTN, CARD, FIELD, LABEL } from '@/components/portal/PortalDialog';
import { dateTime, int, longDate, money, time } from '@/components/portal/format';

// ─── Types ────────────────────────────────────────────────────────────────────
type Method = 'cash' | 'card' | 'mobile_money' | 'mixed';
type Period = 'all' | 'today' | '7d' | '30d' | 'custom';

interface SaleItem { productId: string; name: string; qty: number; unitPrice: number; itemDiscount?: number; total: number }
interface Sale {
  id: string; receiptNo: string; createdAt: string; paymentMethod: Method; items: SaleItem[];
  subtotal: number; discount: number; discountType?: 'amount' | 'percent'; discountValue?: number;
  totalHT: number; taxRate: number; taxAmount: number; total: number;
  customerId?: string; customerName?: string; employeeName?: string; note?: string;
}

const LIMIT = 20;
const METHODS: Method[] = ['cash', 'card', 'mobile_money', 'mixed'];
const PERIODS: Period[] = ['all', 'today', '7d', '30d', 'custom'];

/** Local-day boundaries (the merchant's device clock), sent to the API as ISO instants. */
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function daysAgo(n: number): Date { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); return d; }
function fromInput(v: string, end = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  return end ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) : new Date(+m[1], +m[2] - 1, +m[3]);
}
function rangeOf(period: Period, from: string, to: string): { from?: Date; to?: Date } | null {
  if (period === 'today') return { from: daysAgo(0) };
  if (period === '7d') return { from: daysAgo(6) };
  if (period === '30d') return { from: daysAgo(29) };
  if (period === 'custom') {
    const f = from ? fromInput(from) : null;
    const t = to ? fromInput(to, true) : null;
    if (f && t && f > t) return null;
    return { from: f ?? undefined, to: t ?? undefined };
  }
  return {};
}

// ─── Copy ─────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, {
  summary: (n: number, sum: string) => string; intro: string; loading: string;
  filters: string; period: string; periods: Record<Period, string>; from: string; to: string; method: string; allMethods: string; reset: string; badRange: string;
  cols: { date: string; receipt: string; customer: string; method: string; items: string; total: string };
  walkIn: string; itemsCount: (n: number) => string; view: (r: string) => string; viewShort: string;
  empty: string; noMatch: string; loadError: string; retry: string;
  prev: string; next: string; page: (p: number, t: number) => string; range: (a: number, b: number, n: number) => string;
  methods: Record<Method, string>;
  detail: { title: (r: string) => string; customer: string; cashier: string; method: string; date: string; product: string; qty: string; unit: string; lineTotal: string; lineDiscount: string; subtotal: string; discount: string; totalHT: string; tax: (r: number) => string; total: string; note: string; close: string };
}> = {
  fr: {
    summary: (n, s) => `${n} vente${n > 1 ? 's' : ''} · ${s}`, intro: 'Toutes les ventes encaissées sur vos caisses.', loading: 'Chargement…',
    filters: 'Filtres', period: 'Période', periods: { all: 'Tout', today: 'Aujourd’hui', '7d': '7 jours', '30d': '30 jours', custom: 'Personnalisée' },
    from: 'Du', to: 'Au', method: 'Paiement', allMethods: 'Tous les paiements', reset: 'Réinitialiser', badRange: 'La date de début doit précéder la date de fin.',
    cols: { date: 'Date', receipt: 'Ticket', customer: 'Client', method: 'Paiement', items: 'Articles', total: 'Total' },
    walkIn: 'Client de passage', itemsCount: (n) => `${n} article${n > 1 ? 's' : ''}`, view: (r) => `Voir le détail du ticket ${r}`, viewShort: 'Détail',
    empty: 'Aucune vente pour l’instant. Les ventes encaissées sur vos caisses apparaîtront ici.', noMatch: 'Aucune vente ne correspond à ces filtres.',
    loadError: 'Impossible de charger les ventes.', retry: 'Réessayer',
    prev: 'Précédent', next: 'Suivant', page: (p, t) => `Page ${p} sur ${t}`, range: (a, b, n) => `${a}–${b} sur ${n}`,
    methods: { cash: 'Espèces', card: 'Carte', mobile_money: 'Mobile', mixed: 'Mixte' },
    detail: { title: (r) => `Ticket ${r}`, customer: 'Client', cashier: 'Caissier', method: 'Paiement', date: 'Date', product: 'Article', qty: 'Qté', unit: 'Prix unitaire', lineTotal: 'Total', lineDiscount: 'Remise article', subtotal: 'Sous-total', discount: 'Remise', totalHT: 'Total HT', tax: (r) => `TVA ${r} %`, total: 'Total TTC', note: 'Note', close: 'Fermer' },
  },
  ar: {
    summary: (n, s) => `${n === 1 ? 'عملية بيع واحدة' : n === 2 ? 'عمليتا بيع' : n <= 10 ? `${n} عمليات بيع` : `${n} عملية بيع`} · ${s}`, intro: 'كل المبيعات المسجلة على صناديقك.', loading: 'جارٍ التحميل…',
    filters: 'التصفية', period: 'الفترة', periods: { all: 'الكل', today: 'اليوم', '7d': '7 أيام', '30d': '30 يوماً', custom: 'مخصصة' },
    from: 'من', to: 'إلى', method: 'الدفع', allMethods: 'كل طرق الدفع', reset: 'إعادة التعيين', badRange: 'يجب أن يسبق تاريخ البداية تاريخ النهاية.',
    cols: { date: 'التاريخ', receipt: 'الوصل', customer: 'الزبون', method: 'الدفع', items: 'المنتجات', total: 'المجموع' },
    walkIn: 'زبون عابر', itemsCount: (n) => (n === 1 ? 'منتج واحد' : n === 2 ? 'منتجان' : n <= 10 ? `${n} منتجات` : `${n} منتجاً`), view: (r) => `عرض تفاصيل الوصل ${r}`, viewShort: 'التفاصيل',
    empty: 'لا توجد مبيعات بعد. ستظهر هنا المبيعات المسجلة على صناديقك.', noMatch: 'لا توجد مبيعات مطابقة لهذه التصفية.',
    loadError: 'تعذّر تحميل المبيعات.', retry: 'أعد المحاولة',
    prev: 'السابق', next: 'التالي', page: (p, t) => `الصفحة ${p} من ${t}`, range: (a, b, n) => `${a}–${b} من ${n}`,
    methods: { cash: 'نقداً', card: 'بطاقة', mobile_money: 'موبايل', mixed: 'مختلط' },
    detail: { title: (r) => `الوصل ${r}`, customer: 'الزبون', cashier: 'البائع', method: 'الدفع', date: 'التاريخ', product: 'المنتج', qty: 'الكمية', unit: 'سعر الوحدة', lineTotal: 'المجموع', lineDiscount: 'تخفيض المنتج', subtotal: 'المجموع الفرعي', discount: 'التخفيض', totalHT: 'المجموع دون ضريبة', tax: (r) => `الضريبة ${r}%`, total: 'المجموع شامل الضريبة', note: 'ملاحظة', close: 'إغلاق' },
  },
  en: {
    summary: (n, s) => `${n} sale${n === 1 ? '' : 's'} · ${s}`, intro: 'Every sale taken on your registers.', loading: 'Loading…',
    filters: 'Filters', period: 'Period', periods: { all: 'All', today: 'Today', '7d': '7 days', '30d': '30 days', custom: 'Custom' },
    from: 'From', to: 'To', method: 'Payment', allMethods: 'All payments', reset: 'Reset', badRange: 'The start date must be before the end date.',
    cols: { date: 'Date', receipt: 'Receipt', customer: 'Customer', method: 'Payment', items: 'Items', total: 'Total' },
    walkIn: 'Walk-in customer', itemsCount: (n) => `${n} item${n === 1 ? '' : 's'}`, view: (r) => `View receipt ${r}`, viewShort: 'Details',
    empty: 'No sales yet. Sales taken on your registers will show up here.', noMatch: 'No sale matches these filters.',
    loadError: 'Could not load the sales.', retry: 'Try again',
    prev: 'Previous', next: 'Next', page: (p, t) => `Page ${p} of ${t}`, range: (a, b, n) => `${a}–${b} of ${n}`,
    methods: { cash: 'Cash', card: 'Card', mobile_money: 'Mobile', mixed: 'Mixed' },
    detail: { title: (r) => `Receipt ${r}`, customer: 'Customer', cashier: 'Cashier', method: 'Payment', date: 'Date', product: 'Item', qty: 'Qty', unit: 'Unit price', lineTotal: 'Total', lineDiscount: 'Item discount', subtotal: 'Subtotal', discount: 'Discount', totalHT: 'Total excl. tax', tax: (r) => `VAT ${r}%`, total: 'Total incl. tax', note: 'Note', close: 'Close' },
  },
};

const METHOD_TONE: Record<Method, string> = {
  cash: 'bg-[#F0FDF6] text-[#0F3D2A] ring-[#BBF7D0]',
  card: 'bg-[#EFF6FF] text-[#1E40AF] ring-[#BFDBFE]',
  mobile_money: 'bg-[#F5F3FF] text-[#5B21B6] ring-[#DDD6FE]',
  mixed: 'bg-[#FFFBEB] text-[#7A5600] ring-[#F0B429]/50',
};

function MethodBadge({ method, lang }: { method: Method; lang: Lang }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${METHOD_TONE[method] ?? METHOD_TONE.mixed}`} data-method={method}>
      {COPY[lang].methods[method] ?? method}
    </span>
  );
}

const qtyOf = (s: Sale) => s.items.reduce((n, i) => n + i.qty, 0);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SalesPage() {
  const { lang } = useLang();
  const c = COPY[lang];

  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState<Method | ''>('');
  const [page, setPage] = useState(1);

  const [sales, setSales] = useState<Sale[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);
  const seq = useRef(0);

  const range = rangeOf(period, from, to);
  const badRange = range === null;
  const filtered = period !== 'all' || method !== '';

  const rFrom = range?.from?.toISOString();
  const rTo = range?.to?.toISOString();
  const load = useCallback(() => {
    if (badRange) return;
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (rFrom) q.set('dateFrom', rFrom);
    if (rTo) q.set('dateTo', rTo);
    if (method) q.set('method', method);
    const mine = ++seq.current;
    setLoading(true);
    void portalJson<{ transactions: Sale[]; total: number; sum: number }>(`/api/portal/transactions?${q}`).then((r) => {
      if (mine !== seq.current) return; // a newer filter won the race
      setLoadError(!r.ok);
      if (r.ok) { setSales(r.data.transactions ?? []); setTotal(r.data.total ?? 0); setSum(r.data.sum ?? 0); }
      setLoading(false);
    });
  }, [page, rFrom, rTo, method, badRange]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const pick = (p: Period) => { setPeriod(p); setPage(1); };
  const reset = () => { setPeriod('all'); setFrom(''); setTo(''); setMethod(''); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const list = sales ?? [];
  const first = (page - 1) * LIMIT + 1;

  return (
    <div className="space-y-5">
      <p className="text-sm text-[#6B7280]" data-testid="sales-summary" aria-live="polite">
        {sales === null ? c.loading : total > 0 || filtered ? c.summary(total, money(sum, lang)) : c.intro}
      </p>

      {/* Filters */}
      <section className={`${CARD} p-4`} aria-label={c.filters} data-testid="sales-filters">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-4">
          <div className="min-w-0">
            <p className={LABEL} id="sales-period-label">{c.period}</p>
            <div role="group" aria-labelledby="sales-period-label" className="flex max-w-full flex-wrap gap-1 rounded-xl bg-[#F3F4F6] p-1">
              {PERIODS.map((p) => (
                <button
                  key={p} type="button" aria-pressed={period === p} onClick={() => pick(p)} data-testid={`period-${p}`}
                  className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] ${period === p ? 'bg-white text-[#0F3D2A] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
                >
                  {c.periods[p]}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex flex-wrap gap-3">
              <label className="w-40"><span className={LABEL}>{c.from}</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={FIELD} data-testid="sales-from" />
              </label>
              <label className="w-40"><span className={LABEL}>{c.to}</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={FIELD} data-testid="sales-to" />
              </label>
            </div>
          )}

          <label className="w-full sm:w-52"><span className={LABEL}>{c.method}</span>
            <select value={method} onChange={(e) => { setMethod(e.target.value as Method | ''); setPage(1); }} className={FIELD} data-testid="sales-method">
              <option value="">{c.allMethods}</option>
              {METHODS.map((m) => <option key={m} value={m}>{c.methods[m]}</option>)}
            </select>
          </label>

          {(filtered || from || to) && (
            <button type="button" onClick={reset} className={`${BTN.secondary} sm:ms-auto`} data-testid="sales-reset">{c.reset}</button>
          )}
        </div>
        {badRange && <p role="alert" className="mt-3 text-sm text-[#B91C1C]" data-testid="sales-range-error">{c.badRange}</p>}
      </section>

      {/* List */}
      <section className={`${CARD} overflow-hidden`} aria-busy={loading} data-testid="sales-list">
        {sales === null && loading ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-[#B91C1C]">{c.loadError}</p>
            <button type="button" onClick={load} className={BTN.secondary}>{c.retry}</button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-5 py-14 text-center" data-testid="sales-empty">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" /></svg>
            </span>
            <p className="max-w-sm text-sm text-[#6B7280]">{filtered ? c.noMatch : c.empty}</p>
            {filtered && <button type="button" onClick={reset} className={BTN.secondary}>{c.reset}</button>}
          </div>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    {[c.cols.date, c.cols.receipt, c.cols.customer, c.cols.method].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-end">{c.cols.items}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-end">{c.cols.total}</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{c.viewShort}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {list.map((s) => (
                    <tr key={s.id} data-receipt={s.receiptNo} className="cursor-pointer transition-colors hover:bg-[#FAFAFB]" onClick={() => setSelected(s)}>
                      <td className="whitespace-nowrap px-5 py-3 text-[#374151]">{dateTime(s.createdAt, lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-[#6B7280]" dir="ltr">{s.receiptNo}</td>
                      <td className="max-w-[14rem] truncate px-5 py-3">{s.customerName ? <span className="font-medium text-[#111827]">{s.customerName}</span> : <span className="text-[#9CA3AF]">{c.walkIn}</span>}</td>
                      <td className="px-5 py-3"><MethodBadge method={s.paymentMethod} lang={lang} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums text-[#6B7280]">{int(qtyOf(s), lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-end font-semibold tabular-nums text-[#111827]">{money(s.total, lang)}</td>
                      <td className="px-5 py-3 text-end">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(s); }} aria-label={c.view(s.receiptNo)} className={`${BTN.secondary} min-h-[34px] px-3 text-xs`}>{c.viewShort}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={`divide-y divide-[#F3F4F6] md:hidden ${loading ? 'opacity-60' : ''}`}>
              {list.map((s) => (
                <li key={s.id} data-receipt={s.receiptNo}>
                  <button type="button" onClick={() => setSelected(s)} aria-label={c.view(s.receiptNo)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[#FAFAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-[13px] text-[#6B7280]" dir="ltr">{s.receiptNo}</span>
                        <span className="text-xs text-[#9CA3AF]">{time(s.createdAt, lang)}</span>
                      </span>
                      <span className="block truncate text-xs text-[#6B7280]">{s.customerName ?? c.walkIn} · {c.itemsCount(qtyOf(s))}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-[#111827]">{money(s.total, lang)}</span>
                      <MethodBadge method={s.paymentMethod} lang={lang} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {totalPages > 1 && list.length > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={c.page(page, totalPages)} data-testid="sales-pagination">
          <p className="text-sm tabular-nums text-[#6B7280]" data-testid="sales-range">{c.range(first, first + list.length - 1, total)}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((x) => Math.max(1, x - 1))} aria-disabled={page <= 1} className={BTN.secondary} data-testid="sales-prev">{c.prev}</button>
            <span className="px-2 text-sm tabular-nums text-[#6B7280]" data-testid="sales-page">{c.page(page, totalPages)}</span>
            <button type="button" onClick={() => setPage((x) => Math.min(totalPages, x + 1))} aria-disabled={page >= totalPages} className={BTN.secondary} data-testid="sales-next">{c.next}</button>
          </div>
        </nav>
      )}

      <SaleDialog sale={selected} lang={lang} onClose={() => setSelected(null)} />
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────
function SaleDialog({ sale, lang, onClose }: { sale: Sale | null; lang: Lang; onClose: () => void }) {
  const c = COPY[lang];
  const d = c.detail;
  if (!sale) return null;
  const row = (label: string, value: string, strong = false, testId?: string) => (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'border-t border-[#E5E7EB] pt-2.5 text-base font-bold text-[#111827]' : 'text-sm text-[#6B7280]'}`} data-testid={testId}>
      <dt>{label}</dt><dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <PortalDialog
      open onClose={onClose} title={d.title(sale.receiptNo)} description={longDate(sale.createdAt, lang) + ' · ' + time(sale.createdAt, lang)}
      closeLabel={d.close} size="md" testId="sale-detail"
      footer={<button type="button" onClick={onClose} className={BTN.secondary}>{d.close}</button>}
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [d.method, <MethodBadge key="m" method={sale.paymentMethod} lang={lang} />],
          [d.customer, sale.customerName ?? c.walkIn],
          [d.cashier, sale.employeeName ?? '—'],
        ].map(([k, v], i) => (
          <div key={i} className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5">
            <dt className="text-xs text-[#6B7280]">{k}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-[#111827]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EB]">
        <table className="w-full text-sm" data-testid="sale-items">
          <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start">{d.product}</th>
              <th scope="col" className="px-3 py-2.5 text-end">{d.qty}</th>
              <th scope="col" className="hidden px-3 py-2.5 text-end sm:table-cell">{d.unit}</th>
              <th scope="col" className="px-4 py-2.5 text-end">{d.lineTotal}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {sale.items.map((it, i) => (
              <tr key={`${it.productId}-${i}`}>
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-[#111827]">{it.name}</span>
                  <span className="block text-xs text-[#9CA3AF] sm:hidden">{int(it.qty, lang)} × {money(it.unitPrice, lang)}</span>
                  {!!it.itemDiscount && <span className="block text-xs text-[#B45309]">{d.lineDiscount} −{money(it.itemDiscount, lang)}</span>}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums text-[#374151]">{int(it.qty, lang)}</td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-end tabular-nums text-[#6B7280] sm:table-cell">{money(it.unitPrice, lang)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums text-[#111827]">{money(it.total, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto mt-4 max-w-xs space-y-1.5" data-testid="sale-totals">
        {row(d.subtotal, money(sale.subtotal, lang))}
        {sale.discount > 0 && row(sale.discountType === 'percent' ? `${d.discount} (${sale.discountValue} %)` : d.discount, `−${money(sale.discount, lang)}`, false, 'sale-discount')}
        {sale.taxRate > 0 && row(d.totalHT, money(sale.totalHT, lang))}
        {sale.taxRate > 0 && row(d.tax(sale.taxRate), money(sale.taxAmount, lang), false, 'sale-tax')}
        {row(d.total, money(sale.total, lang), true, 'sale-total')}
      </dl>

      {sale.note && (
        <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm">
          <p className="text-xs text-[#6B7280]">{d.note}</p>
          <p className="mt-1 whitespace-pre-line text-[#111827]">{sale.note}</p>
        </div>
      )}
    </PortalDialog>
  );
}
