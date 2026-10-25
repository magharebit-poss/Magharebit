'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { LANGS } from '../../lib/i18n';
import type { Lang } from '../../lib/i18n';
import { BrandLockup } from '../../components/brand/BrandLockup';

// Phone, digest on/off, language and send time: MANAGER and above.
// Secrets (AI key, Green API): SUPERVISOR and OWNER only (the backend enforces it too).
const ALLOWED_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'];
const SECRET_ROLES = ['SUPERVISOR', 'OWNER'];

interface DigestSettings {
  digest_enabled: boolean;
  whatsapp_phone: string | null;
  digest_language: Lang;
  digest_time: string;
}
interface IntegrationStatus {
  ai_configured: boolean;
  green_configured: boolean;
  updated_at: string | null;
}
interface TestResult { ok: boolean; state?: string | null; reason?: string }

const cardStyle = {
  background: 'var(--color-brand-900)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px', padding: '1.5rem', marginBottom: '1.25rem',
} as const;
const labelStyle = {
  display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', marginBottom: '0.35rem',
} as const;
const inputStyle = {
  width: '100%', minHeight: '48px', padding: '0.6rem 0.85rem', boxSizing: 'border-box',
  background: 'var(--color-brand-950)', border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '10px', color: '#fff', fontSize: '0.95rem', outline: 'none',
} as const;
const primaryBtn = {
  minHeight: '48px', padding: '0 1.4rem', borderRadius: '12px', border: 'none', cursor: 'pointer',
  background: 'var(--color-gold-400)', color: 'var(--color-brand-950)', fontWeight: 800, fontSize: '0.95rem',
} as const;
const ghostBtn = {
  minHeight: '48px', padding: '0 1.1rem', borderRadius: '12px', cursor: 'pointer',
  background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: '0.9rem',
} as const;

