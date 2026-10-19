'use client';
import { useEffect, useState } from 'react';
import { ActivationScreen } from './ActivationScreen';
import {
  getLicenseStatus,
  getDaysRemaining,
  loadLicense,
  saveLicense,
} from '@/lib/license/cache';
import { getMachineId } from '@/lib/license/machine-id';
import { useLanguage } from '../context/LanguageContext';
import { BrandEmblem } from './brand/BrandEmblem';
import { ZelligeBackdrop } from './brand/ZelligeBackdrop';

interface Props {
  children: React.ReactNode;
}

const REVALIDATE_MS = 6 * 60 * 60 * 1000;

export function ActivationGate({ children }: Props) {
  const { t, lang, dir } = useLanguage();
  const tl = t.license;
  const [status, setStatus] = useState<
    'checking' | 'active' | 'locked' | 'expired' | 'revoked' | 'needs_activation'
  >('checking');
  const [daysLeft, setDaysLeft] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  async function revalidate(silent = false) {
    const cache = loadLicense();
    if (!cache) return;
    try {
      const machineId = await getMachineId();
      const res = await fetch(
        '/api/licenses/validate',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: cache.key, machineId }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      const data = await res.json() as { valid: boolean; reason?: string; daysRemaining?: number; plan?: string; features?: string[] };
      if (!data.valid) {
        if (data.reason === 'revoked') {
          saveLicense({ ...cache, revoked: true });
          setStatus('revoked');
        }
        return;
      }
      saveLicense({
        ...cache,
        validatedAt:   Date.now(),
        daysRemaining: data.daysRemaining ?? cache.daysRemaining,
        plan:          data.plan ?? cache.plan,
        features:      data.features ?? cache.features,
        revoked:       false,
      });
      if (!silent) setStatus('active');
    } catch {
      // Network error — keep current grace period
    }
  }

  useEffect(() => {
    const licenseStatus = getLicenseStatus();
    const days = getDaysRemaining();
    setDaysLeft(days);

    switch (licenseStatus) {
      case 'none':
        setStatus('needs_activation');
        break;
      case 'revoked':
        setStatus('revoked');
        break;
      case 'expired':
        setStatus('expired');
        break;
      case 'grace':
        setStatus('active');
        setShowBanner(days <= 7);
        revalidate(true);
        break;
      case 'valid': {
        setStatus('active');
        setShowBanner(days <= 7);
        const timer = setTimeout(() => revalidate(true), REVALIDATE_MS);
        return () => clearTimeout(timer);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden',
        minHeight: '100vh', background: 'var(--color-brand-950)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ZelligeBackdrop />
        <div style={{
          position: 'relative', zIndex: 1,
          width: '36px', height: '36px',
          border: '3px solid rgba(240,180,41,0.2)',
          borderTop: '3px solid var(--color-gold-400)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (status === 'needs_activation') {
    return <ActivationScreen onActivated={() => setStatus('active')} />;
  }

  if (status === 'revoked') {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden',
        minHeight: '100vh', background: 'var(--color-brand-950)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ZelligeBackdrop />
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'var(--color-brand-900)', borderRadius: '20px',
          padding: '2.5rem', maxWidth: '400px', textAlign: 'center',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandEmblem variant="onDark" height={64} alt={t.brand.logoAlt} />
          </div>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: '#FCA5A5', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {tl.revokedTitle}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {tl.revokedBody}
          </p>
          <a href="https://wa.me/212705576952" target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-block', marginTop: '1.5rem',
              padding: '0.75rem 1.5rem', background: '#25D366',
              color: '#fff', fontWeight: 700, borderRadius: '12px',
              textDecoration: 'none', fontSize: '0.9rem',
            }}>
            {tl.whatsappButton} ↗
          </a>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden',
        minHeight: '100vh', background: 'var(--color-brand-950)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ZelligeBackdrop />
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'var(--color-brand-900)', borderRadius: '20px',
          padding: '2.5rem', maxWidth: '400px', textAlign: 'center',
          border: '1px solid rgba(240,180,41,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <BrandEmblem variant="onDark" height={64} alt={t.brand.logoAlt} />
          </div>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏰</div>
          <h2 style={{ color: '#F0B429', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {tl.expiredTitle}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {tl.expiredBody}
          </p>
          <a href="https://magharebit.ma/portal" target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-block', marginTop: '1.5rem',
              padding: '0.75rem 1.5rem', background: '#F0B429',
              color: '#0A2318', fontWeight: 700, borderRadius: '12px',
              textDecoration: 'none', fontSize: '0.9rem',
            }}>
            {tl.renewButton} {dir === 'rtl' ? '←' : '→'}
          </a>
        </div>
      </div>
    );
  }

  const days = Math.max(0, Math.trunc(daysLeft));
  const pluralCategory = days === 1 ? 'one' : days === 0 ? 'other' : new Intl.PluralRules(lang).select(days);
  const bannerKey =
    pluralCategory === 'one' ? 'daysLeftOne'
    : pluralCategory === 'two' ? 'daysLeftTwo'
    : pluralCategory === 'few' ? 'daysLeftFew'
    : 'daysLeftMany';
  const bannerText = tl[bannerKey].replace('{days}', String(days));
  const ctaAt = bannerText.lastIndexOf(' — ');
  const bannerMsg = ctaAt >= 0 ? bannerText.slice(0, ctaAt) : bannerText;
  const bannerCta = ctaAt >= 0 ? bannerText.slice(ctaAt + 3) : tl.renewNow;

  return (
    <>
      {showBanner && daysLeft <= 7 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: daysLeft <= 2 ? '#EF4444' : '#F0B429',
          color: daysLeft <= 2 ? '#fff' : '#0A2318',
          textAlign: 'center', padding: '0.6rem',
          fontSize: '0.85rem', fontWeight: 600,
          zIndex: 9998,
        }}>
          ⚠️ {bannerMsg} — {' '}
          <a href="https://magharebit.ma/portal" target="_blank" rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}>
            {bannerCta}
          </a>
        </div>
      )}
      {children}
    </>
  );
}
