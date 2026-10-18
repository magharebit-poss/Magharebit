'use client';

import { useRef } from 'react';
import { formatPrice } from '../lib/cart';
import type { Product } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';

interface MarkdownLabelProps {
  product: Product;
  onClose: () => void;
}

export default function MarkdownLabel({ product, onClose }: MarkdownLabelProps) {
  const { t } = useLanguage();
  const labelRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!labelRef.current) return;
    const html = labelRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; width: 80mm; padding: 4mm; background: #fff; color: #000; }
  .label { border: 2px solid #000; border-radius: 4px; padding: 8px; text-align: center; }
  .name-ar { font-size: 18px; font-weight: bold; direction: rtl; margin-bottom: 4px; }
  .name-fr { font-size: 14px; color: #333; margin-bottom: 8px; }
  .badge { display: inline-block; background: #dc2626; color: #fff; font-size: 20px; font-weight: bold; padding: 4px 10px; border-radius: 20px; margin-bottom: 8px; }
  .price-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .original { font-size: 14px; color: #888; text-decoration: line-through; }
  .effective { font-size: 28px; font-weight: bold; color: #000; }
  .date { font-size: 9px; color: #aaa; margin-top: 8px; }
</style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const markdownPct = product.current_markdown_percent;
  const effectivePrice = product.effective_price_cents;
  const printedAt = new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0F172A]">{t.markdown.modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] text-xl leading-none"
            aria-label={t.markdown.close}
          >
            ×
          </button>
        </div>

        {/* Label preview — this HTML is also sent to the print window */}
        <div ref={labelRef} className="label border-2 border-black rounded-lg p-3 text-center mb-4">
          <div className="name-ar text-lg font-bold" style={{ direction: 'rtl' }}>{product.name_ar}</div>
          <div className="name-fr text-sm text-gray-600 mb-2">{product.name_fr}</div>

          {markdownPct != null && (
            <span className="badge inline-block bg-red-600 text-white text-xl font-bold px-3 py-1 rounded-full mb-2">
              −{markdownPct}%
            </span>
          )}

          <div className="price-row flex items-center justify-center gap-2">
            {markdownPct != null && (
              <span className="original text-sm text-gray-400 line-through">
                {formatPrice(product.price_cents)}
              </span>
            )}
            <span className="effective text-3xl font-extrabold text-black">
              {formatPrice(effectivePrice)}
            </span>
          </div>

          <div className="date text-[9px] text-gray-400 mt-2">{printedAt}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {t.markdown.printButton}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] text-sm"
          >
            {t.markdown.close}
          </button>
        </div>
      </div>
    </div>
  );
}
