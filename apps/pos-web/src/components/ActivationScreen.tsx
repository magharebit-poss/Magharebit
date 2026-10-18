'use client';
import { useState } from 'react';
import { getMachineId } from '@/lib/license/machine-id';
import { saveLicense, type LicenseCache } from '@/lib/license/cache';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  onActivated: () => void;
}

interface ValidationResponse {
  valid:            boolean;
  daysRemaining?:   number;
  firstActivation?: boolean;
  plan?:            string;
  features?:        string[];
  reason?: 'revoked' | 'checksum_failed' | 'expired' | 'machine_mismatch';
}

function formatKey(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const parts: string[] = [];
  if (clean.length > 0)  parts.push(clean.slice(0, 3));   // MGH
  if (clean.length > 3)  parts.push(clean.slice(3, 9));   // YYYYMM
  if (clean.length > 9)  parts.push(clean.slice(9, 17));  // 8 hex
  if (clean.length > 17) parts.push(clean.slice(17, 21)); // 4 hex
  if (clean.length > 21) parts.push(clean.slice(21, 23)); // 2 HMAC
  return parts.join('-');
}

export function ActivationScreen({ onActivated }: Props) {
  const { t, lang, setLang } = useLanguage();
  const tl = t.license;
  const [key,     setKey]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function handleKeyInput(e: React.ChangeEvent<HTMLInputElement>) {
    setKey(formatKey(e.target.value));
    setError('');
  }

  async function handleActivate() {
    const cleanKey = key.trim();
    if (!cleanKey) { setError(tl.errorEmptyKey); return; }
    setLoading(true);
    setError('');
    try {
      const machineId = await getMachineId();
      const res = await fetch(
        '/api/licenses/validate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: cleanKey, machineId }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const data: ValidationResponse = await res.json();
      if (!data.valid) {
        const messages: Record<string, string> = {
          revoked:          tl.errorRevoked,
          checksum_failed:  tl.errorChecksum,
          expired:          tl.errorExpired,
          machine_mismatch: tl.errorMachineMismatch,
        };
        setError(messages[data.reason ?? ''] ?? tl.errorGeneric);
        return;
      }
      const cache: LicenseCache = {
        key:           cleanKey,
        machineId,
        validatedAt:   Date.now(),
        daysRemaining: data.daysRemaining ?? 365,
        plan:          data.plan ?? 'starter',
        features:      data.features ?? [],
        revoked:       false,
      };
      saveLicense(cache);
      onActivated();
    } catch (err) {
      setError(tl.errorNetwork);
      console.error('[activation]', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0A2318',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '1rem',
      zIndex: 9999,
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div dir="ltr" style={{ display: 'flex', gap: '0.4rem' }}>
        {(['ar', 'fr', 'en'] as const).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            style={{
              fontSize: '0.75rem', fontWeight: 700,
              padding: '0.3rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
              background: lang === code ? '#F0B429' : 'transparent',
              color: lang === code ? '#0A2318' : '#ffffff',
              border: lang === code ? '1px solid #F0B429' : '1px solid rgba(255,255,255,0.25)',
            }}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#0F3D2A',
        borderRadius: '24px',
        padding: '2.5rem',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            gap: '0.6rem', marginBottom: '0.4rem',
          }}>
            <div style={{
              width: '44px', height: '44px',
              background: '#F0B429', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 900, color: '#0A2318',
            }}>م</div>
            <span style={{
              fontSize: '1.5rem', fontWeight: 800,
              color: '#ffffff', letterSpacing: '0.02em',
            }}>MAGHAREBIT</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', margin: 0 }}>
            {tl.activationTitle}
          </p>
        </div>

        {/* Instructions */}
        <div style={{
          background: 'rgba(240,180,41,0.08)',
          border: '1px solid rgba(240,180,41,0.2)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6,
        }}>
          {tl.instructions}
        </div>

        {/* Key input */}
        <label style={{
          display: 'block',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.8rem', marginBottom: '0.4rem',
        }}>{tl.keyLabel}</label>
        <input
          value={key}
          onChange={handleKeyInput}
          placeholder="MGH-202412-XXXXXXXX-XXXX-XX"
          maxLength={28}
          dir="ltr"
          style={{
            width: '100%', padding: '0.85rem 1rem',
            background: 'rgba(255,255,255,0.07)',
            border: error ? '1px solid #EF4444' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px', color: '#ffffff',
            fontSize: '1rem', letterSpacing: '0.08em',
            outline: 'none', direction: 'ltr', textAlign: 'center',
            fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleActivate(); }}
        />

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px', padding: '0.65rem 1rem',
            color: '#FCA5A5', fontSize: '0.85rem',
            marginTop: '0.75rem', textAlign: 'center',
          }}>{error}</div>
        )}

        <button
          onClick={handleActivate}
          disabled={loading}
          style={{
            width: '100%', marginTop: '1.25rem', padding: '0.9rem',
            background: loading ? '#B8860B' : '#F0B429',
            color: '#0A2318', fontWeight: 800, fontSize: '1rem',
            border: 'none', borderRadius: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s', letterSpacing: '0.01em',
          }}>
          {loading ? tl.verifying : tl.activateButton}
        </button>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem',
        }}>
          © 2026 MAGHAREBIT — Wayloz Group
        </p>
      </div>
    </div>
  );
}
