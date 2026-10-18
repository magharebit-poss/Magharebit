'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// ─── Countdown hook (shared pattern) ─────────────────────────────────────────

function useCountdown() {
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setRemaining(seconds)
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0 }
        return r - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  return { remaining, display: `${mm}:${ss}`, start }
}

// ─── OTP boxes ────────────────────────────────────────────────────────────────

function OtpBoxes({
  value, onChange, onComplete,
}: {
  value: string[]; onChange: (v: string[]) => void; onComplete: () => void
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) { const n = [...value]; n[idx] = ''; onChange(n); return }
    if (raw.length > 1) {
      const chars = raw.slice(0, 6).split('')
      const n = [...value]
      chars.forEach((c, i) => { if (idx + i < 6) n[idx + i] = c })
      onChange(n)
      refs.current[Math.min(idx + chars.length - 1, 5)]?.focus()
      if (n.filter(Boolean).length === 6) onComplete()
      return
    }
    const n = [...value]; n[idx] = raw.slice(-1); onChange(n)
    if (idx < 5) refs.current[idx + 1]?.focus()
    if (n.filter(Boolean).length === 6) onComplete()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) refs.current[idx - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent, idx: number) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!p) return
    const n = [...value]
    p.split('').forEach((c, i) => { if (idx + i < 6) n[idx + i] = c })
    onChange(n)
    refs.current[Math.min(idx + p.length - 1, 5)]?.focus()
    if (n.filter(Boolean).length === 6) onComplete()
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={el => { refs.current[i] = el }}
          type="text" inputMode="numeric" maxLength={6}
          value={value[i] ?? ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={e => handlePaste(e, i)}
          style={{
            width: '44px', height: '52px', textAlign: 'center',
            fontSize: '1.4rem', fontWeight: 700,
            background: 'rgba(255,255,255,0.07)',
            border: `1.5px solid ${value[i] ? '#F0B429' : 'rgba(255,255,255,0.18)'}`,
            borderRadius: '10px', color: '#FFFFFF', outline: 'none',
            fontFamily: 'monospace', transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) ?? 'fr'
  const isRTL  = locale === 'ar'
  const t      = useTranslations('auth')

  // step 0 = email input   |  step 1 = OTP boxes   |  step 2 = success
  const [step,      setStep]      = useState(0)
  const [email,     setEmail]     = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const resendRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [resendAllowed, setResendAllowed] = useState(false)
  const countdown = useCountdown()

  useEffect(() => () => { if (resendRef.current) clearTimeout(resendRef.current) }, [])

  // ── Send OTP ────────────────────────────────────────────────────────────────

  const sendOtp = useCallback((e?: React.FormEvent) => {
    e?.preventDefault()
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError(t('email_invalid')); return }
    setLoading(true); setError('')
    fetch('/api/auth/send-otp-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, locale }),
    })
      .then(async res => {
        const data = await res.json() as { error?: string; detail?: string }
        if (!res.ok) {
          if (data.error === 'rate_limited') { setError(t('rate_limited')); return }
          setError(data.detail ? `${t('email_send_failed')} (${data.detail})` : t('email_send_failed'))
          return
        }
        setStep(1); setOtpDigits(Array(6).fill(''))
        countdown.start(300)
        setResendAllowed(false)
        if (resendRef.current) clearTimeout(resendRef.current)
        resendRef.current = setTimeout(() => setResendAllowed(true), 60000)
      })
      .catch(() => setError(t('email_send_failed')))
      .finally(() => setLoading(false))
  }, [email, locale, t, countdown])

  // ── Verify OTP ──────────────────────────────────────────────────────────────

  const verifyOtp = useCallback(() => {
    const otp = otpDigits.join('')
    if (otp.length < 6) return
    setLoading(true); setError('')
    fetch('/api/auth/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp, locale }),
    })
      .then(async res => {
        const data = await res.json() as { error?: string; attemptsRemaining?: number }
        if (!res.ok) {
          if (data.error === 'invalid_otp') setError(t('otp_invalid', { remaining: data.attemptsRemaining ?? 0 }))
          else if (data.error === 'too_many_attempts') setError(t('too_many_attempts'))
          else setError(t('otp_expired'))
          return
        }
        // OTP verified → session cookie set → go to portal
        setStep(2)
        setTimeout(() => router.push(`/${locale}/portal/dashboard`), 1200)
      })
      .catch(() => setError(t('verify_failed')))
      .finally(() => setLoading(false))
  }, [otpDigits, email, locale, router, t])

  // Auto-verify on 6 digits
  useEffect(() => {
    if (otpDigits.filter(Boolean).length === 6) {
      const id = setTimeout(() => verifyOtp(), 0)
      return () => clearTimeout(id)
    }
  }, [otpDigits, verifyOtp])

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: '10px',
    color: '#FFFFFF', fontSize: '1rem', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', direction: 'ltr', transition: 'border-color 0.18s',
  }
  const ctaStyle: React.CSSProperties = {
    width: '100%', padding: '13px',
    background: loading ? 'rgba(240,180,41,0.60)' : '#F0B429',
    color: '#0A2318', fontWeight: 800, fontSize: '1rem', borderRadius: '10px',
    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', transition: 'background 0.18s', marginTop: '8px',
  }
  const titleStyle: React.CSSProperties = {
    fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
    fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF',
    marginBottom: '6px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.25,
  }

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Step 0: Email input ── */}
      {step === 0 && (
        <form onSubmit={sendOtp}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '2.5rem' }}>🔐</span>
          </div>

          <h1 style={titleStyle}>{t('forgot_title')}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginBottom: '24px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.6 }}>
            {t('step1_email_note')}
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="fp-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.70)', marginBottom: '6px' }}>
              {t('email_label')}
            </label>
            <input
              id="fp-email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('email_placeholder')} required autoComplete="email"
              style={inputStyle}
              onFocus={e  => { e.currentTarget.style.borderColor = '#F0B429' }}
              onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            />
          </div>

          {error && <p style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={loading} style={ctaStyle}>
            {loading ? '...' : t('step1_cta')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href={`/${locale}/auth/login`} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}>
              {t('forgot_cta')}
            </a>
          </div>
        </form>
      )}

      {/* ── Step 1: OTP verification ── */}
      {step === 1 && (
        <div>
          <h1 style={titleStyle}>{t('otp_heading')}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.50)', marginBottom: '24px', textAlign: isRTL ? 'right' : 'left' }}>
            {t('otp_sent_to_email')}{' '}
            <strong style={{ color: '#FFFFFF' }}>{email}</strong>
          </p>

          <OtpBoxes value={otpDigits} onChange={setOtpDigits} onComplete={() => {
            setTimeout(() => verifyOtp(), 0)
          }} />

          {loading && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '16px' }}>...</p>}
          {error   && <p style={{ color: '#F87171', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            {countdown.remaining > 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', margin: 0 }}>
                {t('otp_expires')} <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{countdown.display}</strong>
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{t('otp_expired')}</p>
            )}
          </div>

          {resendAllowed && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={() => sendOtp()}
                disabled={loading}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ✉️ {t('resend_wa')}
              </button>
            </div>
          )}

          <button
            onClick={() => { setStep(0); setError('') }}
            style={{ display: 'block', margin: '20px auto 0', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('back_email')}
          </button>
        </div>
      )}

      {/* ── Step 2: Success ── */}
      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ ...titleStyle, textAlign: 'center', fontSize: '1.2rem' }}>
            {t('redirecting')}
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '8px' }}>
            {email}
          </p>
        </div>
      )}
    </div>
  )
}
