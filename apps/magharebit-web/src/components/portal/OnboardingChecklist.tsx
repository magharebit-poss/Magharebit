'use client';

/**
 * OnboardingChecklist — API-driven version
 *
 * Completion is auto-detected from real data via GET /api/portal/onboarding.
 * No manual toggles. Re-fetches whenever the browser tab regains focus so
 * completing a step on another page is reflected immediately on return.
 *
 * Dismissal is stored in sessionStorage (resets each new tab/session) so
 * the checklist reappears each session until all steps are done.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  id:          string;
  label:       string;
  description: string;
  href:        string;
  done:        boolean;
}

interface OnboardingStatus {
  steps:          OnboardingStep[];
  completedCount: number;
  totalCount:     number;
  allDone:        boolean;
}

const SESSION_KEY = 'magharebit_onboarding_dismissed';

// Step icons (ordered, matches API step ids in order)
const STEP_ICONS: Record<string, string> = {
  settings:  '🏪',
  product:   '📦',
  employee:  '👥',
  whatsapp:  '💬',
  sale:      '🪙',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function OnboardingChecklist() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  const [status,    setStatus]    = useState<OnboardingStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated,  setHydrated]  = useState(false);
  // Celebration state: shown briefly when all steps flip to done
  const [celebrating, setCelebrating] = useState(false);

  // ── Fetch onboarding status ──────────────────────────────────────────────────
  const fetchStatus = useCallback(() => {
    fetch('/api/portal/onboarding', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as OnboardingStatus;
        setStatus(prev => {
          // Trigger celebration if we just flipped to allDone
          if (data.allDone && prev != null && !prev.allDone) {
            setCelebrating(true);
            setTimeout(() => setCelebrating(false), 4000);
          }
          return data;
        });
      })
      .catch(() => { /* silently degrade — checklist is non-critical */ });
  }, []);

  // ── Hydrate dismissal from sessionStorage ─────────────────────────────────
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(sessionStorage.getItem(SESSION_KEY) === '1');
    } catch { /* private browsing */ }
    setHydrated(true);
  }, []);

  // ── Initial fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    void (async () => { fetchStatus(); })();
  }, [hydrated, fetchStatus]);

  // ── Re-fetch when tab regains focus (user came back from another page) ───────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchStatus();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchStatus]);

  // ── Dismiss handler ───────────────────────────────────────────────────────────
  function handleDismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
  }

  // ── Guard: don't render until hydrated ───────────────────────────────────────
  if (!hydrated || status === null) return null;
  // Once truly all done and not in celebration mode, hide permanently
  if (dismissed && !celebrating) return null;
  if (status.allDone && !celebrating) return null;

  const progress = Math.round((status.completedCount / status.totalCount) * 100);

  // ── Celebration banner ────────────────────────────────────────────────────────
  if (celebrating || status.allDone) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
        borderRadius: '12px', padding: '20px 24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '16px', direction: 'rtl',
        boxShadow: '0 4px 16px rgba(15,61,42,0.25)',
      }}>
        <span style={{ fontSize: '36px', lineHeight: 1 }}>🎉</span>
        <div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>
            أحسنت! أكملت جميع خطوات الإعداد
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            متجرك جاهز بالكامل — حظاً موفقاً في مبيعاتك 🚀
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      padding: '20px 24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      direction: 'rtl',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px', fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif' }}>
            ابدأ مع MAGHAREBIT
          </h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif' }}>
            {status.completedCount} / {status.totalCount} مكتملة
          </p>
        </div>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px', lineHeight: 1, padding: '2px', display: 'flex', alignItems: 'center' }}
          aria-label="إخفاء قائمة البدء"
        >
          ✕
        </button>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '999px', marginBottom: '18px', overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: progress === 100
            ? '#22C55E'
            : 'linear-gradient(to left, #F0B429, #0F3D2A)',
          borderRadius: '999px',
          transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>

      {/* ── Steps ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {status.steps.map((step) => {
          const icon = STEP_ICONS[step.id] ?? '✦';
          const content = (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              {/* Status indicator */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: step.done ? '#0F3D2A' : '#F9FAFB',
                border: step.done ? 'none' : '1.5px solid #E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: step.done ? '13px' : '15px',
                color: step.done ? '#FFFFFF' : '#9CA3AF',
                transition: 'background 0.2s ease',
              }}>
                {step.done ? '✓' : icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '14px', fontWeight: step.done ? 500 : 600,
                  color: step.done ? '#9CA3AF' : '#111827',
                  textDecoration: step.done ? 'line-through' : 'none',
                  margin: '0 0 1px',
                  fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
                }}>
                  {step.label}
                </p>
                {!step.done && (
                  <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif' }}>
                    {step.description}
                  </p>
                )}
              </div>

              {/* Arrow for incomplete steps with a page */}
              {!step.done && step.href && (
                <span style={{ color: '#D1D5DB', fontSize: '14px', flexShrink: 0 }}>←</span>
              )}
            </div>
          );

          return (
            <div key={step.id}>
              {!step.done && step.href ? (
                <a
                  href={`/${locale}/portal/${step.href}`}
                  style={{
                    display: 'flex', alignItems: 'center', borderRadius: '8px',
                    padding: '6px 8px', margin: '-6px -8px',
                    textDecoration: 'none', color: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {content}
                </a>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', margin: '-6px -8px' }}>
                  {content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── WhatsApp highlight if not yet done ────────────────────────────── */}
      {status.steps.find(s => s.id === 'whatsapp' && !s.done) && (
        <div style={{
          marginTop: '14px', background: '#F0F9F4', border: '1px solid #D1FAE5',
          borderRadius: '8px', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: '12px', color: '#065F46', margin: 0, fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif' }}>
            فعّل واتساب لتلقي تقرير مبيعاتك اليومي وتنبيهات نقص المخزون تلقائياً.{' '}
            <a href={`/${locale}/portal/settings`} style={{ color: '#0F3D2A', fontWeight: 700, textDecoration: 'underline' }}>
              إعداد الآن ←
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
