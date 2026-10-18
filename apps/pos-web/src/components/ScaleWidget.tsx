'use client';

import { useEffect, useRef, useState } from 'react';
import { ScaleManager, type ScaleStatus } from '../lib/scale/serial-manager';
import { SCALE_PROFILES, type ScaleProfileKey } from '../lib/scale/dibal-driver';
import type { ScaleReading } from '../lib/scale/dibal-driver';
import { useLanguage } from '../context/LanguageContext';

interface ScaleWidgetProps {
  onWeightConfirmed: (weightKg: number) => void;
  onClose: () => void;
}

const CONTAINER: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.65)',
};

const CARD: React.CSSProperties = {
  background: '#0A2318',
  borderRadius: 16,
  padding: '32px 36px',
  width: 360,
  maxWidth: '92vw',
  color: '#E8F5E9',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const TITLE: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 24,
  color: '#F0B429',
  textAlign: 'center',
};

const SELECT: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #1B4D35',
  background: '#0F3020',
  color: '#E8F5E9',
  fontSize: 14,
  marginBottom: 20,
  cursor: 'pointer',
};

const WEIGHT_BOX: React.CSSProperties = {
  background: '#0F3020',
  borderRadius: 12,
  padding: '20px 16px',
  textAlign: 'center',
  marginBottom: 16,
  border: '1px solid #1B4D35',
};

const WEIGHT_VALUE: React.CSSProperties = {
  fontSize: 52,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color: '#F0B429',
  lineHeight: 1.1,
  letterSpacing: '-1px',
};

const WEIGHT_UNIT: React.CSSProperties = {
  fontSize: 18,
  color: '#81C784',
  marginTop: 4,
};

const BTN_BASE: React.CSSProperties = {
  width: '100%',
  padding: '13px 0',
  borderRadius: 8,
  border: 'none',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 10,
};

const BTN_CONNECT: React.CSSProperties = {
  ...BTN_BASE,
  background: '#2E8B57',
  color: '#fff',
};

const BTN_CONFIRM: React.CSSProperties = {
  ...BTN_BASE,
  background: '#F0B429',
  color: '#0A2318',
};

const BTN_CONFIRM_DISABLED: React.CSSProperties = {
  ...BTN_CONFIRM,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const BTN_TARE: React.CSSProperties = {
  ...BTN_BASE,
  background: '#1B4D35',
  color: '#E8F5E9',
};

const BTN_DISCONNECT: React.CSSProperties = {
  ...BTN_BASE,
  background: 'transparent',
  color: '#EF9A9A',
  border: '1px solid #4E1010',
  marginTop: 6,
};

const BTN_CLOSE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  insetInlineEnd: 0,
  background: 'transparent',
  border: 'none',
  color: '#81C784',
  fontSize: 22,
  cursor: 'pointer',
  padding: '4px 10px',
  lineHeight: 1,
};

const ERROR_PILL: React.CSSProperties = {
  background: '#4E1010',
  color: '#EF9A9A',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  marginBottom: 14,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 8,
};

