'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang } from './adminUi';

export interface DayPoint { date: string; total: number; count: number }

const H = 232;
const PAD_TOP = 26;
const PAD_BOTTOM = 46;
const PAD_AXIS = 44; // room for the value axis labels (start side)
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const R = 4;

const COPY: Record<Lang, { today: string; sales: (n: number) => string; table: string; day: string; amount: string; receipts: string }> = {
  ar: { today: 'اليوم', sales: (n) => `${n} عملية بيع`, table: 'عرض كجدول', day: 'اليوم', amount: 'المبلغ (درهم)', receipts: 'عدد العمليات' },
  fr: { today: 'Aujourd’hui', sales: (n) => `${n} vente${n > 1 ? 's' : ''}`, table: 'Afficher en tableau', day: 'Jour', amount: 'Montant (MAD)', receipts: 'Ventes' },
  en: { today: 'Today', sales: (n) => `${n} sale${n === 1 ? '' : 's'}`, table: 'Show as table', day: 'Day', amount: 'Amount (MAD)', receipts: 'Sales' },
};

/** Western digits in every language (the Arabic UI too). */
export function numberLocale(lang: Lang): string {
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

export function fmtMad(n: number, lang: Lang): string {
  return new Intl.NumberFormat(numberLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtCompact(n: number, lang: Lang): string {
  return new Intl.NumberFormat(numberLocale(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Round the axis top up to 1, 2, 2.5 or 5 × 10^n, so gridlines land on readable values. */
function niceMax(max: number): number {
  if (max <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= max) return m * exp;
  return 10 * exp;
}

function dayLabel(date: string, lang: Lang): { weekday: string; dm: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA-u-nu-latn' : numberLocale(lang), { weekday: 'short', timeZone: 'UTC' }).format(d);
  return { weekday, dm: `${date.slice(8, 10)}/${date.slice(5, 7)}` };
}

/** Rounded top corners only: the data end is rounded, the bar stays anchored flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(R, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** 7-day bar chart, one series. Today's bar is highlighted and directly labelled; hover/focus shows each day. */
export default function SalesBarChart({ days, lang, isRTL, title }: { days: DayPoint[]; lang: Lang; isRTL: boolean; title: string }) {
  const c = COPY[lang];
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at the container's real width (not a scaled viewBox), so labels stay 11-12 px on a phone too.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(300, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const top = niceMax(Math.max(0, ...days.map((d) => d.total)));
  const ticks = [0, top / 2, top];
  const plotW = W - PAD_AXIS - 8;
  const band = plotW / Math.max(1, days.length);
  const barW = Math.min(52, band * 0.62);
  const axisX = isRTL ? W - PAD_AXIS : PAD_AXIS; // value labels sit on the start side
  const plotStart = isRTL ? 8 : PAD_AXIS;
  const slot = (i: number) => (isRTL ? days.length - 1 - i : i); // oldest day at the start side
  const cx = (i: number) => plotStart + band * slot(i) + band / 2;
  const y = (v: number) => PAD_TOP + PLOT_H - (v / top) * PLOT_H;
  const last = days.length - 1;
  const hovered = hover !== null ? days[hover] : null;

  return (
    <div ref={boxRef} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={title} className="block max-w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={plotStart} x2={plotStart + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--adm-border)' : 'var(--adm-grid)'} strokeWidth={1} />
            <text x={isRTL ? axisX + 8 : axisX - 8} y={y(t) + 4} textAnchor={isRTL ? 'start' : 'end'} fontSize={11} fill="var(--adm-muted)" direction="ltr">
              {fmtCompact(t, lang)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const isToday = i === last;
          const h = (d.total / top) * PLOT_H;
          const { weekday, dm } = dayLabel(d.date, lang);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} data-day={d.date}>
              {/* hit target: the whole band, wider than the bar */}
              <rect x={cx(i) - band / 2} y={PAD_TOP} width={band} height={PLOT_H + PAD_BOTTOM} fill="transparent" />
              <path
                d={barPath(cx(i) - barW / 2, y(d.total), barW, h)}
                fill={isToday ? 'var(--adm-chart-today)' : 'var(--adm-chart)'}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              {isToday && d.total > 0 && (
                <text x={cx(i)} y={y(d.total) - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--adm-text)" direction="ltr">
                  {fmtCompact(d.total, lang)}
                </text>
              )}
              <text x={cx(i)} y={PAD_TOP + PLOT_H + 18} textAnchor="middle" fontSize={12} fontWeight={isToday ? 700 : 400} fill={isToday ? 'var(--adm-text)' : 'var(--adm-muted)'}>
                {isToday && band >= 64 ? c.today : weekday /* narrow phone: the bold weekday marks today without overlapping */}
              </text>
              <text x={cx(i)} y={PAD_TOP + PLOT_H + 34} textAnchor="middle" fontSize={11} fill="var(--adm-muted)" direction="ltr">{dm}</text>
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(W - 70, Math.max(70, cx(hover))), top: Math.max(PAD_TOP, y(hovered.total) - 52) }}
        >
          <div className="font-semibold text-[var(--adm-text)]">{dayLabel(hovered.date, lang).weekday} <span dir="ltr">{dayLabel(hovered.date, lang).dm}</span></div>
          <div className="text-[var(--adm-text)]"><span dir="ltr">{fmtMad(hovered.total, lang)}</span> MAD</div>
          <div className="text-[var(--adm-muted)]">{c.sales(hovered.count)}</div>
        </div>
      )}

      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[var(--adm-muted)] hover:text-[var(--adm-text)]">{c.table}</summary>
        <table className="mt-2 w-full border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-xs text-[var(--adm-muted)]">
              <th scope="col" className="py-1 text-start font-semibold">{c.day}</th>
              <th scope="col" className="py-1 text-end font-semibold">{c.amount}</th>
              <th scope="col" className="py-1 text-end font-semibold">{c.receipts}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-[var(--adm-border)]">
                <td className="py-1.5">{dayLabel(d.date, lang).weekday} <span dir="ltr">{dayLabel(d.date, lang).dm}</span></td>
                <td className="py-1.5 text-end" dir="ltr">{fmtMad(d.total, lang)}</td>
                <td className="py-1.5 text-end">{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
