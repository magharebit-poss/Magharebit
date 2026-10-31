'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { usePortal } from '@/components/portal/shell/PortalProvider';
import { portalJson } from '@/components/portal/shell/portalFetch';
import { BTN, CARD } from '@/components/portal/PortalDialog';
import { ago, int, money } from '@/components/portal/format';
import OnboardingChecklist from '@/components/portal/OnboardingChecklist';
import LiveClock from '@/components/portal/LiveClock';
import LicenseCard from '@/components/portal/LicenseCard';
import WeeklySalesChart, { type DayPoint } from '@/components/portal/WeeklySalesChart';
import ErrorBoundary from '@/components/ErrorBoundary';

interface TxItem { name: string; qty: number }
interface Transaction { id: string; receiptNo: string; items: TxItem[]; total: number; paymentMethod: string; employeeName?: string; createdAt: string }

const COPY: Record<Lang, {
  hello: (s: string) => string; helloAnon: string; sub: string; refresh: string;
  kpi: { sales: string; salesSub: (n: number) => string; tickets: string; basket: (v: string) => string; low: string; lowSub: string; lowOk: string; plan: string; days: (n: number) => string; noDays: string };
  app: { title: string; sub: string; cta: string };
  recent: { title: string; empty: string; error: string; receipt: string; items: string; total: string; method: string; when: string; cashier: string };
  methods: Record<string, string>;
}> = {
  fr: {
    hello: (s) => `Bonjour, ${s}`, helloAnon: 'Bonjour', sub: 'Voici l’activité de votre boutique aujourd’hui.', refresh: 'Actualiser',
    kpi: { sales: 'Ventes du jour', salesSub: (n) => `${n} vente${n > 1 ? 's' : ''}`, tickets: 'Tickets du jour', basket: (v) => `Panier moyen : ${v}`, low: 'Stock bas', lowSub: 'Voir les produits concernés', lowOk: 'Le stock est bon', plan: 'Abonnement', days: (n) => `${n} jour${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}`, noDays: 'Pas de date d’échéance' },
    app: { title: 'Application de caisse MAGHAREBIT', sub: 'Pour Windows et Android. Fonctionne sans internet.', cta: 'Télécharger' },
    recent: { title: 'Dernières ventes', empty: 'Aucune vente pour l’instant. Faites votre première vente depuis l’application de caisse.', error: 'Impossible de charger les ventes. Réessayez.', receipt: 'Ticket', items: 'Articles', total: 'Total', method: 'Paiement', when: 'Quand', cashier: 'Caissier' },
    methods: { cash: 'Espèces', card: 'Carte', mobile_money: 'Mobile', mixed: 'Mixte', qr: 'QR' },
  },
  ar: {
    hello: (s) => `مرحباً، ${s}`, helloAnon: 'مرحباً', sub: 'هذا ملخص نشاط متجرك اليوم.', refresh: 'تحديث',
    kpi: { sales: 'مبيعات اليوم', salesSub: (n) => `${n} ${n === 1 ? 'عملية' : n === 2 ? 'عمليتان' : n <= 10 ? 'عمليات' : 'عملية'}`, tickets: 'وصولات اليوم', basket: (v) => `متوسط السلة: ${v}`, low: 'مخزون منخفض', lowSub: 'عرض المنتجات المعنية', lowOk: 'المخزون بخير', plan: 'الاشتراك', days: (n) => `${n} ${n === 1 ? 'يوم متبقٍ' : n === 2 ? 'يومان متبقيان' : n <= 10 ? 'أيام متبقية' : 'يوماً متبقياً'}`, noDays: 'لا يوجد تاريخ انتهاء' },
    app: { title: 'تطبيق صندوق MAGHAREBIT', sub: 'لويندوز وأندرويد. يعمل بدون إنترنت.', cta: 'تحميل' },
    recent: { title: 'آخر المبيعات', empty: 'لا توجد مبيعات بعد. أتمم أول عملية بيع من تطبيق الصندوق.', error: 'تعذّر تحميل المبيعات. أعد المحاولة.', receipt: 'الوصل', items: 'المنتجات', total: 'المجموع', method: 'الدفع', when: 'الوقت', cashier: 'الكاشير' },
    methods: { cash: 'نقداً', card: 'بطاقة', mobile_money: 'موبايل', mixed: 'مختلط', qr: 'QR' },
  },
  en: {
    hello: (s) => `Hello, ${s}`, helloAnon: 'Hello', sub: 'Here is your shop’s activity today.', refresh: 'Refresh',
    kpi: { sales: 'Sales today', salesSub: (n) => `${n} sale${n === 1 ? '' : 's'}`, tickets: 'Receipts today', basket: (v) => `Average basket: ${v}`, low: 'Low stock', lowSub: 'See the products', lowOk: 'Stock is fine', plan: 'Subscription', days: (n) => `${n} day${n === 1 ? '' : 's'} left`, noDays: 'No end date' },
    app: { title: 'MAGHAREBIT till app', sub: 'For Windows and Android. Works without internet.', cta: 'Download' },
    recent: { title: 'Latest sales', empty: 'No sales yet. Make your first sale from the till app.', error: 'Could not load the sales. Try again.', receipt: 'Receipt', items: 'Items', total: 'Total', method: 'Payment', when: 'When', cashier: 'Cashier' },
    methods: { cash: 'Cash', card: 'Card', mobile_money: 'Mobile', mixed: 'Mixed', qr: 'QR' },
  },
};

