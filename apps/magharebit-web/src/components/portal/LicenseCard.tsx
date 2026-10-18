'use client';

import { useState, useCallback } from 'react';

export interface LicenseCardProps {
  licenseKey:    string | null;
  plan:          string | null;
  isTrial:       boolean;
  daysRemaining: number | null;
  expiresAt:     string | null;
}

type CopyState = 'idle' | 'copied' | 'error';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ isTrial, daysRemaining }: { isTrial: boolean; daysRemaining: number | null }) {
  if (daysRemaining === 0 || daysRemaining !== null && daysRemaining < 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: '#FEE2E2', color: '#B91C1C',
        borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600,
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
        منتهي الصلاحية
      </span>
    );
  }
  if (isTrial) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        background: '#FEF3C7', color: '#92400E',
        borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600,
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
        تجريبي
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: '#DCFCE7', color: '#166534',
      borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 600,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
      نشط
    </span>
  );
}

// ── Plan icon ─────────────────────────────────────────────────────────────────

function planIcon(plan: string | null): string {
  switch (plan) {
    case 'Business':    return '🚀';
    case 'Enterprise':  return '🏢';
    default:            return '⚡';
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LicenseCard({
  licenseKey,
  plan,
  isTrial,
  daysRemaining,
  expiresAt,
}: LicenseCardProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const handleCopy = useCallback(() => {
    if (!licenseKey) return;
    navigator.clipboard.writeText(licenseKey)
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch(() => {
        setCopyState('error');
        setTimeout(() => setCopyState('idle'), 2000);
      });
  }, [licenseKey]);

  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  const urgentColor    = isExpiringSoon ? '#DC2626' : isTrial ? '#D97706' : '#2E8B57';

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${isExpiringSoon ? '#FECACA' : '#E5E7EB'}`,
      borderRadius: '12px',
      padding: '24px',
      boxShadow: isExpiringSoon
        ? '0 0 0 3px rgba(220,38,38,0.06), 0 1px 3px rgba(0,0,0,0.08)'
        : '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: '20px',
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {planIcon(plan)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              معلومات الترخيص
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
              {plan ?? 'Starter'}
            </p>
          </div>
        </div>
        <StatusBadge isTrial={isTrial} daysRemaining={daysRemaining} />
      </div>

      {/* Key display */}
      <div style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '16px',
      }}>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          مفتاح الترخيص
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {licenseKey ? (
            <code style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '15px', fontWeight: 700, color: '#0F172A',
              letterSpacing: '0.08em', wordBreak: 'break-all',
            }}>
              {licenseKey}
            </code>
          ) : (
            <span style={{ color: '#94A3B8', fontSize: '14px' }}>لم يتم إصدار مفتاح بعد</span>
          )}

          {licenseKey && (
            <button
              onClick={handleCopy}
              disabled={copyState !== 'idle'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: copyState === 'copied' ? '#DCFCE7' : copyState === 'error' ? '#FEE2E2' : '#0F3D2A',
                color: copyState === 'copied' ? '#166534' : copyState === 'error' ? '#B91C1C' : '#FFFFFF',
                border: 'none', borderRadius: '6px',
                padding: '7px 14px', fontSize: '13px', fontWeight: 600,
                cursor: copyState !== 'idle' ? 'default' : 'pointer',
                transition: 'all 0.15s ease', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              {copyState === 'copied' ? '✓ تم النسخ' : copyState === 'error' ? '✗ خطأ' : '📋 نسخ'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px 14px' }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            الأيام المتبقية
          </p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: urgentColor }}>
            {daysRemaining !== null ? daysRemaining : '—'}
            {daysRemaining !== null && (
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748B', marginRight: '4px' }}> يوم</span>
            )}
          </p>
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px 14px' }}>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            تاريخ الانتهاء
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
            {expiresAt
              ? new Date(expiresAt).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>

      {/* Trial note */}
      {isTrial && daysRemaining !== null && daysRemaining > 0 && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '13px', color: '#92400E', marginBottom: '16px',
        }}>
          🕐 أنت في الفترة التجريبية المجانية. للاستمرار بعد {daysRemaining} يوم، يرجى ترقية خطتك.
        </div>
      )}

      {/* Expiry warning */}
      {!isTrial && isExpiringSoon && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '13px', color: '#B91C1C', marginBottom: '16px',
        }}>
          ⚠️ اشتراكك ينتهي قريباً. جدد الاشتراك الآن لتجنب انقطاع الخدمة.
        </div>
      )}

      {/* Upgrade CTA */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <a
          href={`https://wa.me/212619522487?text=مرحباً، أريد ترقية خطة MAGHAREBIT`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#F0B429', color: '#0A2318',
            borderRadius: '8px', padding: '9px 18px',
            fontSize: '13px', fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          ⬆️ ترقية الخطة
        </a>
        <a
          href={`https://wa.me/212619522487?text=مرحباً، أحتاج مساعدة في تفعيل ترخيص MAGHAREBIT`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#F8FAFC', color: '#374151',
            border: '1px solid #E5E7EB',
            borderRadius: '8px', padding: '9px 18px',
            fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          💬 الدعم الفني
        </a>
      </div>
    </div>
  );
}
