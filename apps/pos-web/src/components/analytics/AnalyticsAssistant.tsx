'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface Message {
  role:    'user' | 'assistant';
  content: string;
}

interface Props {
  token: string;
}

const SUGGESTED_KEYS = ['topProducts', 'peakHours', 'creditBalances', 'suspiciousAlerts', 'reorder'] as const;

export function AnalyticsAssistant({ token }: Props) {
  const { t, lang, dir } = useLanguage();
  const ta = t.assistant;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', content: question };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch('/api/analytics/assistant', {
        method:  'POST',
        headers: {
          authorization:   `Bearer ${token}`,
          'content-type':  'application/json',
        },
        body: JSON.stringify({ question, history: next.slice(-6), lang }),
      });

      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok || !data.answer) {
        setError(data.error ?? ta.errorGeneric);
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer! }]);
    } catch {
      setError(ta.errorConnection);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background:     '#0F3D2A',
      borderRadius:   '16px',
      border:         '1px solid rgba(255,255,255,0.08)',
      display:        'flex',
      flexDirection:  'column',
      height:         '500px',
      overflow:       'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:       '1rem 1.25rem',
        borderBottom:  '1px solid rgba(255,255,255,0.08)',
        display:       'flex',
        alignItems:    'center',
        gap:           '0.6rem',
      }}>
        <span style={{ fontSize: '1.2rem' }}>🤖</span>
        <div>
          <h3 style={{ color: '#F0B429', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
            {ta.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', margin: 0 }}>
            {ta.subtitle}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex:          1,
        overflowY:     'auto',
        padding:       '1rem',
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.75rem',
      }}>
        {messages.length === 0 && (
          <div>
            <p style={{
              color:       'rgba(255,255,255,0.35)',
              fontSize:    '0.82rem',
              textAlign:   'center',
              margin:      '0 0 1rem',
            }}>
              {ta.examplesIntro}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {SUGGESTED_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => send(ta.suggested[key])}
                  style={{
                    background:    'rgba(240,180,41,0.08)',
                    border:        '1px solid rgba(240,180,41,0.2)',
                    borderRadius:  '10px',
                    padding:       '0.5rem 0.85rem',
                    color:         'rgba(255,255,255,0.7)',
                    cursor:        'pointer',
                    fontSize:      '0.8rem',
                    textAlign:     'start',
                    transition:    'all 0.15s',
                  }}
                >
                  {ta.suggested[key]}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display:        'flex',
              justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end',
            }}
          >
            <div style={{
              maxWidth:     '80%',
              background:   m.role === 'user' ? 'rgba(255,255,255,0.08)' : 'rgba(240,180,41,0.12)',
              border:       m.role === 'user'
                              ? '1px solid rgba(255,255,255,0.1)'
                              : '1px solid rgba(240,180,41,0.25)',
              borderRadius: '12px',
              padding:      '0.65rem 0.9rem',
              color:        '#fff',
              fontSize:     '0.85rem',
              lineHeight:   1.6,
              whiteSpace:   'pre-wrap',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              background:   'rgba(240,180,41,0.08)',
              border:       '1px solid rgba(240,180,41,0.15)',
              borderRadius: '12px',
              padding:      '0.65rem 1rem',
              color:        'rgba(255,255,255,0.45)',
              fontSize:     '0.82rem',
            }}>
              {ta.analyzing}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background:   'rgba(239,68,68,0.12)',
            border:       '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            padding:      '0.5rem 0.85rem',
            color:        '#FCA5A5',
            fontSize:     '0.8rem',
            textAlign:    'center',
          }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding:     '0.75rem 1rem',
        borderTop:   '1px solid rgba(255,255,255,0.08)',
        display:     'flex',
        gap:         '0.5rem',
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={ta.placeholder}
          disabled={loading}
          style={{
            flex:         1,
            padding:      '0.65rem 0.85rem',
            background:   'rgba(255,255,255,0.07)',
            border:       '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            color:        '#fff',
            fontSize:     '0.9rem',
            outline:      'none',
          }}
        />
        <button
          onClick={() => void send(input)}
          disabled={loading || !input.trim()}
          style={{
            padding:      '0.65rem 1rem',
            background:   input.trim() && !loading ? '#F0B429' : 'rgba(255,255,255,0.06)',
            color:        input.trim() && !loading ? '#0A2318' : 'rgba(255,255,255,0.3)',
            border:       'none',
            borderRadius: '10px',
            cursor:       input.trim() && !loading ? 'pointer' : 'not-allowed',
            fontWeight:   700,
            fontSize:     '0.9rem',
            transition:   'all 0.15s',
          }}
        >
          {dir === 'rtl' ? '←' : '→'}
        </button>
      </div>
    </div>
  );
}