const METHOD_TONE: Record<string, string> = {
  cash: 'bg-[#ECFDF3] text-[#166534] ring-[#BBF7D0]',
  card: 'bg-[#EFF6FF] text-[#1D4ED8] ring-[#BFDBFE]',
  mobile_money: 'bg-[#F5F3FF] text-[#5B21B6] ring-[#DDD6FE]',
  mixed: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/40',
};

function Kpi({ label, value, sub, tone = 'muted', href, icon, testId }: { label: string; value: string; sub: string; tone?: 'muted' | 'good' | 'warn' | 'bad'; href?: string; icon: string; testId: string }) {
  const subTone = { muted: 'text-[#6B7280]', good: 'text-[#166534]', warn: 'text-[#B8860B]', bad: 'text-[#DC2626]' }[tone];
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#6B7280]">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
        </span>
      </div>
      <p className="truncate text-2xl font-bold tabular-nums text-[#111827]" data-testid={`${testId}-value`}>{value}</p>
      <p className={`mt-1 flex items-center gap-1 text-[13px] ${subTone}`}>
        {sub}
        {href && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>}
      </p>
    </>
  );
  const cls = `${CARD} block p-5 transition-[box-shadow,transform,border-color] duration-150`;
  return href
    ? <a href={href} data-testid={testId} className={`${cls} hover:-translate-y-0.5 hover:border-[#F0B429]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] motion-reduce:hover:translate-y-0`}>{body}</a>
    : <div data-testid={testId} className={cls}>{body}</div>;
}

/** UTC midnight six days ago: with today, the 7 days the chart shows (the API groups days in UTC). */
function weekStartIso(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - 6)).toISOString();
}

