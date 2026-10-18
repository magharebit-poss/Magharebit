'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useLanguage } from '../context/LanguageContext';

declare global {
  interface Window {
    BarcodeDetector?: unknown;
  }
}

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
  title?: string;
}

const SCANNER_ELEMENT_ID = 'qr-scanner-container';

export default function BarcodeScanner({ onDetected, onClose, title }: BarcodeScannerProps) {
  const { t } = useLanguage();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const stoppedRef = useRef(false);
  // true only after scanner.start() resolves — guards against stop() being
  // called before start() completes (React StrictMode / fast unmount).
  const runningRef = useRef(false);

  const safeStop = (s: Html5Qrcode) => {
    if (!runningRef.current) return Promise.resolve();
    runningRef.current = false;
    return s.stop().catch(() => {});
  };

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (stoppedRef.current) return;
          stoppedRef.current = true;
          safeStop(scanner).finally(() => {
            onDetected(decodedText);
          });
        },
        undefined,
      )
      .then(() => {
        runningRef.current = true;
      })
      .catch((err: unknown) => {
        const msg = String(err);
        if (
          (err instanceof Error && err.name === 'NotAllowedError') ||
          msg.includes('NotAllowed') ||
          msg.includes('Permission')
        ) {
          setPermissionDenied(true);
        }
      });

    return () => {
      if (!stoppedRef.current) {
        stoppedRef.current = true;
        safeStop(scanner);
      }
    };
    // onDetected is stable (parent binds with useCallback or inline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (!stoppedRef.current) {
      stoppedRef.current = true;
      if (scannerRef.current) safeStop(scannerRef.current);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <h2 className="text-white font-semibold font-cairo text-lg">
          {title ?? `📷 ${t.barcode.defaultTitle}`}
        </h2>
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl hover:bg-white/20 transition-colors"
          aria-label={t.payment.close}
        >
          ✕
        </button>
      </div>

      {/* Center */}
      <div className="flex-1 flex items-center justify-center p-6">
        {permissionDenied ? (
          <div className="bg-white rounded-2xl p-8 max-w-xs text-center">
            <p className="text-4xl mb-4">📷</p>
            <p className="text-sm font-semibold text-[#0F172A] font-cairo mb-2">
              {t.barcode.permissionDenied}
            </p>
            <p className="text-xs text-[#64748B] mb-4">
              {t.barcode.permissionNote}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-[#2E8B57] text-white py-2 rounded-xl text-sm font-medium hover:bg-[#1A5C3A] transition-colors"
              >
                {t.barcode.retry}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 border border-[#E2E8F0] text-[#64748B] py-2 rounded-xl text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                {t.payment.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <div
              id={SCANNER_ELEMENT_ID}
              className="w-full rounded-xl overflow-hidden mx-auto"
            />
            <p className="text-white/70 text-sm font-cairo text-center mt-4">
              📷 {t.barcode.aim}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
