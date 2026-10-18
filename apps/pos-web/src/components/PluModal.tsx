'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { findProductByCode, type Product } from '../lib/cart';

interface PluModalProps {
  products: Product[];
  onProductFound: (product: Product) => void;
  onClose: () => void;
}

export default function PluModal({ products, onProductFound, onClose }: PluModalProps) {
  const { t, lang } = useLanguage();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Auto-focus the input on open so both touch typing and a USB-HID barcode
  // scanner (which types + presses Enter) land directly in the field.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runLookup = () => {
    const code = input.trim();
    if (code.length === 0) return;
    const product = findProductByCode(code, products);
    if (product) {
      // Let the parent update the cart; do not clear input first.
      onProductFound(product);
      onClose();
    } else {
      // Keep the modal open so the cashier can correct or retry.
      setError(t.pos.productNotFound);
    }
  };

  // Enter triggers the lookup. A USB-HID scanner ends its scan with Enter, so
  // this same handler auto-confirms a physical scan. The input is NOT inside a
  // <form>, so there is no accidental page navigation on submit.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runLookup();
    }
  };

  const appendKey = (digit: string) => {
    setError(null);
    setInput((prev) => prev + digit);
    inputRef.current?.focus();
  };

  const backspace = () => {
    setError(null);
    setInput((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  };

  const clearAll = () => {
    setError(null);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir={dir}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-6">{t.pos.manualPlu}</h2>

        {/* Code input — auto-focused, accepts any character (scanner or keypad) */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => {
            setError(null);
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t.pos.pluHint}
          className="w-full h-14 px-4 mb-2 rounded-xl border border-[#E2E8F0] text-center text-2xl font-bold tracking-widest text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent"
        />
        <p className="text-xs text-[#94A3B8] text-center mb-4">{t.pos.pluHint}</p>

        {error && <p className="text-center text-sm text-red-600 mb-3">{error}</p>}

        {/* Numeric keypad for touchscreen use */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button
              key={k}
              onClick={() => appendKey(k)}
              className="w-16 h-16 rounded-xl bg-white border border-[#E2E8F0] text-xl font-bold text-[#0F172A] hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-all duration-150 mx-auto"
            >
              {k}
            </button>
          ))}
          <button
            onClick={backspace}
            className="w-16 h-16 rounded-xl bg-white border border-[#E2E8F0] text-xl font-bold text-[#64748B] hover:bg-red-50 transition-all duration-150 mx-auto"
          >
            ⌫
          </button>
          <button
            onClick={() => appendKey('0')}
            className="w-16 h-16 rounded-xl bg-white border border-[#E2E8F0] text-xl font-bold text-[#0F172A] hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-all duration-150 mx-auto"
          >
            0
          </button>
          <button
            onClick={clearAll}
            className="w-16 h-16 rounded-xl bg-white border border-[#E2E8F0] text-sm font-medium text-[#64748B] hover:bg-red-50 transition-all duration-150 mx-auto"
          >
            ✕
          </button>
        </div>

        {/* Confirm */}
        <button
          onClick={runLookup}
          className="w-full py-3 rounded-xl bg-[#2E8B57] text-white font-semibold hover:bg-[#256F46] transition-colors"
        >
          {t.pos.pluSearch}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm text-[#64748B] hover:text-[#0F172A] border-t border-[#F1F5F9] pt-4"
        >
          {t.pos.pluClose}
        </button>
      </div>
    </div>
  );
}