export default function DashboardPage() {
  const { lang, locale } = useLang();
  const c = COPY[lang];
  const { me, refreshMe } = usePortal();

  const [tx, setTx] = useState<Transaction[] | null>(null);
  const [txError, setTxError] = useState(false);
  const [days, setDays] = useState<DayPoint[] | null>(null);

  const load = useCallback(() => {
    void portalJson<{ transactions: Transaction[] }>('/api/portal/transactions?limit=5').then((r) => {
      setTxError(!r.ok);
      setTx(r.ok ? r.data.transactions ?? [] : []);
    });
    void portalJson<{ byDay: DayPoint[] }>(`/api/portal/reports/summary?dateFrom=${encodeURIComponent(weekStartIso())}`).then((r) => {
      setDays(r.ok ? r.data.byDay ?? [] : []);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const refresh = () => { refreshMe(); load(); };
  const today = me?.today ?? null;
  const low = me?.lowStockCount ?? 0;

  return (
    <div className="space-y-6">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold text-[#111827] sm:text-[1.75rem]" data-testid="dash-hello">
            {me?.storeName ? c.hello(me.storeName) : c.helloAnon}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">{c.sub}</p>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock lang={lang} />
          <button type="button" onClick={refresh} className={BTN.secondary} data-testid="dash-refresh">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
            {c.refresh}
          </button>
        </div>
      </div>

      <OnboardingChecklist lang={lang} locale={locale} />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {today === null ? (
          [0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-[132px] animate-pulse bg-[#F9FAFB]`} />)
        ) : (
          <>
            <Kpi testId="kpi-sales" label={c.kpi.sales} value={money(today.totalRevenue, lang)} sub={c.kpi.salesSub(today.totalTransactions)} tone="good" icon="M3 6h18v12H3zM3 10h18M7 15h4" />
            <Kpi testId="kpi-tickets" label={c.kpi.tickets} value={int(today.totalTransactions, lang)} sub={c.kpi.basket(money(today.avgBasket, lang))} icon="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
            <Kpi
              testId="kpi-low" label={c.kpi.low} value={int(low, lang)}
              sub={low > 0 ? c.kpi.lowSub : c.kpi.lowOk} tone={low > 0 ? 'warn' : 'good'}
              href={low > 0 ? `/${locale}/portal/products?lowStock=1` : undefined}
              icon="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"
            />
            <Kpi
              testId="kpi-plan" label={c.kpi.plan} value={me?.plan ?? 'Starter'}
              sub={me?.daysRemaining != null ? c.kpi.days(me.daysRemaining) : c.kpi.noDays}
              tone={me?.daysRemaining != null && me.daysRemaining < 14 ? 'bad' : 'muted'}
              icon="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z"
            />
          </>
        )}
      </div>

      {/* chart + subscription */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ErrorBoundary>
            <WeeklySalesChart lang={lang} days={days} />
          </ErrorBoundary>
        </div>
        <div className="space-y-6">
          {me && (
            <LicenseCard lang={lang} licenseKey={me.licenseKey} plan={me.plan} isTrial={me.isTrial} daysRemaining={me.daysRemaining} expiresAt={me.expiresAt} />
          )}
          <section className={`${CARD} flex items-center gap-4 p-5`} data-testid="app-card">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0F3D2A] text-[#F0B429]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#111827]">{c.app.title}</p>
              <p className="text-xs text-[#6B7280]">{c.app.sub}</p>
            </div>
            <a href={`/${locale}/download`} className={BTN.primary}>{c.app.cta}</a>
          </section>
        </div>
      </div>

      {/* recent sales */}
      <section aria-labelledby="recent-title" className={`${CARD} overflow-hidden`} data-testid="recent-sales">
        <h2 id="recent-title" className="border-b border-[#F1F2F4] px-5 py-4 text-base font-bold text-[#111827]">{c.recent.title}</h2>
        {tx === null ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>
        ) : txError ? (
          <p className="px-5 py-10 text-center text-sm text-[#B91C1C]">{c.recent.error}</p>
        ) : tx.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#6B7280]" data-testid="recent-empty">{c.recent.empty}</p>
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>{[c.recent.receipt, c.recent.items, c.recent.total, c.recent.method, c.recent.when, c.recent.cashier].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {tx.map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-[#FAFAFB]">
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-[#6B7280]" dir="ltr">#{t.receiptNo}</td>
                      <td className="max-w-[280px] truncate px-5 py-3.5 text-[#111827]">{t.items.map((it) => (it.qty > 1 ? `${it.name} ×${it.qty}` : it.name)).join(', ') || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums text-[#111827]">{money(t.total, lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${METHOD_TONE[t.paymentMethod] ?? 'bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]'}`}>{c.methods[t.paymentMethod] ?? t.paymentMethod}</span></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[#6B7280]">{ago(t.createdAt, lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[#374151]">{t.employeeName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* phone list */}
            <ul className="divide-y divide-[#F3F4F6] md:hidden">
              {tx.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#111827]">{t.items.map((it) => it.name).join(', ') || '—'}</p>
                    <p className="text-xs text-[#6B7280]"><span dir="ltr">#{t.receiptNo}</span> · {ago(t.createdAt, lang)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold tabular-nums">{money(t.total, lang)}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${METHOD_TONE[t.paymentMethod] ?? 'bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]'}`}>{c.methods[t.paymentMethod] ?? t.paymentMethod}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
