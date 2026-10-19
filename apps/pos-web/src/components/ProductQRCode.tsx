'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLanguage } from '../context/LanguageContext';

interface ProductForQR {
  product_id: string;
  name_ar: string;
  price_cents: number;
  barcode?: string | null;
  plu_code?: string | null;
}

interface ProductQRCodeProps {
  product: ProductForQR;
  onClose: () => void;
}

export default function ProductQRCode({ product, onClose }: ProductQRCodeProps) {
  const { t } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const payload = JSON.stringify({
      id: product.product_id,
      b: product.barcode ?? product.plu_code ?? product.product_id,
    });
    QRCode.toDataURL(payload, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    }).then(setQrDataUrl).catch(() => {});
  }, [product]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `magharebit-qr-${product.plu_code ?? product.product_id.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl">
        <h2 className="text-lg font-bold text-[#0F172A] font-cairo text-center mb-4">
          {product.name_ar}
        </h2>

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            className="w-48 h-48 mx-auto rounded-lg shadow-sm"
          />
        ) : (
          <div className="w-48 h-48 mx-auto bg-[#F8FAFC] rounded-lg flex items-center justify-center text-[#94A3B8] text-sm font-cairo">
            {t.productQR.generating}
          </div>
        )}

        {(product.barcode ?? product.plu_code) && (
          <p className="font-mono text-xs text-center text-[#94A3B8] mt-2">
            {product.barcode ?? product.plu_code}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="flex-1 bg-[#2E8B57] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1A5C3A] transition-colors disabled:opacity-50"
          >
            {t.productQR.download}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-[#E2E8F0] text-[#64748B] py-2.5 rounded-xl text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
          >
            {t.payment.close}
          </button>
        </div>
      </div>
    </div>
  );
}
