'use client';

import { useState } from 'react';
import {
  formatPrice,
  computeDiscountAmount,
  isValidDiscount,
  discountNeedsApproval,
  type Discount,
} from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import ManagerPinModal from './ManagerPinModal';

interface DiscountModalProps {
  // The base amount the discount applies to (line HT, or cart subtotal HT).
  baseAmountPiastres: number;
  // 'line' or 'cart' — only affects the title.
  scope: 'line' | 'cart';
  existing?: Discount;
  onApply: (discount: Discount) => void;
  onCancel: () => void;
}

export default function DiscountModal({
  baseAmountPiastres,
  scope,
  existing,
  onApply,
  onCancel,
}: DiscountModalProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<'percentage' | 'fixed'>(existing?.type ?? 'percentage');
  const [valueStr, setValueStr] = useState<string>(
    existing
      ? existing.type === 'fixed'
        ? (existing.value / 100).toFixed(2)
        : String(existing.value)
      : '',
  );
  const [showApproval, setShowApproval] = useState(false);

  // For percentage the entered value is a percent; for fixed it is MAD → piastres.
  const numeric = Number(valueStr);
  const draft: Discount | null =
    valueStr.trim() === '' || !Number.isFinite(numeric)
      ? null
      : type === 'percentage'
        ? { type: 'percentage', value: numeric }
        : { type: 'fixed', value: Math.round(numeric * 100) };

  const valid = draft != null && isValidDiscount(draft);
  const amount = valid && draft ? computeDiscountAmount(baseAmountPiastres, draft) : 0;
  const needsApproval = valid && draft ? discountNeedsApproval(draft) : false;

  const handleApply = () => {
    if (!valid || !draft) return;
    if (needsApproval) {
      setShowApproval(true);
      return;
    }
    onApply(draft);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h2 className="text-lg font-bold text-[#0F172A] text-center mb-4">
          {scope === 'line' ? t.discount.titleLine : t.discount.titleCart}
        </h2>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          {(['percentage', 'fixed'] as const).map((ty) => (
            <button
              key={ty}
              onClick={() => setType(ty)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                type === ty
                  ? 'bg-[#2E8B57] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2E8B57]'
              }`}
            >
              {ty === 'percentage' ? t.discount.percentage : t.discount.fixed}
            </button>
          ))}
        </div>

        {/* Value input */}
        <label className="block text-sm font-semibold text-[#0F172A] mb-2">
          {t.discount.value}
        </label>
        <div className="relative mb-3">
          <input
            type="number"
            min="0"
            step={type === 'percentage' ? '1' : '0.01'}
            max={type === 'percentage' ? '100' : undefined}
            value={valueStr}
            onChange={(e) => setValueStr(e.target.value)}
            placeholder={type === 'percentage' ? '0' : '0.00'}
            autoFocus
            className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] text-lg font-mono"
          />
          <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">
            {type === 'percentage' ? '%' : 'MAD'}
          </span>
        </div>

        {/* Preview / validity */}
        {valueStr.trim() !== '' && !valid && (
          <p className="text-xs text-red-600 mb-3">{t.discount.invalid}</p>
        )}
        {valid && (
          <div className="flex justify-between items-center p-3 rounded-xl bg-[#F8FAFC] mb-3">
            <span className="text-sm text-[#64748B]">{t.discount.amount}</span>
            <span className="text-lg font-bold text-[#2E8B57]">− {formatPrice(amount)}</span>
          </div>
        )}
        {needsApproval && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center">
            👔 {t.discount.approvalRequired}
          </div>
        )}

        <button
          onClick={handleApply}
          disabled={!valid}
          className="w-full bg-[#2E8B57] hover:bg-[#1A5C3A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {t.discount.apply}
        </button>
        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
        >
          {t.discount.cancel}
        </button>
      </div>

      {/* Manager approval gate for over-threshold discounts */}
      {showApproval && draft && (
        <ManagerPinModal
          action="discount_over_limit"
          note={t.discount.approvalRequired}
          onAuthorized={(result) => {
            setShowApproval(false);
            onApply({ ...draft, managerApprovedBy: result.manager_id });
          }}
          onCancel={() => setShowApproval(false)}
        />
      )}
    </div>
  );
}
