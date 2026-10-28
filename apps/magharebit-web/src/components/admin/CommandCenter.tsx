'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAdmin } from './AdminShell';
import ExportButton from './ExportButton';
import SalesBarChart, { fmtMad } from './SalesBarChart';
import { ACTION_LABEL, ACTION_TONE, TONE_STYLE } from './auditActions';
import { BTN, FIELD, type Lang } from './adminUi';
import { zonedDateKey, zonedDayStart } from '@/lib/zoned-time';
import type { DashboardMetrics } from '@/lib/admin-metrics';

const POLL_MS = 60_000;

const COPY: Record<Lang, {
  title: string; subtitle: string; updated: (t: string) => string; refresh: string; loading: string; error: string; unavailable: string;
  portalSales: string; portalOnly: string; vsYesterday: string; noBase: string; yesterdayFull: (v: string) => string; salesCount: (n: number) => string;
  licenses: string; trials: (n: number) => string; expiring: (n: number) => string;
  online: string; onlineSub: (m: number, t: number) => string; seen24h: (m: number, t: number) => string;
  merchants: string; pending: (n: number) => string; newLeads: (n: number) => string;
  chartTitle: string; chartSub: string; activity: string; viewAll: string; noActivity: string; by: string;
  exportTitle: string; from: string; to: string; scopeNote: string;
}> = {
  ar: {
    title: 'مركز القيادة', subtitle: 'نظرة سريعة على نشاط المنصة', updated: (t) => `آخر تحديث ${t} (توقيت المغرب) · يتجدد كل دقيقة`, refresh: 'تحديث',
    loading: 'جارٍ التحميل…', error: 'تعذّر تحميل المؤشرات', unavailable: 'قاعدة البيانات غير متاحة',
    portalSales: 'مبيعات البوابة اليوم', portalOnly: 'عبر البوابة فقط', vsYesterday: 'مقارنة بنفس الوقت أمس', noBase: 'لا مبيعات في نفس الوقت أمس',
    yesterdayFull: (v) => `أمس كاملاً: ${v} درهم`, salesCount: (n) => `${n} عملية بيع`,
    licenses: 'التراخيص النشطة', trials: (n) => `${n} تجريبية`, expiring: (n) => `${n} تنتهي خلال 7 أيام`,
    online: 'تجار متصلون الآن', onlineSub: (m, t) => `${m} تاجر · ${t} جهاز خلال آخر 15 دقيقة`, seen24h: (m, t) => `آخر 24 ساعة: ${m} تاجر · ${t} جهاز`,
    merchants: 'التجار النشطون', pending: (n) => `${n} في انتظار الموافقة`, newLeads: (n) => `${n} عميل محتمل جديد`,
    chartTitle: 'مبيعات البوابة، آخر 7 أيام', chartSub: 'المبلغ الإجمالي بالدرهم لكل يوم (توقيت المغرب)',
    activity: 'آخر النشاطات', viewAll: 'عرض السجل كاملاً', noActivity: 'لا يوجد نشاط بعد', by: 'بواسطة',
    exportTitle: 'تصدير مبيعات البوابة', from: 'من', to: 'إلى',
    scopeNote: 'تشمل المبيعات المسجلة عبر بوابة التاجر على الويب فقط. مبيعات أجهزة نقاط البيع غير المتصلة لا تظهر هنا بعد.',
  },
  fr: {
    title: 'Centre de pilotage', subtitle: 'L’activité de la plateforme en un coup d’œil', updated: (t) => `Mis à jour à ${t} (heure du Maroc) · actualisation chaque minute`, refresh: 'Actualiser',
    loading: 'Chargement…', error: 'Impossible de charger les indicateurs', unavailable: 'Base de données indisponible',
    portalSales: 'Ventes portail aujourd’hui', portalOnly: 'Portail web uniquement', vsYesterday: 'vs hier à la même heure', noBase: 'Aucune vente hier à la même heure',
    yesterdayFull: (v) => `Hier (journée) : ${v} MAD`, salesCount: (n) => `${n} vente${n > 1 ? 's' : ''}`,
    licenses: 'Licences actives', trials: (n) => `${n} en essai`, expiring: (n) => `${n} expirent sous 7 jours`,
    online: 'Commerçants en ligne', onlineSub: (m, t) => `${m} commerçant${m > 1 ? 's' : ''} · ${t} termina${t > 1 ? 'ux' : 'l'} ces 15 dernières minutes`, seen24h: (m, t) => `Dernières 24 h : ${m} commerçant${m > 1 ? 's' : ''} · ${t} termina${t > 1 ? 'ux' : 'l'}`,
    merchants: 'Commerçants actifs', pending: (n) => `${n} en attente d’approbation`, newLeads: (n) => `${n} nouveau${n > 1 ? 'x' : ''} prospect${n > 1 ? 's' : ''}`,
    chartTitle: 'Ventes portail, 7 derniers jours', chartSub: 'Total TTC par jour en MAD (heure du Maroc)',
    activity: 'Activité récente', viewAll: 'Voir tout le journal', noActivity: 'Aucune activité pour l’instant', by: 'par',
    exportTitle: 'Exporter les ventes portail', from: 'Du', to: 'Au',
    scopeNote: 'Comprend uniquement les ventes saisies sur le portail web commerçant. Les ventes des terminaux POS hors ligne n’y figurent pas encore.',
  },
  en: {
    title: 'Command Center', subtitle: 'Platform activity at a glance', updated: (t) => `Updated ${t} (Morocco time) · refreshes every minute`, refresh: 'Refresh',
    loading: 'Loading…', error: 'Could not load the figures', unavailable: 'Database unavailable',
    portalSales: 'Portal sales today', portalOnly: 'Web portal only', vsYesterday: 'vs yesterday at this time', noBase: 'No sales yesterday at this time',
    yesterdayFull: (v) => `Yesterday (full day): ${v} MAD`, salesCount: (n) => `${n} sale${n === 1 ? '' : 's'}`,
    licenses: 'Active licenses', trials: (n) => `${n} on trial`, expiring: (n) => `${n} expire within 7 days`,
    online: 'Merchants online', onlineSub: (m, t) => `${m} merchant${m === 1 ? '' : 's'} · ${t} terminal${t === 1 ? '' : 's'} in the last 15 min`, seen24h: (m, t) => `Last 24 h: ${m} merchant${m === 1 ? '' : 's'} · ${t} terminal${t === 1 ? '' : 's'}`,
    merchants: 'Active merchants', pending: (n) => `${n} awaiting approval`, newLeads: (n) => `${n} new lead${n === 1 ? '' : 's'}`,
    chartTitle: 'Portal sales, last 7 days', chartSub: 'Total incl. tax per day in MAD (Morocco time)',
    activity: 'Recent activity', viewAll: 'View the full log', noActivity: 'No activity yet', by: 'by',
    exportTitle: 'Export portal sales', from: 'From', to: 'To',
    scopeNote: 'Only sales recorded through the merchant web portal. Sales from offline POS terminals are not included yet.',
  },
};

