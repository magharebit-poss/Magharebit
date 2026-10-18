'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const SUPPRESS_KEY = 'exit_intent_shown';
// Once dismissed/submitted in this session, do not show again
function isSuppressed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SUPPRESS_KEY) === '1';
  } catch {
    return false;
  }
}
function markSuppressed() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SUPPRESS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
  return parts.join(' ');
}

export default function ExitIntentModal() {
  const locale = useLocale();
  const t = useTranslations('exit_intent');
  const pathname = usePathname();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Suppress modal on /demo page and portal — visitor is already converting
  const shouldShowOnThisPage =
    pathname &&
    !pathname.includes('/demo') &&
    !pathname.includes('/portal') &&
    !pathname.includes('/admin');

  useEffect(() => {
    if (!shouldShowOnThisPage) return;
    if (isSuppressed()) return;

    let mobileTimer: ReturnType<typeof setTimeout> | null = null;
    let triggered = false;

    const trigger = () => {
      if (triggered) return;
      if (isSuppressed()) return;
      triggered = true;
      setOpen(true);
    };

    // Desktop: mouse leaves the top of the viewport
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 0) trigger();
    };

    // Mobile-ish: trigger after 45s of inactivity since first interaction
    const isCoarse =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches;

    if (isCoarse) {
      const startTimer = () => {
        if (mobileTimer) clearTimeout(mobileTimer);
        mobileTimer = setTimeout(trigger, 45000);
      };
      // Start timer after the first interaction (any touch / scroll)
      const onFirstInteract = () => {
        startTimer();
        window.removeEventListener('touchstart', onFirstInteract);
        window.removeEventListener('scroll', onFirstInteract);
      };
      window.addEventListener('touchstart', onFirstInteract, { once: true });
      window.addEventListener('scroll', onFirstInteract, { once: true });
    } else {
      document.addEventListener('mouseleave', onMouseLeave);
    }

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, [shouldShowOnThisPage]);

  const close = () => {
    setOpen(false);
    markSuppressed();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (!/^0[5-7]\d{8}$/.test(digits)) {
      setError(t('error_phone'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/quick-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: digits,
          locale,
          page: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
      });
      if (!res.ok) throw new Error('Network');
      setSubmitted(true);
      markSuppressed();
      setTimeout(() => setOpen(false), 2000);
    } catch {
      setError(t('error_network'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div
        style={{
          background: '#0A2318',
          border: '1px solid rgba(240,180,41,0.25)',
          borderRadius: '20px',
          padding: '40px 32px',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          position: 'relative',
          fontFamily: fontBody,
          boxShadow: '0 20px 60px rgba(0,0,0,0.50)',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            ...(isRTL ? { left: '16px' } : { right: '16px' }),
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.40)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>

        {/* Header emoji */}
        <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '16px' }}>📱</div>

        {/* Title */}
        <h2
          style={{
            fontFamily: fontBody,
            fontWeight: 700,
            fontSize: '22px',
            color: '#FFFFFF',
            marginBottom: '10px',
            lineHeight: 1.3,
          }}
        >
          {t('title')}
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: fontBody,
            fontSize: '14px',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          {t('subtitle')}
        </p>

        {submitted ? (
          <div
            style={{
              background: 'rgba(34,197,94,0.10)',
              border: '1px solid rgba(34,197,94,0.30)',
              borderRadius: '10px',
              padding: '14px',
              color: '#22C55E',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            ✓ {t('success')}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder={t('placeholder')}
              autoFocus
              dir="ltr"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: error ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: '#FFFFFF',
                fontFamily: 'monospace',
                fontSize: '16px',
                textAlign: 'center',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <div
                role="alert"
                style={{ color: '#F87171', fontSize: '12px', marginBottom: '10px' }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                background: submitting ? 'rgba(240,180,41,0.5)' : '#F0B429',
                color: '#0A2318',
                border: 'none',
                borderRadius: '999px',
                padding: '14px',
                fontFamily: fontBody,
                fontSize: '15px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              {submitting ? t('submitting') : t('submit')}
            </button>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.40)',
                marginTop: '14px',
                marginBottom: 0,
              }}
            >
              {t('reassure')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
