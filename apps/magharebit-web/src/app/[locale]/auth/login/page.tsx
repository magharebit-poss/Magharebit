'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

// ─── Phone formatter ──────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 2) return d
  if (d.length <= 4) return d.slice(0, 2) + ' ' + d.slice(2)
  if (d.length <= 6) return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4)
  if (d.length <= 8) return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6)
  return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8)
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useImperativeCountdown() {
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCountdown = useCallback((seconds: number) => {
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
  return { remaining, display: `${mm}:${ss}`, startCountdown }
}

// ─── OTP input boxes ──────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) ?? 'fr'
  const isRTL  = locale === 'ar'
  const t      = useTranslations('auth')

  // 'phone' = WhatsApp OTP  |  'email' = Email OTP
  const [method,    setMethod]    = useState<'phone' | 'email'>('phone')
  // step 0 = enter identifier   |  step 1 = enter OTP
  const [step,      setStep]      = useState(0)
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''))
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resendAllowed, setResendAllowed] = useState(false)
  const [smsAvailable,  setSmsAvailable]  = useState(false)
  const resendRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const smsRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const countdown = useImperativeCountdown()

  const startResendTimers = useCallback(() => {
    if (resendRef.current) clearTimeout(resendRef.current)
    if (smsRef.current)    clearTimeout(smsRef.current)
    setResendAllowed(false); setSmsAvailable(false)
    resendRef.current = setTimeout(() => setResendAllowed(true), 60000)
    smsRef.current    = setTimeout(() => setSmsAvailable(true),  60000)
  }, [])

  useEffect(() => () => {
    if (resendRef.current) clearTimeout(resendRef.current)
    if (smsRef.current)    clearTimeout(smsRef.current)
  }, [])

  // Switch method resets both steps
  const switchMethod = useCallback((m: 'phone' | 'email') => {
    setMethod(m)
    setStep(0)
    setError('')
    setOtpDigits(Array(6).fill(''))
  }, [])

  // ── Send OTP (handles both phone and email paths) ─────────────────────────

  const sendOtp = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true); setError('')
    try {
      if (method === 'phone') {
        const digits = phone.replace(/\D/g, '')
        if (digits.length < 9) { setError(t('phone_invalid')); return }
        const res  = await fetch('/api/auth/send-otp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits, locale }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.error === 'rate_limited') { setError(t('rate_limited')); return }
          // Show MongoDB detail in development so devs can diagnose instantly
          const detail = (data as { detail?: string }).detail
          setError(detail ? `${t('send_failed')} (${detail})` : t('send_failed'))
          return
        }
      } else {
        const em = email.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError(t('email_invalid')); return }
        const res  = await fetch('/api/auth/send-otp-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: em, locale }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.error === 'rate_limited') { setError(t('rate_limited')); return }
          const detail = (data as { detail?: string }).detail
          setError(detail ? `${t('email_send_failed')} (${detail})` : t('email_send_failed'))
          return
        }
      }
      setStep(1); setOtpDigits(Array(6).fill(''))
      countdown.startCountdown(300); startResendTimers()
    } finally { setLoading(false) }
  }, [method, phone, email, locale, t, countdown, startResendTimers])

  // ── Verify OTP ────────────────────────────────────────────────────────────

  const verifyOtp = useCallback(async () => {
    const otp = otpDigits.join('')
    if (otp.length < 6) return
    setLoading(true); setError('')
    try {
      const body = method === 'phone'
        ? { phone: phone.replace(/\D/g, ''), otp, locale }
        : { email: email.trim().toLowerCase(), otp, locale }
      const res  = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'invalid_otp') setError(t('otp_invalid', { remaining: data.attemptsRemaining ?? 0 }))
        else if (data.error === 'too_many_attempts') setError(t('too_many_attempts'))
        else setError(t('otp_expired'))
        return
      }
      router.push(`/${locale}/portal/dashboard`)
    } finally { setLoading(false) }
  }, [otpDigits, method, phone, email, locale, router, t])

  // Auto-verify when all 6 digits are filled
  useEffect(() => {
    if (otpDigits.filter(Boolean).length === 6) {
      const id = setTimeout(() => verifyOtp(), 0)
      return () => clearTimeout(id)
    }
  }, [otpDigits, verifyOtp])

  // ── SMS fallback (phone path only) ────────────────────────────────────────

  const sendSms = useCallback(() => {
    setLoading(true); setError('')
    fetch('/api/auth/send-otp-sms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), locale }),
    })
      .then(async res => {
        if (!res.ok) { setError(t('sms_failed')); return }
        setOtpDigits(Array(6).fill(''))
        countdown.startCountdown(300)
      })
      .catch(() => setError(t('sms_failed')))
      .finally(() => setLoading(false))
  }, [phone, locale, t, countdown])

  // ── Styles ─────────────────────────────────────────────────────────────────

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

      {/* ── Method tabs (phone / email) — always visible on step 0 ── */}
      {step === 0 && (
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '24px',
          background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '4px',
        }}>
          {(['phone', 'email'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMethod(m)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: '7px', border: 'none',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.18s',
                background: method === m ? '#F0B429' : 'transparent',
                color:      method === m ? '#0A2318' : 'rgba(255,255,255,0.55)',
              }}
            >
              {m === 'phone' ? `📱 ${t('phone_tab')}` : `✉️ ${t('email_tab')}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Step 0: Enter phone or email ── */}
      {step === 0 && (
        <form onSubmit={sendOtp}>
          <h1 style={titleStyle}>{t('login_title')}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.50)', marginBottom: '28px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.55 }}>
            {method === 'phone' ? t('login_sub') : t('step1_email_note')}
          </p>

          {method === 'phone' ? (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="login-phone" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.70)', marginBottom: '6px' }}>
                {t('phone_label')}
              </label>
              <input
                id="login-phone" type="tel" value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="06 XX XX XX XX" required autoComplete="tel"
                style={inputStyle}
                onFocus={e  => { e.currentTarget.style.borderColor = '#F0B429' }}
                onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              />
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
                📱 {t('step1_wa_note')}
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="login-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.70)', marginBottom: '6px' }}>
                {t('email_label')}
              </label>
              <input
                id="login-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('email_placeholder')} required autoComplete="email"
                style={inputStyle}
                onFocus={e  => { e.currentTarget.style.borderColor = '#F0B429' }}
                onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              />
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>
                ✉️ {t('step1_email_note')}
              </p>
            </div>
          )}

          {error && <p style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={loading} style={ctaStyle}>
            {loading ? '...' : t('step1_cta')}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              {t('no_account')}{' '}
              <a href={`/${locale}/auth/signup`} style={{ color: '#F0B429', fontWeight: 600, textDecoration: 'none' }}>{t('sign_up')}</a>
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              {t('have_license')}{' '}
              <a href={`/${locale}/portal/login`} style={{ color: 'rgba(255,255,255,0.50)', textDecoration: 'underline' }}>{t('portal_link')}</a>
            </p>
          </div>
        </form>
      )}

      {/* ── Step 1: Enter OTP ── */}
      {step === 1 && (
        <div>
          <h1 style={titleStyle}>{t('otp_heading')}</h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.50)', marginBottom: '24px', textAlign: isRTL ? 'right' : 'left' }}>
            {method === 'phone' ? t('otp_sent_to') : t('otp_sent_to_email')}{' '}
            <strong style={{ color: '#FFFFFF' }}>{method === 'phone' ? phone : email}</strong>
          </p>

          <OtpBoxes value={otpDigits} onChange={setOtpDigits} onComplete={() => {
            setTimeout(() => verifyOtp(), 0)
          }} />

          {loading && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '16px' }}>...</p>}
          {error   && <p style={{ color: '#F87171', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}

          {/* Countdown */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            {countdown.remaining > 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', margin: 0 }}>
                {t('otp_expires')} <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{countdown.display}</strong>
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{t('otp_expired')}</p>
            )}
          </div>

          {/* Resend */}
          {resendAllowed && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {method === 'phone' ? (
                <>
                  <button onClick={() => sendOtp()} disabled={loading} style={{ background: 'transparent', border: '1px solid rgba(37,211,102,0.35)', borderRadius: '8px', color: '#25D366', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    📱 {t('resend_wa')}
                  </button>
                  {smsAvailable && (
                    <button onClick={sendSms} disabled={loading} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', color: 'rgba(255,255,255,0.55)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      💬 {t('resend_sms')}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={() => sendOtp()} disabled={loading} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', color: 'rgba(255,255,255,0.65)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✉️ {t('resend_wa')}
                </button>
              )}
            </div>
          )}

          {/* Back link */}
          <button
            onClick={() => { setStep(0); setError('') }}
            style={{ display: 'block', margin: '20px auto 0', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {method === 'phone' ? t('back_phone') : t('back_email')}
          </button>
        </div>
      )}
    </div>
  )
}