function timeAgo(iso: string | Date, lang: Lang): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : lang, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86_400), 'day');
}

function moroccoClock(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }).format(new Date(iso));
}

function Card({ label, children, badge }: { label: string; children: ReactNode; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold text-[var(--adm-muted)]">{label}</h2>
        {badge && <span className="shrink-0 rounded-full border border-[var(--adm-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--adm-text2)]">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

const BIG = 'text-3xl font-extrabold tracking-tight text-[var(--adm-text)]';
const SUB = 'text-xs text-[var(--adm-muted)]';

export default function CommandCenter() {
  const { lang, locale, isRTL } = useAdmin();
  const c = COPY[lang];
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [tick, setTick] = useState(0);
  const fresh = useRef(false);
  const [from, setFrom] = useState(() => zonedDateKey(zonedDayStart(new Date(), undefined, -6)));
  const [to, setTo] = useState(() => zonedDateKey(new Date()));

  useEffect(() => {
    let cancelled = false;
    const url = fresh.current ? '/api/admin/dashboard?fresh=1' : '/api/admin/dashboard';
    fresh.current = false;
    type Result = { state: 'ok'; data: DashboardMetrics } | { state: 'error' | 'unavailable' };
    fetch(url)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        return { state: 'ok', data: (await r.json()) as DashboardMetrics };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') setData(res.data);
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [tick]);

  // Poll while the tab is visible; catch up as soon as it becomes visible again.
  useEffect(() => {
    let last = Date.now();
    const bump = () => { last = Date.now(); setTick((t) => t + 1); };
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') bump(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last >= POLL_MS) bump(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  function refresh() {
    fresh.current = true;
    setTick((t) => t + 1);
  }

  const r = data?.revenue;
  const change = r?.changePct ?? null;

  return (
    <section aria-labelledby="cc-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="cc-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{data ? c.updated(moroccoClock(data.generatedAt)) : c.subtitle}</p>
        </div>
        <button type="button" onClick={refresh} className={BTN}>{c.refresh}</button>
      </div>

      {state === 'error' && <p role="alert" className="text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="text-sm text-[var(--adm-error)]">{c.unavailable}</p>}
      {!data && state === 'loading' && <p className="text-sm text-[var(--adm-muted)]">{c.loading}</p>}

      {data && r && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card label={c.portalSales} badge={c.portalOnly}>
              <p className={BIG} data-kpi="revenue-today"><span dir="ltr">{fmtMad(r.today, lang)}</span> <span className="text-base font-bold text-[var(--adm-muted)]">MAD</span></p>
              <p className="text-sm font-semibold" data-kpi="revenue-change">
                {change === null
                  ? <span className="text-[var(--adm-muted)]">{c.noBase}</span>
                  : <span className={change >= 0 ? 'text-[var(--adm-good)]' : 'text-[var(--adm-error)]'}><span aria-hidden="true">{change >= 0 ? '▲' : '▼'}</span> <span dir="ltr">{change > 0 ? '+' : ''}{change.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')} %</span> <span className="font-normal text-[var(--adm-muted)]">{c.vsYesterday}</span></span>}
              </p>
              <p className={SUB}>{c.salesCount(r.todayCount)} · {c.yesterdayFull(fmtMad(r.yesterdayFull, lang))}</p>
            </Card>
            <Card label={c.licenses}>
              <p className={BIG} data-kpi="licenses-active">{data.licenses.active}</p>
              <p className={SUB}>{c.trials(data.licenses.trials)}</p>
              <p className={`${SUB} ${data.licenses.expiringSoon ? '!text-[var(--adm-text)] font-semibold' : ''}`}>{c.expiring(data.licenses.expiringSoon)}</p>
            </Card>
            <Card label={c.online}>
              <p className={BIG} data-kpi="merchants-online">
                <span aria-hidden="true" className={`me-2 inline-block h-2.5 w-2.5 rounded-full align-middle ${data.terminals.merchantsOnline ? 'bg-[var(--adm-good)]' : 'bg-[var(--adm-border)]'}`} />
                {data.terminals.merchantsOnline}
              </p>
              <p className={SUB}>{c.onlineSub(data.terminals.merchantsOnline, data.terminals.online)}</p>
              <p className={SUB} data-kpi="seen-24h">{c.seen24h(data.terminals.merchantsSeen24h, data.terminals.seen24h)}</p>
            </Card>
            <Card label={c.merchants}>
              <p className={BIG} data-kpi="merchants-approved">{data.merchants.approved}</p>
              <a href={`/${locale}/admin/merchants`} className={`${SUB} underline-offset-2 hover:underline`}>{c.pending(data.merchants.pending)}</a>
              <a href={`/${locale}/admin/leads`} className={`${SUB} underline-offset-2 hover:underline`}>{c.newLeads(data.leads.new)}</a>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="min-w-0 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-sm lg:col-span-2">
              <h2 className="text-base font-bold text-[var(--adm-text)]">{c.chartTitle}</h2>
              <p className="mb-3 text-xs text-[var(--adm-muted)]">{c.chartSub}</p>
              <SalesBarChart days={data.salesByDay} lang={lang} isRTL={isRTL} title={c.chartTitle} />
              <p className="mt-2 text-xs text-[var(--adm-muted)]">{c.scopeNote}</p>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--adm-border)] pt-4">
                <div className="flex flex-wrap items-end gap-3">
                  <span className="w-full text-sm font-semibold text-[var(--adm-text)]">{c.exportTitle}</span>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.from}
                    <input type="date" className={FIELD} value={from} max={to} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.to}
                    <input type="date" className={FIELD} value={to} min={from} onChange={(e) => setTo(e.target.value)} dir="ltr" />
                  </label>
                </div>
                <ExportButton dataset="sales" filters={{ from, to }} />
              </div>
            </div>

            <div className="min-w-0 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-[var(--adm-text)]">{c.activity}</h2>
                <a href={`/${locale}/admin/audit-logs`} className="text-xs font-semibold text-[var(--adm-accent)] underline-offset-2 hover:underline">{c.viewAll}</a>
              </div>
              {data.activity.length === 0 && <p className={SUB}>{c.noActivity}</p>}
              <ol className="flex flex-col" data-activity="">
                {data.activity.map((e) => {
                  const tone = TONE_STYLE[ACTION_TONE[e.action] ?? 'grey'];
                  return (
                    <li key={e.id} className="flex gap-3 border-t border-[var(--adm-border)] py-2.5 first:border-t-0">
                      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--adm-text)]">{ACTION_LABEL[lang][e.action] ?? e.action}</p>
                        <p className="truncate text-xs text-[var(--adm-muted)]">
                          {c.by} <span dir="auto">{e.actorName}</span> · <time dateTime={new Date(e.ts).toISOString()}>{timeAgo(e.ts, lang)}</time>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
