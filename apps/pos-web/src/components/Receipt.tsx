'use client';

import { formatPrice, type CartLine, type TaxSummaryLine } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import type { MerchantBranding } from '../lib/branding';
import { pickName } from '../lib/names';

export interface ReceiptData {
  receiptNumber: string;
  timestamp: string; // ISO, server-authoritative
  cashierName: string;
  lines: CartLine[];
  totalDiscountPiastres?: number; // line + cart discounts combined
  totalPiastres: number;
  paymentMethod: 'cash' | 'card' | 'lana';
  branding: MerchantBranding;
  // ── Offline-first: set when transaction was queued locally (no server yet) ──
  isOfflineQueued?: boolean;
  // ── Invoice mode (set after POST /invoices/generate succeeds) ──
  isInvoice?: boolean;
  invoiceNumber?: string | null;
  taxSummary?: TaxSummaryLine[];
}

interface ReceiptProps {
  data: ReceiptData;
  onDone: () => void;
  // Invoice generation callbacks — present only when invoice not yet generated.
  onGenerateInvoice?: () => void;
  invoiceGenerating?: boolean;
  invoiceError?: string | null;
}

const DIVIDER = '────────────────────────';

function localeForLang(lang: 'ar' | 'fr' | 'en'): string {
  if (lang === 'ar') return 'ar-MA';
  if (lang === 'fr') return 'fr-MA';
  return 'en-GB';
}

