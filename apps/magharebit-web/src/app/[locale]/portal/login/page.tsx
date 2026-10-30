'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import Logo from '@/components/brand/Logo';

// ─── License key auto-formatter ───────────────────────────────────────────────
// MGH key format: MGH-YYYYMM-8hex-4hex-2hex  (27 chars + 4 dashes = 31 total)
// Segments: [3, 6, 8, 4, 2]
const KEY_SEGMENTS = [3, 6, 8, 4, 2]; // sum = 23 alphanum chars
function formatLicenseKey(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 23);
  const parts: string[] = [];
  let idx = 0;
  for (const len of KEY_SEGMENTS) {
    if (idx >= clean.length) break;
    parts.push(clean.slice(idx, idx + len));
    idx += len;
  }
  return parts.join('-');
}

// ─── Feature bullets shown in the brand column ───────────────────────────────
const FEATURES = [
  { icon: '⚡', text: 'يعمل بدون اتصال بالإنترنت' },
  { icon: '🌿', text: 'واجهة عربية أصيلة ومريحة' },
  { icon: '🛡️', text: 'دعم فني متواصل على مدار الساعة' },
];

export default function LoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  const [identifier, setIdentifier] = useState('');   // phone or email
  const [licenseKey, setLicenseKey] = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // Map API error codes to Arabic messages
  function errorMessage(code: string): string {
    const map: Record<string, string> = {
      identifier_required:        'يرجى إدخال رقم الهاتف أو البريد الإلكتروني',
      license_key_required:       'يرجى إدخال مفتاح الترخيص',
      invalid_license_key:        'مفتاح الترخيص غير صحيح',
      license_revoked:            'تم إلغاء هذا الترخيص',
      license_expired:            'انتهت صلاحية الترخيص — تواصل معنا للتجديد',
      account_not_found:          'لم يُعثر على حساب بهذه المعلومات',
      account_pending:            'حسابك قيد المراجعة — سيتم تفعيله قريباً',
      account_suspended:          'تم تعليق هذا الحساب — تواصل مع الدعم',
      license_not_for_this_account: 'مفتاح الترخيص لا ينتمي لهذا الحساب',
      service_unavailable:        'الخادم غير متاح مؤقتاً، حاول لاحقاً',
    };
    return map[code] ?? 'فشل تسجيل الدخول، حاول مرة أخرى';
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim(), licenseKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errorMessage(data.error ?? ''));
        return;
      }
      // Coming from a gated download (?next=/api/download/windows): continue to the installer.
      const next = new URLSearchParams(window.location.search).get('next') ?? '';
      if (/^\/api\/download\/(windows|android)\?locale=(ar|fr|en)$/.test(next)) {
        window.location.assign(next);
        return;
      }
      router.push(`/${locale}/portal/dashboard`);
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      direction: 'rtl',
      fontFamily: 'Noto Naskh Arabic, Cairo, serif',
    }}>

      {/* ── Left brand column (hidden on mobile) ── */}
      <div style={{
        display: 'none',
        flex: '0 0 60%',
        background: 'linear-gradient(135deg, #0A2318 0%, #0F3D2A 50%, #0A2318 100%)',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }}
        className="login-brand-col"
      >
        {/* Zellige watermark, the brand pattern used by the hero and the auth shell (design system: 4-6% opacity) */}
        <div
          aria-hidden="true"
          data-testid="login-zellige"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundColor: '#F0B429',
            WebkitMaskImage: "url('/brand/zellige-pattern.svg')",
            maskImage: "url('/brand/zellige-pattern.svg')",
            WebkitMaskSize: '368px 506.7px',
            maskSize: '368px 506.7px',
            opacity: 0.05,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '420px' }}>

          {/* Large hexagon logo */}
          <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{
              position: 'relative',
              width: '90px',
              height: '90px',
              filter: 'drop-shadow(0 0 32px rgba(240,180,41,0.45))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Logo height={84} on="dark" priority variant="emblem" />
            </div>
          </div>

          {/* Brand name */}
          <div style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 800,
            fontSize: '1.75rem',
            color: '#FFFFFF',
            letterSpacing: '-0.01em',
            marginBottom: '0.5rem',
          }}>
            MAGHAR<span style={{ color: '#F0B429' }}>EBIT</span>
          </div>

          {/* Tagline */}
          <p style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.90)',
            marginBottom: '0.5rem',
          }}>
            إدارة متجرك بذكاء
          </p>
          <p style={{
            fontSize: '0.9rem',
            color: 'rgba(255,255,255,0.45)',
            marginBottom: '3rem',
            lineHeight: 1.7,
          }}>
            بوابة التحكم الاحترافية لأصحاب المتاجر
          </p>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'right' }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '14px 18px',
              }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{f.icon}</span>
                <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.80)', fontWeight: 500 }}>
                  {f.text}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom decoration */}
          <div style={{
            marginTop: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.25)',
          }}>
            {BRAND.company.copyright} — Wayloz Group
          </div>
        </div>
      </div>

      {/* ── Right form column ── */}
      <div style={{
        flex: '1 1 40%',
        background: '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2.5rem 2rem',
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Mobile-only logo */}
          <div className="login-mobile-logo" style={{
            textAlign: 'center',
            marginBottom: '2rem',
          }}>
            {/* on="light": this block sits on the #F8F9FA form column */}
            <Logo height={32} on="light" variant="horizontal" />
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#111827',
              margin: '0 0 6px',
            }}>
              مرحباً بعودتك
            </h1>
            <p style={{
              fontSize: '0.875rem',
              color: '#6B7280',
              margin: 0,
            }}>
              أدخل رقم هاتفك أو بريدك الإلكتروني ومفتاح الترخيص
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} noValidate>

            {/* Identifier (phone or email) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label
                htmlFor="login-identifier"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}
              >
                رقم الهاتف أو البريد الإلكتروني
              </label>
              <input
                id="login-identifier"
                type="text"
                inputMode="email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="0612345678 أو example@email.com"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#FFFFFF',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '10px',
                  color: '#111827',
                  fontSize: '1rem',
                  outline: 'none',
                  direction: 'ltr',
                  textAlign: 'right',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0F3D2A'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />
            </div>

            {/* License key */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label
                htmlFor="login-license"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem',
                }}
              >
                مفتاح الترخيص
              </label>
              <input
                id="login-license"
                type="text"
                value={licenseKey}
                onChange={e => setLicenseKey(formatLicenseKey(e.target.value))}
                placeholder="MGH-202501-XXXXXXXX-XXXX-XX"
                required
                autoComplete="off"
                maxLength={31}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#FFFFFF',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '10px',
                  color: '#111827',
                  fontSize: '1rem',
                  outline: 'none',
                  direction: 'ltr',
                  textAlign: 'center',
                  letterSpacing: '0.12em',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#0F3D2A'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
              />
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '6px', margin: '6px 0 0' }}>
                مثال: MGH-202501-A1B2C3D4-E5F6-G7
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.25)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  color: '#DC2626',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: loading ? '#1a5c3a' : '#0F3D2A',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '1rem',
                borderRadius: '10px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, transform 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1a5c3a'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#0F3D2A'; }}
            >
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          {/* No account yet */}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <a
              href={`/${locale}/auth/signup`}
              style={{
                fontSize: '0.875rem',
                color: '#374151',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0F3D2A'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#374151'; }}
            >
              ليس لديك حساب؟{' '}
              <span style={{ color: '#0F3D2A', fontWeight: 600, textDecoration: 'underline' }}>
                ابدأ تجربتك المجانية
              </span>
            </a>
          </div>

          {/* Secondary links */}
          <div style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <a
              href={`/${locale}/demo`}
              style={{
                fontSize: '0.875rem',
                color: '#6B7280',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0F3D2A'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
            >
              هل تحتاج مفتاح ترخيص؟{' '}
              <span style={{ color: '#0F3D2A', fontWeight: 600, textDecoration: 'underline' }}>
                تواصل معنا
              </span>
            </a>
            <a
              href={`/${locale}`}
              style={{
                fontSize: '0.875rem',
                color: '#9CA3AF',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#6B7280'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
            >
              ← العودة إلى الموقع
            </a>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center',
            marginTop: '3rem',
            color: '#D1D5DB',
            fontSize: '0.75rem',
          }}>
            {BRAND.company.copyright} — Wayloz Group
          </p>
        </div>
      </div>

      {/* Responsive: show brand col on md+ */}
      <style>{`
        @media (min-width: 768px) {
          .login-brand-col { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
