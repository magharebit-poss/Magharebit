'use client';

import { formatPrice, type ShiftSummary } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';

interface ZReportProps {
  summary: ShiftSummary;
  onDone: () => void;
}

const SMALL_VARIANCE_THRESHOLD = 5000; // 50 MAD in piastres

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function localeForLang(lang: 'ar' | 'fr' | 'en'): string {
  if (lang === 'ar') return 'ar-MA';
  if (lang === 'fr') return 'fr-MA';
  return 'en-GB';
}

function durationMinutes(opened: string, closed: string | null): number {
  const start = new Date(opened).getTime();
  const end = closed ? new Date(closed).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60_000));
}

function varianceColorClass(variance: number): string {
  const abs = Math.abs(variance);
  if (variance === 0) return 'text-green-600';
  if (abs <= SMALL_VARIANCE_THRESHOLD) return 'text-blue-600';
  return 'text-red-600';
}

const DIVIDER = '─────────────────────';

export default function ZReport({ summary, onDone }: ZReportProps) {
  const { t, lang } = useLanguage();
  const locale = localeForLang(lang);
  const variance = summary.cashVariance ?? 0;
  const expected = summary.expectedCash ?? 0;
  const actual = summary.closingCashCounted ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      {/* The receipt itself — only this prints */}
      <div className="z-report-print max-w-xs mx-auto bg-white font-mono text-sm p-4 shadow-sm">
        {/* Header */}
        <div className="text-center">
          <p className="font-bold text-base">{t.brand.name}</p>
          <p className="text-sm">{t.zReport.title}</p>
          <p>{DIVIDER}</p>
        </div>

        {/* Shift info */}
        <div className="space-y-1 mt-2">
          <Row label={t.zReport.shiftId} value={`...${summary.shiftId.slice(-8)}`} />
          <Row label={t.zReport.cashier} value={summary.cashierNameAr ?? '—'} />
          <Row label={t.zReport.opened} value={formatDateTime(summary.openedAt, locale)} />
          <Row label={t.zReport.closed} value={formatDateTime(summary.closedAt, locale)} />
          <Row
            label={t.zReport.duration}
            value={`${durationMinutes(summary.openedAt, summary.closedAt)} ${t.zReport.minutes}`}
          />
        </div>

        <p className="text-center my-2">{DIVIDER}</p>

        {/* Sales */}
        <p className="font-bold mb-1">{t.zReport.salesHeading}</p>
        <div className="space-y-1">
          <Row
            label={t.zReport.totalSales}
            value={formatPrice(summary.totalSalesPiastres)}
            bold
          />
          <Row label={t.zReport.transactions} value={String(summary.txCount)} />
          <Row
            label={`${t.zReport.cashSales} (${summary.cashCount}×)`}
            value={formatPrice(summary.cashTotalPiastres)}
          />
          <Row
            label={`${t.zReport.cardSales} (${summary.cardCount}×)`}
            value={formatPrice(summary.cardTotalPiastres)}
          />
          <Row label={t.zReport.tax} value={formatPrice(summary.totalTaxPiastres)} />
        </div>

        <p className="text-center my-2">{DIVIDER}</p>

        {/* Cash reconciliation */}
        <p className="font-bold mb-1">{t.zReport.cashHeading}</p>
        <div className="space-y-1">
          <Row label={t.zReport.openingFloat} value={formatPrice(summary.openingFloatPiastres)} />
          <Row label={t.zReport.expectedCash} value={formatPrice(expected)} />
          <Row label={t.zReport.actualCash} value={formatPrice(actual)} />
          <div className="flex justify-between">
            <span>{t.zReport.variance}:</span>
            <span className={`font-bold ${varianceColorClass(variance)}`}>
              {variance >= 0 ? '+' : '−'}
              {formatPrice(Math.abs(variance))}
            </span>
          </div>
        </div>

        <p className="text-center my-2">{DIVIDER}</p>

        {/* Tender breakdown (only when data available) */}
        {summary.tenderSummary && summary.tenderSummary.length > 0 && (
          <>
            <p className="font-bold mb-1">{t.zReport.tendersHeading}</p>
            <div className="space-y-1">
              {summary.tenderSummary.map((tender) => (
                <Row
                  key={tender.method}
                  label={`${tender.method} (${tender.txCount}×)`}
                  value={formatPrice(tender.totalPiastres)}
                />
              ))}
            </div>
            <p className="text-center my-2">{DIVIDER}</p>
          </>
        )}

        {/* Top 5 */}
        <p className="font-bold mb-1">{t.zReport.top5Heading}</p>
        {summary.topProducts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center">—</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-start pb-1">{t.zReport.colNum}</th>
                <th className="text-start pb-1">{t.zReport.colProduct}</th>
                <th className="text-end pb-1">{t.zReport.colQty}</th>
                <th className="text-end pb-1">{t.zReport.colTotal}</th>
              </tr>
            </thead>
            <tbody>
              {summary.topProducts.map((p, i) => (
                <tr key={p.productId}>
                  <td className="py-0.5">{i + 1}</td>
                  <td className="py-0.5 truncate max-w-[8ch]">{p.nameAr}</td>
                  <td className="py-0.5 text-end">{p.qty}</td>
                  <td className="py-0.5 text-end">{formatPrice(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-center my-2">{DIVIDER}</p>

        {/* Footer */}
        <p className="text-center">{t.zReport.footer}</p>
        <p className="text-center text-xs text-gray-400 mt-1">
          {formatDateTime(new Date().toISOString(), locale)}
        </p>
      </div>

      {/* Buttons — hidden on print via globals.css */}
      <div className="z-report-actions max-w-xs mx-auto mt-6 flex gap-2 justify-center">
        <button
          onClick={() => window.print()}
          className="bg-[#2E8B57] hover:bg-[#1A5C3A] text-white rounded-lg px-6 py-2 font-semibold transition-colors"
        >
          {t.zReport.print}
        </button>
        <button
          onClick={onDone}
          className="border border-[#E2E8F0] text-[#374151] rounded-lg px-6 py-2 font-medium hover:bg-white transition-colors"
        >
          {t.zReport.done}
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  bold?: boolean;
}

function Row({ label, value, bold }: RowProps) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-700">{label}:</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-900'}>{value}</span>
    </div>
  );
}