export default function Receipt({
  data,
  onDone,
  onGenerateInvoice,
  invoiceGenerating = false,
  invoiceError = null,
}: ReceiptProps) {
  const { t, lang, dir } = useLanguage();
  const { branding } = data;
  const locale = localeForLang(lang);

  const productName = (line: CartLine): string =>
    pickName(lang, line.product.name_ar, line.product.name_fr);

  const paymentLabel =
    data.paymentMethod === 'cash'
      ? t.receipt.paymentCash
      : data.paymentMethod === 'card'
        ? t.receipt.paymentCard
        : data.paymentMethod;

  // Format piastres as MAD with 2 decimal places for the compact TVA table.
  const fmt = (p: number) => `${(p / 100).toFixed(2)} MAD`;

  // ICE to show in invoice mode. Prefer branding.ice; fall back to branding.taxId
  // only if they differ (taxId is already shown above in the standard receipt header).
  const invoiceIce = branding.ice ?? (branding.taxId ? branding.taxId : null);
  const showInvoiceIce = data.isInvoice && invoiceIce && invoiceIce !== branding.taxId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-xs">
        {/* Offline-queued amber banner — hidden on print */}
        {data.isOfflineQueued && (
          <div className="receipt-actions mb-3 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-900/30 px-4 py-2.5 text-sm text-amber-300">
            <span className="text-base">⏱</span>
            <span>{t.sync.provisional} — {t.sync.willSync}</span>
          </div>
        )}
        {/* The receipt itself — only this prints (see .receipt-print in globals.css) */}
        <div
          className="receipt-print bg-white font-mono text-sm p-4 shadow-sm mx-auto"
          dir={dir}
        >
          {/* ── Merchant branding ── */}
          <div className="text-center">
            {branding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="mx-auto mb-2 max-w-[60mm] max-h-[20mm] object-contain"
              />
            )}
            <p className="font-bold text-base">{branding.name}</p>
            {branding.address && <p className="text-xs">{branding.address}</p>}
            {branding.phone && <p className="text-xs">{branding.phone}</p>}
            {branding.taxId && (
              <p className="text-xs">
                {t.receipt.taxIdLabel}: {branding.taxId}
              </p>
            )}
            {/* ── Invoice-only fiscal identifiers ── */}
            {data.isInvoice && (
              <div className="text-xs mt-0.5 space-y-0">
                {showInvoiceIce && (
                  <p>{t.invoice.iceLabel}: {invoiceIce}</p>
                )}
                {branding.if_ && <p>{t.invoice.ifLabel}: {branding.if_}</p>}
                {branding.rc && <p>{t.invoice.rcLabel}: {branding.rc}</p>}
              </div>
            )}
          </div>

          {/* ── Invoice title badge (invoice mode only) ── */}
          {data.isInvoice && (
            <>
              <p className="text-center my-2">{DIVIDER}</p>
              <p className="text-center font-bold text-sm tracking-widest uppercase">
                {t.invoice.title}
              </p>
            </>
          )}

          <p className="text-center my-2">{DIVIDER}</p>

          {/* ── Receipt / Invoice meta ── */}
          <div className="space-y-1">
            <Row label={t.receipt.receiptNo} value={data.receiptNumber} bold />
            {data.isInvoice && data.invoiceNumber && (
              <Row label={t.invoice.invoiceNo} value={data.invoiceNumber} bold />
            )}
            <Row
              label={t.receipt.date}
              value={new Date(data.timestamp).toLocaleString(locale, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
            <Row label={t.receipt.cashier} value={data.cashierName || '—'} />
          </div>

          <p className="text-center my-2">{DIVIDER}</p>

          {/* ── Line items ── */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-start pb-1">{t.receipt.item}</th>
                <th className="text-end pb-1">{t.receipt.qty}</th>
                <th className="text-end pb-1">{t.receipt.unitPrice}</th>
                <th className="text-end pb-1">{t.receipt.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.lineId}>
                  <td className="py-0.5 pe-1 break-words max-w-[28mm]">
                    {productName(line)}
                    {line.discount && (
                      <span className="block text-[10px] text-gray-500">
                        <span className="line-through">
                          {formatPrice(line.unitPricePiastres * line.quantity)}
                        </span>{' '}
                        {line.discount.type === 'percentage'
                          ? `−${line.discount.value}%`
                          : `−${formatPrice(line.discount.value)}`}
                      </span>
                    )}
                  </td>
                  <td className="py-0.5 text-end">{line.quantity}</td>
                  <td className="py-0.5 text-end whitespace-nowrap">
                    {formatPrice(line.unitPricePiastres)}
                  </td>
                  <td className="py-0.5 text-end whitespace-nowrap">
                    {formatPrice(line.lineTotalPiastres)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-center my-2">{DIVIDER}</p>

          {/* ── Discount summary (combined per-line + per-cart) ── */}
          {data.totalDiscountPiastres != null && data.totalDiscountPiastres > 0 && (
            <div className="flex justify-between mb-1">
              <span>{t.discount.label}</span>
              <span>− {formatPrice(data.totalDiscountPiastres)}</span>
            </div>
          )}

          {/* ── TVA breakdown table (invoice mode only) ── */}
          {data.isInvoice && data.taxSummary && data.taxSummary.length > 0 && (
            <table className="w-full text-[10px] mb-2 border border-gray-300">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="text-center px-1 py-0.5">{t.invoice.taxRate}</th>
                  <th className="text-end px-1 py-0.5">{t.invoice.taxBaseHT}</th>
                  <th className="text-end px-1 py-0.5">{t.invoice.taxAmount}</th>
                  <th className="text-end px-1 py-0.5">{t.invoice.taxTotalTTC}</th>
                </tr>
              </thead>
              <tbody>
                {data.taxSummary.map((row) => (
                  <tr key={row.rate} className="border-b border-gray-200 last:border-0">
                    <td className="text-center px-1 py-0.5">
                      {Math.round(row.rate * 100)}%
                    </td>
                    <td className="text-end px-1 py-0.5 whitespace-nowrap">
                      {fmt(row.htPiastres)}
                    </td>
                    <td className="text-end px-1 py-0.5 whitespace-nowrap">
                      {fmt(row.tvaPiastres)}
                    </td>
                    <td className="text-end px-1 py-0.5 whitespace-nowrap">
                      {fmt(row.ttcPiastres)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── Total ── */}
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-base">{t.receipt.total}</span>
            <span className="font-bold text-lg">{formatPrice(data.totalPiastres)}</span>
          </div>
          <Row label={t.receipt.paymentLabel} value={paymentLabel} />

          <p className="text-center my-2">{DIVIDER}</p>

          {/* ── Footer ── */}
          <p className="text-center">{t.receipt.thankYou}</p>

          {/* ── Legal disclaimer (invoice mode only) ── */}
          {data.isInvoice && (
            <p className="text-center text-[10px] text-gray-500 mt-1">
              {t.invoice.disclaimer}
            </p>
          )}
        </div>

        {/* Buttons — hidden on print via .receipt-actions */}
        <div className="receipt-actions mt-6 flex flex-col gap-2 items-center">
          {/* ── "Generate invoice" button — above Print/New Sale so it is always
               in the visible area immediately below the receipt paper ── */}
          {!data.isInvoice && !data.isOfflineQueued && onGenerateInvoice && (
            <div className="w-full">
              <button
                onClick={onGenerateInvoice}
                disabled={invoiceGenerating}
                className="w-full border border-amber-400/60 text-amber-200 rounded-lg px-6 py-2 font-medium hover:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {invoiceGenerating ? t.invoice.generating : t.invoice.generate}
              </button>
              {invoiceError && (
                <p className="text-center text-xs text-red-400 mt-1">{invoiceError}</p>
              )}
            </div>
          )}

          {/* ── Invoice number badge — shown once invoice is generated ── */}
          {data.isInvoice && data.invoiceNumber && (
            <p className="text-center text-xs text-amber-300 font-mono">
              {t.invoice.generated.replace('{n}', data.invoiceNumber)}
            </p>
          )}

          <div className="flex gap-2 justify-center w-full">
            <button
              onClick={() => window.print()}
              className="bg-[#2E8B57] hover:bg-[#1A5C3A] text-white rounded-lg px-6 py-2 font-semibold transition-colors"
            >
              {t.receipt.print}
            </button>
            <button
              onClick={onDone}
              className="border border-white/40 text-white rounded-lg px-6 py-2 font-medium hover:bg-white/10 transition-colors"
            >
              {t.receipt.newSale}
            </button>
          </div>
        </div>
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
