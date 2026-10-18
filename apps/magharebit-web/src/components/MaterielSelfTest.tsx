'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

type Answer = 'yes' | 'no' | null;

export default function MaterielSelfTest() {
  const t = useTranslations('materiel');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [answers, setAnswers] = useState<Answer[]>([null, null, null, null]);
  const [submitted, setSubmitted] = useState(false);

  const questions = [t('test_q1'), t('test_q2'), t('test_q3'), t('test_q4')];

  const yesCount = answers.filter((a) => a === 'yes').length;

  const setAnswer = (idx: number, val: Answer) => {
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);
  };

  const allAnswered = answers.every((a) => a !== null);

  let result: { bg: string; border: string; color: string; text: string } | null = null;
  if (submitted) {
    if (yesCount >= 3) {
      result = { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.30)', color: '#22C55E', text: `✓ ${t('test_result_high')}` };
    } else if (yesCount >= 1) {
      result = { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', color: '#F59E0B', text: `⚠ ${t('test_result_mid')}` };
    } else {
      result = { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)', color: '#3B82F6', text: `ℹ ${t('test_result_low')}` };
    }
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '32px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <h3 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.6rem)', marginBottom: '24px', textAlign: 'center' }}>
        {t('test_title')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {questions.map((q, qi) => (
          <div key={qi} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontFamily: fontBody, fontSize: '14px', color: '#fff', marginBottom: '10px' }}>
              {qi + 1}. {q}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['yes', 'no'] as const).map((val) => {
                const selected = answers[qi] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAnswer(qi, val)}
                    style={{
                      fontFamily: fontBody,
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '8px 20px',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: selected ? (val === 'yes' ? '#22C55E' : 'rgba(255,255,255,0.10)') : 'transparent',
                      color: selected ? '#fff' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${selected ? (val === 'yes' ? '#22C55E' : 'rgba(255,255,255,0.30)') : 'rgba(255,255,255,0.15)'}`,
                    }}
                  >
                    {val === 'yes' ? t('test_yes') : t('test_no')}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setSubmitted(true)}
        disabled={!allAnswered}
        style={{
          marginTop: '24px',
          width: '100%',
          padding: '14px',
          background: allAnswered ? '#F0B429' : 'rgba(240,180,41,0.30)',
          color: '#0A2318',
          fontFamily: fontBody,
          fontWeight: 700,
          fontSize: '14px',
          borderRadius: '999px',
          border: 'none',
          cursor: allAnswered ? 'pointer' : 'not-allowed',
        }}
      >
        {t('test_submit')}
      </button>
      {result && (
        <div
          style={{
            marginTop: '20px',
            background: result.bg,
            border: `1px solid ${result.border}`,
            borderRadius: '12px',
            padding: '16px 20px',
            fontFamily: fontBody,
            fontSize: '14px',
            color: result.color,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {result.text}
        </div>
      )}
    </div>
  );
}
