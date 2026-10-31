'use client';

import type { Lang } from '@/components/landing/useLang';
import { CARD } from '@/components/portal/PortalDialog';
import { int, money, weekday } from '@/components/portal/format';

export interface DayPoint { date: string; totalRevenue: number; totalTransactions: number }

const COPY: Record<Lang, { title: string; sub: string; total: string; today: string; empty: string; tx: (n: number) => string; table: string; day: string; revenue: string; sales: string }> = {
  fr: { title: 'Ventes des 7 derniers jours', sub: 'Montant encaissé par jour', total: 'Total sur 7 jours', today: 'Aujourd’hui', empty: 'Aucune vente sur les 7 derniers jours. Les ventes encaissées sur la caisse apparaîtront ici.', tx: (n) => `${n} vente${n > 1 ? 's' : ''}`, table: 'Ventes par jour', day: 'Jour', revenue: 'Montant', sales: 'Ventes' },
  ar: { title: 'مبيعات آخر 7 أيام', sub: 'المبلغ المحصّل يومياً', total: 'مجموع 7 أيام', today: 'اليوم', empty: 'لا توجد مبيعات في آخر 7 أيام. ستظهر هنا المبيعات المسجلة على الصندوق.', tx: (n) => `${n} ${n === 1 ? 'عملية' : n === 2 ? 'عمليتان' : n <= 10 ? 'عمليات' : 'عملية'}`, table: 'المبيعات اليومية', day: 'اليوم', revenue: 'المبلغ', sales: 'العمليات' },
  en: { title: 'Sales over the last 7 days', sub: 'Amount taken per day', total: '7-day total', today: 'Today', empty: 'No sales in the last 7 days. Sales rung up on the till will show here.', tx: (n) => `${n} sale${n === 1 ? '' : 's'}`, table: 'Sales per day', day: 'Day', revenue: 'Amount', sales: 'Sales' },
};

/** The last 7 calendar days (UTC, as the API groups them), oldest first, with missing days at 0. */
export function lastSevenDays(points: DayPoint[]): DayPoint[] {
  const byDate = new Map(points.map((p) => [p.date, p]));
  const out: DayPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10);
    out.push(byDate.get(d) ?? { date: d, totalRevenue: 0, totalTransactions: 0 });
  }
  return out;
}

/**
 * Real sales per day (GET /api/portal/reports/summary). Bars run oldest → today in reading order (right-to-left in
 * Arabic). Bar heights are the only inline style: they are data.
 */
export default function WeeklySalesChart({ lang, days }: { lang: Lang; days: DayPoint[] | null }) {
  const c = COPY[lang];
  const series = days ? lastSevenDays(days) : null;
  const total = series?.reduce((s, d) => s + d.totalRevenue, 0) ?? 0;
  const max = Math.max(1, ...(series ?? []).map((d) => d.totalRevenue));
  const empty = series !== null && total === 0;

  return (
    <section aria-labelledby="weekly-sales-title" className={`${CARD} p-5 sm:p-6`} data-testid="weekly-sales">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="weekly-sales-title" className="text-base font-bold text-[#111827]">{c.title}</h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">{c.sub}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-[#6B7280]">{c.total}</p>
          <p className="text-xl font-extrabold tabular-nums text-[#111827]" data-testid="weekly-total">{series ? money(total, lang) : '—'}</p>
        </div>
      </div>

      {series === null ? (
        <div className="h-48 animate-pulse rounded-lg bg-[#F3F4F6]" />
      ) : (
        <div className="relative">
          {/* grid lines */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between">
            {[0, 1, 2, 3].map((i) => <span key={i} className="block border-t border-dashed border-[#EEF0F2]" />)}
          </div>
          <ol aria-hidden="true" className="relative flex h-48 items-end gap-2 sm:gap-3">
            {series.map((d, i) => {
              const today = i === series.length - 1;
              const h = d.totalRevenue > 0 ? Math.max(4, Math.round((d.totalRevenue / max) * 100)) : 2;
              return (
                <li key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" tabIndex={0}>
                  <span className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block group-focus:block rtl:translate-x-1/2">
                    {money(d.totalRevenue, lang)} · {c.tx(d.totalTransactions)}
                  </span>
                  <span
                    data-dynamic
                    data-bar={d.date}
                    className={`block w-full rounded-t-md transition-[height,opacity] duration-500 ease-out ${today ? 'bg-[#F0B429]' : 'bg-[#0F3D2A]/70 group-hover:bg-[#0F3D2A]'} ${d.totalRevenue === 0 ? 'opacity-30' : ''}`}
                    style={{ height: `${h}%` }}
                  />
                </li>
              );
            })}
          </ol>
          <div aria-hidden="true" className="mt-2 flex gap-2 sm:gap-3">
            {series.map((d, i) => (
              <span key={d.date} className={`flex-1 truncate text-center text-xs ${i === series.length - 1 ? 'font-bold text-[#B8860B]' : 'text-[#6B7280]'}`}>
                {i === series.length - 1 ? c.today : weekday(d.date, lang)}
              </span>
            ))}
          </div>
          {empty && (
            <p className="absolute inset-x-0 top-14 mx-auto max-w-sm rounded-lg bg-white/90 px-4 py-3 text-center text-sm text-[#6B7280] shadow-sm ring-1 ring-[#E5E7EB]" data-testid="weekly-empty">{c.empty}</p>
          )}
          <table className="sr-only">
            <caption>{c.table}</caption>
            <thead><tr><th scope="col">{c.day}</th><th scope="col">{c.revenue}</th><th scope="col">{c.sales}</th></tr></thead>
            <tbody>
              {series.map((d) => <tr key={d.date}><td>{weekday(d.date, lang, 'long')} {d.date}</td><td>{money(d.totalRevenue, lang)}</td><td>{int(d.totalTransactions, lang)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
