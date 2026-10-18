'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { apiFetch, getToken } from '../../lib/api';
import { unlockAudio, playChime, isAudioReady, startAlertLoop, stopAlertLoop } from '../../lib/kds-sound';
import { pickName } from '../../lib/names';

interface KDSLine {
  line_id:        string;
  order_id:       string;
  name_ar:        string;
  name_fr?:       string | null;
  quantity:       number;
  modifiers:      Array<{ label_ar: string; label_fr?: string | null }>;
  kds_status:     string;
  sent_to_kds_at: string;
  table_label?:   string;
  order_note?:    string;
  course_number?: number | null;
  allergy_flags?: string[];
}

interface AllergyDef {
  code:     string;
  label_ar: string;
  label_fr: string;
  label_en: string;
  icon:     string | null;
}

const STATUS_NEXT: Record<string, string> = {
  pending:   'preparing',
  preparing: 'ready',
  ready:     'served',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   '#EF4444',
  preparing: '#F0B429',
  ready:     '#10B981',
};

export default function KDSPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [lines,        setLines]        = useState<KDSLine[]>([]);
  const [hasToken,       setHasToken]       = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionKey,     setSessionKey]     = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundMuted,   setSoundMuted]   = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('kds_sound_muted') === 'true'; } catch { return false; }
  });
  const [showTapHint, setShowTapHint] = useState(false);
  const [newLineIds,  setNewLineIds]  = useState<Set<string>>(new Set());
  const [allergyDefs, setAllergyDefs] = useState<Record<string, AllergyDef>>({});

  const seenIds        = useRef<Set<string>>(new Set());
  const isFirstLoad    = useRef(true);
  const soundEnabledRef = useRef(false);
  const soundMutedRef   = useRef(soundMuted);
  const stopAlertRef    = useRef<(() => void) | null>(null);
  const rejectedTokenRef = useRef<string | null>(null);

  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { soundMutedRef.current = soundMuted; }, [soundMuted]);

  // Silence the repeating alert when leaving the page.
  useEffect(() => () => {
    stopAlertLoop(stopAlertRef.current);
    stopAlertRef.current = null;
  }, []);

  // A rejected token stops the poll and the alert loop; the board shows a sign-in
  // state until a different token appears. The KDS never opens or closes shifts.
  const handleUnauthorized = useCallback(() => {
    stopAlertLoop(stopAlertRef.current);
    stopAlertRef.current = null;
    rejectedTokenRef.current = getToken();
    setSessionExpired(true);
  }, []);

  useEffect(() => {
    if (getToken()) setHasToken(true);
    else setSessionExpired(true);
  }, []);

  // Signing in from another tab (or returning to this one) with a new token restarts the board once.
  useEffect(() => {
    if (!sessionExpired) return;
    const recover = () => {
      const tok = getToken();
      if (!tok || tok === rejectedTokenRef.current) return;
      rejectedTokenRef.current = null;
      isFirstLoad.current = true; // tickets already on screen must not chime again
      setHasToken(true);
      setSessionKey((k) => k + 1);
      setSessionExpired(false);
    };
    window.addEventListener('storage', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.removeEventListener('storage', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [sessionExpired]);

  // Allergy icons: one request per session; any failure just means no icons.
  useEffect(() => {
    if (!hasToken || sessionExpired) return;
    void apiFetch('/api/allergies')
      .then(async (res) => {
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) return;
        const defs = await res.json() as AllergyDef[];
        setAllergyDefs(Object.fromEntries(defs.map((d) => [d.code, d])));
      })
      .catch(() => { /* flags fall back to their code */ });
  }, [hasToken, sessionKey, sessionExpired, handleUnauthorized]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/cafe/orders');
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) return;
      const orders = await res.json() as Array<{
        table_label?: string;
        note?: string | null;
        lines?: KDSLine[];
      }>;
      const allLines: KDSLine[] = [];
      for (const o of orders) {
        for (const l of (o.lines ?? [])) {
          if (l.kds_status === 'served') continue;
          allLines.push({ ...l, table_label: o.table_label ?? '', order_note: o.note ?? '' });
        }
      }
      const sorted = allLines.sort((a, b) =>
        new Date(a.sent_to_kds_at).getTime() - new Date(b.sent_to_kds_at).getTime()
      );

      if (isFirstLoad.current) {
        for (const l of sorted) seenIds.current.add(l.line_id);
        isFirstLoad.current = false;
      } else {
        const newPending = sorted.filter(
          l => !seenIds.current.has(l.line_id) && (l.kds_status === 'pending' || l.kds_status === 'preparing')
        );
        if (newPending.length > 0) {
          if (soundEnabledRef.current && !soundMutedRef.current && isAudioReady()) {
            // Repeat every 8s until someone taps a ticket, everything is served, or sound is muted.
            stopAlertLoop(stopAlertRef.current);
            stopAlertRef.current = startAlertLoop(8000);
          } else if (!soundEnabledRef.current) {
            setShowTapHint(true);
            setTimeout(() => setShowTapHint(false), 10_000);
          }
          const ids = new Set(newPending.map(l => l.line_id));
          setNewLineIds(ids);
          setTimeout(() => setNewLineIds(new Set()), 3000);
        }
        for (const l of sorted) seenIds.current.add(l.line_id);
      }

      if (sorted.length === 0) {
        stopAlertLoop(stopAlertRef.current);
        stopAlertRef.current = null;
      }

      setLines(sorted);
    } catch { /* ignore */ }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (!hasToken || sessionExpired) return;
    void load();
    const interval = setInterval(() => void load(), 10_000);
    return () => clearInterval(interval);
  }, [hasToken, sessionExpired, load]);

  async function handleEnableSound() {
    await unlockAudio();
    setSoundEnabled(true);
    soundEnabledRef.current = true;
    setShowTapHint(false);
    playChime();
  }

  function handleToggleMute() {
    const next = !soundMuted;
    setSoundMuted(next);
    soundMutedRef.current = next;
    if (next) {
      stopAlertLoop(stopAlertRef.current);
      stopAlertRef.current = null;
    }
    try { localStorage.setItem('kds_sound_muted', String(next)); } catch {}
  }

  async function advance(line: KDSLine) {
    // Any tap acknowledges the alert, whichever status the ticket moves to.
    stopAlertLoop(stopAlertRef.current);
    stopAlertRef.current = null;
    const next = STATUS_NEXT[line.kds_status];
    if (!next) return;
    const res = await apiFetch(`/api/cafe/orders/${line.order_id}/lines/${line.line_id}/kds`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kds_status: next }),
    });
    if (res.status === 401) { handleUnauthorized(); return; }
    await load();
  }

  if (sessionExpired) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0A2318', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}>
        <div style={{
          background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
          padding: '2.5rem', maxWidth: '420px', width: '100%', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
          <h1 style={{ color: '#F0B429', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 1.25rem' }}>
            {t.kds.sessionExpired}
          </h1>
          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', minHeight: '52px', background: '#F0B429', color: '#0A2318',
              fontWeight: 800, fontSize: '1rem', border: 'none', borderRadius: '12px', cursor: 'pointer',
            }}
          >
            {t.kds.signInToContinue}
          </button>
        </div>
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    pending:   t.kds.pending,
    preparing: t.kds.preparing,
    ready:     t.kds.ready,
  };

  const cols: Record<string, KDSLine[]> = {
    pending:   lines.filter(l => l.kds_status === 'pending'),
    preparing: lines.filter(l => l.kds_status === 'preparing'),
    ready:     lines.filter(l => l.kds_status === 'ready'),
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A2318', padding: '1rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '0.75rem',
      }}>
        <h1 style={{ color: '#F0B429', fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
          🍽️ {t.kds.title}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!soundEnabled ? (
            <button
              onClick={() => void handleEnableSound()}
              style={{
                background: 'rgba(240,180,41,0.15)',
                border: '1px solid #F0B429',
                borderRadius: '8px', padding: '0.4rem 0.8rem',
                color: '#F0B429', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              }}
            >
              🔇 {t.kds.enableSound}
            </button>
          ) : (
            <button
              onClick={handleToggleMute}
              style={{
                background: soundMuted ? 'rgba(255,255,255,0.06)' : 'rgba(16,185,129,0.15)',
                border: soundMuted ? '1px solid rgba(255,255,255,0.2)' : '1px solid #10B981',
                borderRadius: '8px', padding: '0.4rem 0.8rem',
                color: soundMuted ? 'rgba(255,255,255,0.5)' : '#10B981',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              }}
            >
              {soundMuted ? t.kds.soundOff : t.kds.soundOn}
            </button>
          )}
          <button
            onClick={() => void load()}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px', padding: '0.4rem 0.8rem',
              color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            {t.kds.refresh}
          </button>
        </div>
      </div>

      {showTapHint && !soundEnabled && (
        <div
          onClick={() => void handleEnableSound()}
          style={{
            background: '#F0B429', color: '#0A2318',
            padding: '0.5rem 1rem', borderRadius: '8px',
            fontSize: '0.85rem', fontWeight: 700,
            textAlign: 'center', marginBottom: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {t.kds.tapToEnableSound}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {Object.entries(cols).map(([status, items]) => (
          <div key={status}>
            <div style={{
              background: STATUS_COLOR[status],
              borderRadius: '8px 8px 0 0', padding: '0.5rem 1rem',
              fontWeight: 700, color: '#0A2318', fontSize: '0.9rem',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{statusLabel[status]}</span>
              <span>{items.length}</span>
            </div>
            <div style={{
              background: '#0F3D2A', borderRadius: '0 0 12px 12px',
              padding: '0.75rem', minHeight: '200px',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              {items.map(line => (
                <button
                  key={line.line_id}
                  onClick={() => void advance(line)}
                  style={{
                    background: `${STATUS_COLOR[status]}18`,
                    border: newLineIds.has(line.line_id)
                      ? `2px solid ${STATUS_COLOR[status]}`
                      : `1px solid ${STATUS_COLOR[status]}44`,
                    borderRadius: '10px', padding: '0.75rem',
                    cursor: 'pointer', textAlign: 'start', width: '100%',
                    outline: newLineIds.has(line.line_id)
                      ? `2px solid #F0B429`
                      : 'none',
                    transition: 'outline 0.2s, border 0.2s',
                  }}
                >
                  {line.course_number != null && (
                    <span style={{
                      display: 'inline-block', marginBottom: '0.25rem',
                      background: 'rgba(240,180,41,0.2)', color: '#F0B429',
                      border: '1px solid rgba(240,180,41,0.5)', borderRadius: '999px',
                      padding: '0.05rem 0.55rem', fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {t.course.courseN.replace('{n}', String(line.course_number))}
                    </span>
                  )}
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                    {line.quantity}×{pickName(lang, line.name_ar, line.name_fr)}
                  </div>
                  {(line.allergy_flags?.length ?? 0) > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: '0.3rem',
                      background: '#DC2626', borderRadius: '6px',
                      padding: '0.25rem 0.5rem', marginTop: '0.3rem',
                      color: '#fff', fontSize: '0.8rem', fontWeight: 800,
                    }}>
                      {line.allergy_flags!.map((code) => {
                        const def = allergyDefs[code];
                        const label = def
                          ? (lang === 'ar' ? def.label_ar : lang === 'fr' ? def.label_fr : def.label_en)
                          : code;
                        return <span key={code}>{def?.icon ?? '⚠️'} {label}</span>;
                      })}
                    </div>
                  )}
                  {line.modifiers?.length > 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {line.modifiers.map(m => pickName(lang, m.label_ar, m.label_fr)).join(' • ')}
                    </div>
                  )}
                  {line.table_label && (
                    <div style={{ color: '#F0B429', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {t.kds.table} {line.table_label}
                    </div>
                  )}
                  {line.order_note && (
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                      {line.order_note}
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', marginTop: '0.3rem' }}>
                    {t.kds.tapToAdvance}
                  </div>
                </button>
              ))}
              {items.length === 0 && (
                <p style={{
                  color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                  fontSize: '0.85rem', margin: 'auto 0',
                }}>{t.kds.noOrders}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
