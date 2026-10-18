'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export default function NewsletterSignup() {
  const t = useTranslations('newsletter');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) {
      setError(t('error_phone'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\s/g, ''), locale }),
      });
      if (!res.ok) throw new Error('Network');
      setSuccess(true);
    } catch {
      setError(t('error_network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: 'rgba(240,180,41,0.04)',
        border: '1px solid rgba(240,180,41,0.15)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '480px',
        margin: '0 auto',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {success ? (
        <div
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.30)',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            fontFamily: fontBody,
            color: '#22C55E',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          ✓ {t('success')}
        </div>
      ) : (
        <>
          <h3
            style={{
              fontFamily: fontBody,
              fontSize: '16px',
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            {t('title')}
          </h3>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.60)',
              textAlign: 'center',
              marginBottom: '20px',
              lineHeight: 1.5,
            }}
          >
            {t('sub')}
          </p>
          <form onSubmit={handleSubmit} noValidate>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="06 XX XX XX XX"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: '15px',
                outline: 'none',
                marginBottom: '12px',
                direction: 'ltr',
                textAlign: 'center',
                letterSpacing: '0.05em',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <div role="alert" style={{ color: '#F87171', fontFamily: fontBody, fontSize: '12px', marginBottom: '10px', textAlign: 'center' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? 'rgba(240,180,41,0.5)' : '#F0B429',
                color: '#0A2318',
                fontFamily: fontBody,
                fontWeight: 700,
                fontSize: '14px',
                borderRadius: '999px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.40)',
              textAlign: 'center',
              marginTop: '12px',
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            {t('disclaimer')}
          </p>
        </>
      )}
    </div>
  );
}