export default function SettingsPage() {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const ts = t.settings;

  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Daily report ──────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<Lang>('ar');
  const [time, setTime] = useState('07:00');
  const [digestMsg, setDigestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingDigest, setSavingDigest] = useState(false);

  // ── Integrations (write-only: the fields never hold a stored value) ──────────
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [aiKey, setAiKey] = useState('');
  const [greenInstance, setGreenInstance] = useState('');
  const [greenToken, setGreenToken] = useState('');
  const [secretsMsg, setSecretsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingSecrets, setSavingSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const canEditSecrets = SECRET_ROLES.includes(role);

  useEffect(() => {
    const tk = sessionStorage.getItem('greengo_token') ?? localStorage.getItem('greengo_token') ?? '';
    const r = sessionStorage.getItem('greengo_cashier_role') ?? '';
    if (!tk) { router.replace('/'); return; }
    if (!ALLOWED_ROLES.includes(r)) { router.replace('/pos'); return; }
    setRole(r);
    setToken(tk);
  }, [router]);

  const auth = useCallback(() => ({ authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [dRes, iRes] = await Promise.all([
        fetch('/api/digest/settings', { headers: auth() }),
        fetch('/api/settings/integrations', { headers: auth() }),
      ]);
      if (!dRes.ok || !iRes.ok) { setLoadError(true); return; }
      const d = (await dRes.json()) as DigestSettings;
      const i = (await iRes.json()) as IntegrationStatus;
      setEnabled(d.digest_enabled);
      setPhone(d.whatsapp_phone ?? '');
      setLanguage(d.digest_language);
      setTime(d.digest_time);
      setStatus(i);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token, auth]);

  useEffect(() => { void load(); }, [load]);

  async function saveDigest() {
    setSavingDigest(true); setDigestMsg(null);
    try {
      const res = await fetch('/api/digest/settings', {
        method: 'PUT',
        headers: { ...auth(), 'content-type': 'application/json' },
        body: JSON.stringify({
          digest_enabled: enabled,
          whatsapp_phone: phone.trim() === '' ? null : phone.trim(),
          digest_language: language,
          digest_time: time,
        }),
      });
      if (res.ok) {
        setDigestMsg({ ok: true, text: ts.saved });
        await load();
      } else {
        setDigestMsg({ ok: false, text: res.status === 400 ? ts.errorInvalid : ts.errorSave });
      }
    } catch {
      setDigestMsg({ ok: false, text: ts.errorSave });
    } finally {
      setSavingDigest(false);
    }
  }

  // body: only the fields to change. A value sets it, '' clears it, omitted leaves it.
  async function saveSecrets(body: Record<string, string>) {
    setSavingSecrets(true); setSecretsMsg(null); setTestMsg(null);
    try {
      const res = await fetch('/api/settings/integrations', {
        method: 'PUT',
        headers: { ...auth(), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAiKey(''); setGreenInstance(''); setGreenToken('');
        setSecretsMsg({ ok: true, text: ts.saved });
        await load();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (data.error === 'credentials_encryption_not_configured') {
        setSecretsMsg({ ok: false, text: ts.encryptionMissing });
      } else {
        setSecretsMsg({ ok: false, text: res.status === 400 ? ts.errorInvalid : ts.errorSave });
      }
    } catch {
      setSecretsMsg({ ok: false, text: ts.errorSave });
    } finally {
      setSavingSecrets(false);
    }
  }

  function submitSecrets() {
    const body: Record<string, string> = {};
    if (aiKey.trim()) body['ai_key'] = aiKey.trim();
    if (greenInstance.trim()) body['green_instance_id'] = greenInstance.trim();
    if (greenToken.trim()) body['green_token'] = greenToken.trim();
    if (Object.keys(body).length === 0) return;
    void saveSecrets(body);
  }

  async function testGreen() {
    setTesting(true); setTestMsg(null);
    try {
      const res = await fetch('/api/settings/integrations/test-green', { method: 'POST', headers: auth() });
      const data = (await res.json().catch(() => ({}))) as TestResult;
      if (data.ok) setTestMsg({ ok: true, text: ts.testConnected });
      else if (data.reason === 'not_configured') setTestMsg({ ok: false, text: ts.testNotConfigured });
      else if (data.state) setTestMsg({ ok: false, text: `${ts.testState}: ${data.state}` });
      else setTestMsg({ ok: false, text: ts.testFailed });
    } catch {
      setTestMsg({ ok: false, text: ts.testFailed });
    } finally {
      setTesting(false);
    }
  }

  const badge = (on: boolean) => (
    <span style={{
      fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '24px',
      background: on ? 'rgba(94,196,133,0.15)' : 'rgba(255,255,255,0.08)',
      color: on ? 'var(--color-brand-400)' : 'rgba(255,255,255,0.55)',
    }}>
      {on ? ts.configured : ts.notConfigured}
    </span>
  );

  const note = (m: { ok: boolean; text: string } | null) =>
    m && (
      <p role="status" style={{ margin: '0.75rem 0 0', fontSize: '0.88rem', color: m.ok ? 'var(--color-brand-400)' : '#FCA5A5' }}>
        {m.text}
      </p>
    );

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--color-brand-950)', color: '#fff' }}>
      <header style={{
        background: 'var(--color-brand-900)', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', gap: '1rem',
      }}>
        <button
          onClick={() => router.push('/pos')}
          aria-label={ts.back}
          style={{ ...ghostBtn, minHeight: '40px', minWidth: '48px', padding: '0 0.8rem' }}
        >
          {dir === 'rtl' ? '→' : '←'}
        </button>
        <BrandLockup height={32} alt={t.brand.logoAlt} />
        <h1 style={{ color: 'var(--color-gold-400)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
          ⚙️ {ts.title}
        </h1>
      </header>

      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '1.75rem 1.25rem' }}>
        {loading && <p style={{ color: 'rgba(255,255,255,0.5)' }}>{ts.loading}</p>}
        {!loading && loadError && <p style={{ color: '#FCA5A5' }}>{ts.errorLoad}</p>}

        {!loading && !loadError && (
          <>
            {/* ── Daily WhatsApp report ───────────────────────────────────── */}
            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700 }}>{ts.digestTitle}</h2>
              <p style={{ margin: '0 0 1.1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{ts.digestHint}</p>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minHeight: '48px', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                  style={{ width: '22px', height: '22px', accentColor: 'var(--color-gold-400)' }}
                />
                <span style={{ fontWeight: 600 }}>{ts.enabledLabel}</span>
              </label>

              <label style={labelStyle} htmlFor="digest-phone">{ts.phoneLabel}</label>
              <input
                id="digest-phone" dir="ltr" inputMode="tel" value={phone} placeholder="212612345678"
                onChange={(e) => setPhone(e.target.value)} style={{ ...inputStyle, marginBottom: '0.9rem' }}
              />

              <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle} htmlFor="digest-lang">{ts.languageLabel}</label>
                  <select
                    id="digest-lang" value={language} onChange={(e) => setLanguage(e.target.value as Lang)} style={inputStyle}
                  >
                    {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={labelStyle} htmlFor="digest-time">{ts.timeLabel}</label>
                  <input
                    id="digest-time" type="time" step={900} dir="ltr" value={time}
                    onChange={(e) => setTime(e.target.value)} style={inputStyle}
                  />
                </div>
              </div>
              <p style={{ margin: '0 0 1rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>{ts.timeHint}</p>

              <button onClick={() => void saveDigest()} disabled={savingDigest} style={{ ...primaryBtn, opacity: savingDigest ? 0.6 : 1 }}>
                {ts.save}
              </button>
              {note(digestMsg)}
            </section>

            {/* ── Integrations ─────────────────────────────────────────────── */}
            <section style={cardStyle}>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem', fontWeight: 700 }}>{ts.integrationsTitle}</h2>
              <p style={{ margin: '0 0 1.1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>{ts.integrationsHint}</p>

              {!canEditSecrets && (
                <p style={{ margin: '0 0 1rem', color: 'var(--color-gold-400)', fontSize: '0.85rem' }}>{ts.restricted}</p>
              )}

              {/* AI key */}
              <div style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <label style={{ ...labelStyle, margin: 0 }} htmlFor="ai-key">{ts.aiKey}</label>
                  {badge(status?.ai_configured === true)}
                </div>
                {canEditSecrets && (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <input
                      id="ai-key" type="password" dir="ltr" autoComplete="new-password" spellCheck={false}
                      value={aiKey} placeholder={status?.ai_configured ? ts.keepHint : ''}
                      onChange={(e) => setAiKey(e.target.value)} style={inputStyle}
                    />
                    {status?.ai_configured && (
                      <button onClick={() => void saveSecrets({ ai_key: '' })} disabled={savingSecrets} style={ghostBtn}>
                        {ts.clear}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Green API */}
              <div style={{ marginBottom: '1.1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ ...labelStyle, margin: 0 }}>Green API</span>
                  {badge(status?.green_configured === true)}
                </div>
                {canEditSecrets && (
                  <>
                    <label style={labelStyle} htmlFor="green-instance">{ts.greenInstance}</label>
                    <input
                      id="green-instance" type="password" dir="ltr" autoComplete="new-password" spellCheck={false}
                      inputMode="numeric" value={greenInstance} placeholder={status?.green_configured ? ts.keepHint : ''}
                      onChange={(e) => setGreenInstance(e.target.value)} style={{ ...inputStyle, marginBottom: '0.7rem' }}
                    />
                    <label style={labelStyle} htmlFor="green-token">{ts.greenToken}</label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <input
                        id="green-token" type="password" dir="ltr" autoComplete="new-password" spellCheck={false}
                        value={greenToken} placeholder={status?.green_configured ? ts.keepHint : ''}
                        onChange={(e) => setGreenToken(e.target.value)} style={inputStyle}
                      />
                      {status?.green_configured && (
                        <button
                          onClick={() => void saveSecrets({ green_instance_id: '', green_token: '' })}
                          disabled={savingSecrets} style={ghostBtn}
                        >
                          {ts.clear}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {canEditSecrets && (
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={submitSecrets}
                    disabled={savingSecrets || (!aiKey.trim() && !greenInstance.trim() && !greenToken.trim())}
                    style={{ ...primaryBtn, opacity: savingSecrets || (!aiKey.trim() && !greenInstance.trim() && !greenToken.trim()) ? 0.5 : 1 }}
                  >
                    {ts.save}
                  </button>
                  <button onClick={() => void testGreen()} disabled={testing} style={ghostBtn}>
                    {testing ? ts.testing : ts.testGreen}
                  </button>
                </div>
              )}
              {note(secretsMsg)}
              {note(testMsg)}
              {status?.updated_at && (
                <p style={{ margin: '0.9rem 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                  {ts.updated}: <span dir="ltr">{new Date(status.updated_at).toLocaleString()}</span>
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
