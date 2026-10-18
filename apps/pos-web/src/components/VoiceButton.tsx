'use client';

import { useEffect, useRef, useState } from 'react';
import { TRANSLATIONS, type Lang } from '../lib/i18n';
import { DarijaRecognizer, isVoiceSupported, type VoiceCommand } from '../lib/voice/darija-recognizer';

interface VoiceButtonProps {
  lang:           Lang;
  onProductQuery: (query: string, qty: number) => Promise<void>;
  onTableSelect:  (number: number) => void;
  onClear:        () => void;
  onPay:          () => void;
}

const RECOGNITION_LANG = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-US' } as const;

export function VoiceButton({ lang, onProductQuery, onTableSelect, onClear, onPay }: VoiceButtonProps) {
  const t = TRANSLATIONS[lang].voice;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice]       = useState<string | null>(null);
  const [pendingClear, setPendingClear] = useState(false);

  const recRef         = useRef<DarijaRecognizer | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The recognizer outlives renders, so it calls the latest handlers through a ref.
  const handlersRef    = useRef({ onProductQuery, onTableSelect, onClear, onPay });

  useEffect(() => {
    handlersRef.current = { onProductQuery, onTableSelect, onClear, onPay };
  });

  useEffect(() => { setSupported(isVoiceSupported()); }, []);

  useEffect(() => () => {
    recRef.current?.stop();
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, []);

  // The recognition language is fixed per session, so switching language ends it.
  useEffect(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, [lang]);

  const showNotice = (text: string, ms: number) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(text);
    noticeTimerRef.current = setTimeout(() => setNotice(null), ms);
  };

  const cancelClear = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
    setPendingClear(false);
  };

  // Clearing the cart is destructive, so give the cashier 2 seconds to cancel.
  const startClearCountdown = () => {
    if (clearTimerRef.current) return;
    setPendingClear(true);
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null;
      setPendingClear(false);
      handlersRef.current.onClear();
    }, 2000);
  };

  const errorText = (code: string): string => {
    switch (code) {
      case 'voice_no_mic':
      case 'voice_permission': return t.noMic;
      case 'voice_no_speech':  return t.noSpeech;
      case 'voice_network':    return t.networkError;
      default:                 return t.error;
    }
  };

  const handleCommand = async (cmd: VoiceCommand) => {
    const h = handlersRef.current;
    switch (cmd.type) {
      case 'add_product':
        showNotice(`${cmd.qty} × ${cmd.query}`, 2000);
        try {
          await h.onProductQuery(cmd.query, cmd.qty);
        } catch {
          showNotice(t.error, 3000);
        }
        break;
      case 'table':
        h.onTableSelect(cmd.number);
        break;
      case 'clear':
        startClearCountdown();
        break;
      case 'pay':
        h.onPay();
        break;
      case 'cancel':
        cancelClear();
        break;
      case 'unknown':
        showNotice(cmd.raw, 2000);
        break;
    }
  };

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new DarijaRecognizer({
      lang: RECOGNITION_LANG[lang],
      onListening: setListening,
      onError: (code) => {
        if (code === 'voice_not_supported') {
          console.warn(t.notSupported);
          return;
        }
        showNotice(errorText(code), 3000);
      },
      onCommand: (cmd) => { void handleCommand(cmd); },
    });
    recRef.current = rec;
    rec.start();
  };

  if (!supported) return null;

  return (
    <div className="relative">
      <button
        onClick={toggle}
        title={listening ? t.listening : t.tapToSpeak}
        aria-pressed={listening}
        className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2 ${
          listening
            ? 'text-white'
            : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'
        }`}
        style={listening ? { background: '#DC2626', animation: 'voice-pulse 1.2s ease-in-out infinite' } : undefined}
      >
        {listening ? '🔴' : '🎤'}
      </button>
      {pendingClear ? (
        <div
          role="alert"
          className="absolute bottom-full mb-2 start-0 z-30 overflow-hidden whitespace-nowrap rounded-xl border border-amber-300 bg-amber-50 text-amber-800 shadow-lg"
        >
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-semibold">
            <span>{t.clearConfirm}</span>
            <button
              onClick={cancelClear}
              className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              {t.cancel}
            </button>
          </div>
          <div
            className="h-1 bg-amber-400"
            style={{ animation: 'voice-countdown 2s linear forwards' }}
          />
        </div>
      ) : notice && (
        <div className="absolute bottom-full mb-2 start-0 z-30 whitespace-nowrap rounded-lg bg-[#0F172A] px-2.5 py-1 text-xs text-white shadow-lg">
          {notice}
        </div>
      )}
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
          50%      { box-shadow: 0 0 0 8px rgba(220,38,38,0); }
        }
        @keyframes voice-countdown {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
