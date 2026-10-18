'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface Alert {
  alert_id:   string;
  alert_type: string;
  severity:   string;
  score:      number;
  details:    Record<string, unknown>;
  created_at: string;
}

interface Props {
  token: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      'rgba(107,114,128,0.9)',
  medium:   'rgba(245,158,11,0.95)',
  high:     'rgba(239,68,68,0.95)',
  critical: '#EF4444',
};

export function AlertBanner({ token }: Props) {
  const { t } = useLanguage();
  const ta = t.alerts;

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        '/api/analytics/alerts?acknowledged=false',
        { headers: { authorization: `Bearer ${token}` } },
      );
      if (res.ok) setAlerts((await res.json()) as Alert[]);
    } catch { /* ignore network errors */ }
  }, [token]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [load]);

  const acknowledge = async (id: string) => {
    try {
      await fetch(`/api/analytics/alerts/${id}/acknowledge`, {
        method:  'PATCH',
        headers: {
          authorization:  `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    } catch { /* best-effort */ }
    setAlerts((a) => a.filter((x) => x.alert_id !== id));
  };

  if (alerts.length === 0) return null;

  const visible = [...alerts].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div
      style={{
        position:      'fixed',
        top:           '72px',
        insetInlineEnd:'1rem',
        zIndex:        900,
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.5rem',
        maxWidth:      '320px',
      }}
    >
      {visible.map((alert) => (
        <div
          key={alert.alert_id}
          style={{
            background:     SEVERITY_COLOR[alert.severity] ?? 'rgba(107,114,128,0.9)',
            borderRadius:   '12px',
            padding:        '0.75rem 1rem',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'flex-start',
            gap:            '0.5rem',
            boxShadow:      '0 4px 12px rgba(0,0,0,0.3)',
            animation:      'slideIn 0.3s ease',
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', margin: 0 }}>
              {(ta.types as Record<string, string>)[alert.alert_type] ?? alert.alert_type}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', margin: '0.2rem 0 0' }}>
              {ta.score.replace('{score}', alert.score.toFixed(0))}
            </p>
          </div>
          <button
            onClick={() => void acknowledge(alert.alert_id)}
            style={{
              background:   'rgba(0,0,0,0.2)',
              border:       'none',
              borderRadius: '6px',
              color:        '#fff',
              padding:      '0.25rem 0.5rem',
              cursor:       'pointer',
              fontSize:     '0.75rem',
              flexShrink:   0,
            }}
          >
            {ta.acknowledge}
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>
    </div>
  );
}
