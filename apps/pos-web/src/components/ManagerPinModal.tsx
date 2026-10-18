'use client';

import { useRef, useState } from 'react';
import { TOKEN_KEY } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

export interface ManagerOverrideResult {
  authorized: true;
  manager_id: string;
  action: string;
}

interface Props {
  action: string;           // e.g. 'discount_over_limit'
  referenceId?: string;     // optional transaction / cart id
  note?: string;            // optional human-readable description
  onAuthorized: (result: ManagerOverrideResult) => void;
  onCancel: () => void;
}

export default function ManagerPinModal({
  action,
  referenceId,
  note,
  onAuthorized,
  onCancel,
}: Props) {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError(t.managerPin.enterFullPin);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem(TOKEN_KEY) ?? '';
      const res = await fetch('/api/auth/manager-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          managerPin: pin,
          action,
          referenceId,
          note,
        }),
      });

      const data = (await res.json()) as
        | ManagerOverrideResult
        | { error: string; message?: string };

      if (!res.ok || !('authorized' in data)) {
        const msg =
          'message' in data
            ? (data as { message: string }).message
            : t.managerPin.invalidPin;
        setError(msg);
        setPin('');
        inputRef.current?.focus();
        return;
      }

      onAuthorized(data as ManagerOverrideResult);
    } catch {
      setError(t.managerPin.errorConnection);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#E0E0E0] w-full max-w-sm mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0] bg-[#FFF8E1]">
          <h2 className="text-base font-bold text-[#1A1A1A]">🔒 {t.managerPin.authTitle}</h2>
          <button
            onClick={onCancel}
            className="text-[#757575] hover:text-[#1A1A1A] text-2xl leading-none"
            aria-label={t.payment.close}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-[#757575]">
            {t.managerPin.promptBody}
          </p>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#1A1A1A]" htmlFor="manager-pin-input">
              {t.managerPin.pinLabel}
            </label>
            <input
              id="manager-pin-input"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={loading}
              placeholder="••••"
              dir="ltr"
              className="w-full border border-[#E0E0E0] rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#FF9800] disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-[#D32F2F] text-center font-medium">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 border border-[#E0E0E0] rounded-xl text-sm font-medium text-[#757575] hover:bg-[#F5F5F0] disabled:opacity-50 transition-colors"
          >
            {t.managerPin.cancel}
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading || pin.length < 4}
            className="flex-1 py-3 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : t.managerPin.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
