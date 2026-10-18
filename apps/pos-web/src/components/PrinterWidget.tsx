'use client';

import { useEffect, useState } from 'react';
import {
  isWebUsbSupported,
  connectPrinter,
  disconnectPrinter,
  getStatus,
  onStatusChange,
  type PrinterStatus,
} from '../lib/printer/printer-manager';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  onClose: () => void;
}

export function PrinterWidget({ onClose }: Props) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<PrinterStatus>(() => getStatus());
  const [error, setError] = useState<string | null>(null);
  const supported = isWebUsbSupported();

  useEffect(() => {
    const unsub = onStatusChange(setStatus);
    return unsub;
  }, []);

  async function handleConnect() {
    setError(null);
    try {
      await connectPrinter();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('No device selected')) {
        setError(msg);
      }
    }
  }

  async function handleDisconnect() {
    setError(null);
    await disconnectPrinter();
  }

  const statusLabel: Record<PrinterStatus, string> = {
    disconnected: t.printer.statusDisconnected,
    connecting: t.printer.statusConnecting,
    connected: t.printer.statusConnected,
    error: t.printer.statusError,
  };

  const statusColor: Record<PrinterStatus, string> = {
    disconnected: 'text-[#94A3B8]',
    connecting: 'text-amber-500',
    connected: 'text-emerald-600',
    error: 'text-red-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-lg font-bold text-[#0F172A]">🖨️ {t.pos.printerSetup}</h2>
          <button
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none"
            aria-label={t.payment.close}
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!supported ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
              <p className="font-semibold">{t.printer.noWebUsb}</p>
              <p className="mt-1 text-xs">{t.printer.noWebUsbHint}</p>
            </div>
          ) : (
            <>
              {/* Status pill */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">{t.printer.status}</span>
                <span className={`text-sm font-semibold ${statusColor[status]}`}>
                  {statusLabel[status]}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                {t.printer.supported}
              </p>

              {/* Actions */}
              {status === 'disconnected' || status === 'error' ? (
                <button
                  onClick={handleConnect}
                  className="w-full py-3 rounded-xl bg-[#2E8B57] text-white font-semibold text-sm hover:bg-[#257048] transition-colors"
                >
                  {t.printer.connect}
                </button>
              ) : status === 'connecting' ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-[#E2E8F0] text-[#94A3B8] font-semibold text-sm cursor-not-allowed"
                >
                  {t.printer.connecting}
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
                >
                  {t.printer.disconnect}
                </button>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-xs">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-[#E2E8F0] text-[#64748B] text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
          >
            {t.payment.close}
          </button>
        </div>
      </div>
    </div>
  );
}