export default function ScaleWidget({
  onWeightConfirmed,
  onClose,
}: ScaleWidgetProps) {
  const { t } = useLanguage();
  const managerRef = useRef<ScaleManager | null>(null);
  const [profile, setProfile]   = useState<ScaleProfileKey>('dibal-d900');
  const [status, setStatus]     = useState<ScaleStatus>('disconnected');
  const [reading, setReading]   = useState<ScaleReading | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const webSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

  useEffect(() => {
    return () => {
      managerRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  function buildManager(p: ScaleProfileKey) {
    if (managerRef.current) {
      managerRef.current.disconnect().catch(() => undefined);
    }
    managerRef.current = new ScaleManager({
      profile: p,
      onReading: (r) => setReading(r),
      onStatus:  (s) => setStatus(s),
      onError:   (code) => setError(code),
    });
  }

  async function handleConnect() {
    setError(null);
    setReading(null);
    buildManager(profile);
    await managerRef.current!.connect();
  }

  async function handleTare() {
    await managerRef.current?.sendCommand('T\r\n');
  }

  async function handleDisconnect() {
    await managerRef.current?.disconnect();
    setReading(null);
  }

  function handleConfirm() {
    if (!reading || !reading.stable || reading.zero) return;
    onWeightConfirmed(reading.weight);
  }

  const isConnected = status === 'connected';
  const canConfirm  = isConnected && !!reading && reading.stable && !reading.zero;

  const weightDisplay = reading
    ? reading.weight.toFixed(3)
    : '0.000';

  const errorMessage = error === null ? null
    : error === 'ERR_NO_WEB_SERIAL' ? t.scale.errorNoSerial
    : error === 'ERR_DISCONNECTED'  ? t.scale.errorDisconnected
    : error.startsWith('ERR_CONNECT:') ? t.scale.errorConnect.replace('{msg}', error.slice(12))
    : error;

  return (
    <>
      {/* pulse keyframe injected once */}
      <style>{`
        @keyframes swPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={CONTAINER} role="dialog" aria-modal="true">
        <div style={{ position: 'relative', ...CARD }}>
          <button style={BTN_CLOSE} onClick={onClose} aria-label={t.payment.close}>×</button>

          <div style={TITLE}>⚖️ {t.scale.title}</div>

          {/* Profile selector — only when disconnected */}
          {!isConnected && (
            <select
              style={SELECT}
              value={profile}
              onChange={(e) => setProfile(e.target.value as ScaleProfileKey)}
            >
              {(Object.keys(SCALE_PROFILES) as ScaleProfileKey[]).map((k) => (
                <option key={k} value={k}>
                  {SCALE_PROFILES[k].label}
                </option>
              ))}
            </select>
          )}

          {/* Error pill */}
          {errorMessage && (
            <div style={ERROR_PILL}>
              <span>{errorMessage}</span>
              <button
                style={{ background: 'none', border: 'none', color: '#EF9A9A', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}
                onClick={() => setError(null)}
                aria-label={t.payment.close}
              >×</button>
            </div>
          )}

          {/* Weight display */}
          <div style={WEIGHT_BOX}>
            <div style={WEIGHT_VALUE}>{weightDisplay}</div>
            <div style={WEIGHT_UNIT}>{t.scale.weightUnit}</div>

            {/* Stability indicator */}
            {isConnected && (
              <div style={{ marginTop: 10, fontSize: 13 }}>
                {reading?.stable ? (
                  <span style={{ color: '#81C784' }}>✓ {t.scale.stable}</span>
                ) : (
                  <span style={{
                    color: '#FFB74D',
                    animation: 'swPulse 1s ease-in-out infinite',
                    display: 'inline-block',
                  }}>
                    ⟳ {t.scale.unstable}
                  </span>
                )}
              </div>
            )}

            {/* Connecting indicator */}
            {status === 'connecting' && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#81C784' }}>
                {t.scale.connecting}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {!isConnected && status !== 'connecting' && (
            <button
              style={webSerial ? BTN_CONNECT : { ...BTN_CONNECT, opacity: 0.4, cursor: 'not-allowed' }}
              onClick={webSerial ? handleConnect : undefined}
              disabled={!webSerial}
            >
              {webSerial ? t.scale.connect : t.scale.noWebSerial}
            </button>
          )}

          {isConnected && (
            <>
              <button style={BTN_TARE} onClick={handleTare}>
                {t.scale.tare}
              </button>

              <button
                style={canConfirm ? BTN_CONFIRM : BTN_CONFIRM_DISABLED}
                onClick={canConfirm ? handleConfirm : undefined}
                disabled={!canConfirm}
              >
                {t.scale.addToCart}
              </button>

              <button style={BTN_DISCONNECT} onClick={handleDisconnect}>
                {t.scale.disconnect}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
