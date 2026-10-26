'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

// ── Sector / city options ─────────────────────────────────────────────────────
const SECTORS = [
  { value: 'cafe-restaurant', ar: 'كافيه / مطعم',          fr: 'Café / Restaurant',          en: 'Café / Restaurant' },
  { value: 'epicerie',        ar: 'بقالة / ماركت',          fr: 'Épicerie / Superette',        en: 'Grocery / Minimart' },
  { value: 'boulangerie',     ar: 'مخبزة / حلويات',         fr: 'Boulangerie / Pâtisserie',    en: 'Bakery / Pastry' },
  { value: 'boucherie',       ar: 'جزارة / دجاج',           fr: 'Boucherie / Poulets',         en: 'Butcher / Poultry' },
  { value: 'pharmacie',       ar: 'صيدلية / بارافارماسي',    fr: 'Pharmacie / Parapharmacie',   en: 'Pharmacy' },
  { value: 'textile',         ar: 'ملابس / نسيج',           fr: 'Vêtements / Textile',         en: 'Clothing / Textile' },
  { value: 'electronique',    ar: 'إلكترونيات / هاتف',      fr: 'Électronique / Téléphonie',   en: 'Electronics' },
  { value: 'other',           ar: 'أخرى',                  fr: 'Autre',                       en: 'Other' },
]

const CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir',
  'Meknès', 'Oujda', 'Kénitra', 'Tétouan', 'Safi', 'El Jadida',
  'Béni Mellal', 'Nador', 'Laâyoune', 'Khouribga', 'Settat',
]

// ── Phone auto-format ─────────────────────────────────────────────────────────
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 2) return d
  if (d.length <= 4) return d.slice(0, 2) + ' ' + d.slice(2)
  if (d.length <= 6) return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4)
  if (d.length <= 8) return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6)
  return d.slice(0, 2) + ' ' + d.slice(2, 4) + ' ' + d.slice(4, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8)
}

// ── ESLint-compliant countdown (started imperatively, never from effects) ─────
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

// ── 6-box OTP input ───────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, onComplete, groupLabel, digitLabel }: {
  value:      string[]
  onChange:   (v: string[]) => void
  onComplete: () => void
  groupLabel: string
  digitLabel: (n: number) => string
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
    <div role="group" aria-label={groupLabel} style={{ display: 'flex', gap: '8px', justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text" inputMode="numeric" maxLength={6} autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={digitLabel(i + 1)}
          value={value[i] ?? ''}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={e => handlePaste(e, i)}
          style={{
            width: '46px', height: '56px', textAlign: 'center',
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

// ── Labelled progress (phone/email → code → shop) ─────────────────────────────
function Stepper({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol aria-label="Progress" style={{ display: 'flex', gap: '6px', listStyle: 'none', margin: '0 0 28px', padding: 0 }}>
      {labels.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              height: '4px', borderRadius: '999px', marginBottom: '8px',
              background: state === 'todo' ? 'rgba(255,255,255,0.14)' : state === 'done' ? 'rgba(240,180,41,0.55)' : '#F0B429',
              transition: 'background 0.25s',
            }} />
            <span style={{
              display: 'block', fontSize: '12px', fontWeight: state === 'current' ? 700 : 500,
              color: state === 'current' ? '#F0B429' : state === 'done' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.40)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {state === 'done' ? '✓ ' : ''}{label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SignupPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'fr'
  const isRTL  = locale === 'ar'
  const t      = useTranslations('auth')

  // ── Identity mode: phone (WhatsApp) or email ───────────────────────────────
  const [mode, setMode]   = useState<'phone' | 'email'>('phone')

  // ── Stepper ────────────────────────────────────────────────────────────────
  const [step, setStep]   = useState(0)

  // ── Phone path ─────────────────────────────────────────────────────────────
  const [phone, setPhone] = useState('')

  // ── Email path ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [otpDigits, setOtpDigits]   = useState<string[]>(Array(6).fill(''))
  const [storeName, setStoreName]   = useState('')
  const [sector, setSector]         = useState('')
  const [city, setCity]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [resendAllowed, setResendAllowed] = useState(false)
  const [smsAvailable, setSmsAvailable]   = useState(false)
  // Filled once the account exists: drives the confirmation screen (step 3).
  const [done, setDone] = useState<{ trialDays: number; exists: boolean; licenseKey?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const smsTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown      = useImperativeCountdown()
  const resendWait     = useImperativeCountdown()

  const startResendTimers = useCallback(() => {
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
    if (smsTimerRef.current)    clearTimeout(smsTimerRef.current)
    setResendAllowed(false)
    setSmsAvailable(false)
    resendWait.startCountdown(60)
    resendTimerRef.current = setTimeout(() => setResendAllowed(true), 60000)
    smsTimerRef.current    = setTimeout(() => setSmsAvailable(true),  60000)
  }, [resendWait])

  useEffect(() => () => {
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
    if (smsTimerRef.current)    clearTimeout(smsTimerRef.current)
  }, [])

  // Move focus to the new step's heading so keyboard and screen-reader users land on the change.
  useEffect(() => {
    if (step > 0) document.querySelector<HTMLElement>('[data-step-heading]')?.focus()
  }, [step])

  // ── Step 0: send OTP ───────────────────────────────────────────────────────
  const sendOtp = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true); setError('')
    try {
      if (mode === 'phone') {
        const digits = phone.replace(/\D/g, '')
        if (digits.length < 9) { setError(t('phone_invalid')); return }
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: digits, locale }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error === 'rate_limited' ? t('rate_limited') : t('send_failed'))
          return
        }
      } else {
        // Email path
        const emailVal = email.trim().toLowerCase()
        if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          setError(t('email_invalid')); return
        }
        const res = await fetch('/api/auth/send-otp-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal, locale }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error === 'rate_limited' ? t('rate_limited') : t('email_send_failed'))
          return
        }
      }
      setStep(1)
      setOtpDigits(Array(6).fill(''))
      countdown.startCountdown(300)
      startResendTimers()
    } finally { setLoading(false) }
  }, [mode, phone, email, locale, t, countdown, startResendTimers])

  // ── Step 1: verify OTP ────────────────────────────────────────────────────
  const verifyOtp = useCallback(async () => {
    const otp = otpDigits.join('')
    if (otp.length < 6) return
    setLoading(true); setError('')
    try {
      const body = mode === 'phone'
        ? { phone: phone.replace(/\D/g, ''), otp, locale }
        : { email: email.trim().toLowerCase(), otp, locale }
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'invalid_otp')      setError(t('otp_invalid', { remaining: data.attemptsRemaining ?? 0 }))
        else if (data.error === 'too_many_attempts') setError(t('too_many_attempts'))
        else setError(t('otp_expired'))
        return
      }
      setStep(2)
    } finally { setLoading(false) }
  }, [otpDigits, mode, phone, email, locale, t])

  // Auto-verify on 6-digit completion (deferred to next tick)
  useEffect(() => {
    if (otpDigits.filter(Boolean).length === 6) {
      const id = setTimeout(() => verifyOtp(), 0)
      return () => clearTimeout(id)
    }
  }, [otpDigits, verifyOtp])

  // ── Step 2: complete signup ───────────────────────────────────────────────
  const completeSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeName.trim()) { setError(t('store_name_required')); return }
    setLoading(true); setError('')
    try {
      const identifierFields = mode === 'phone'
        ? { phone: phone.replace(/\D/g, '') }
        : { email: email.trim().toLowerCase() }
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...identifierFields, storeName: storeName.trim(), sector, city, locale }),
      })
      if (!res.ok) { setError(t('signup_failed')); return }
      const data = (await res.json().catch(() => ({}))) as { exists?: boolean; trialDays?: number; licenseKey?: string }
      setDone({ trialDays: data.trialDays ?? 14, exists: data.exists === true, licenseKey: data.licenseKey })
      setStep(3)
    } finally { setLoading(false) }
  }, [storeName, mode, phone, email, sector, city, locale, t])

  // ── SMS fallback (phone path only) ────────────────────────────────────────
  const sendSms = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/send-otp-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ''), locale }),
      })
      if (!res.ok) { setError(t('sms_failed')); return }
      setOtpDigits(Array(6).fill(''))
      countdown.startCountdown(300)
    } finally { setLoading(false) }
  }, [phone, locale, t, countdown])

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 14px', minHeight: '52px',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '1rem',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', direction: 'ltr', transition: 'border-color 0.18s',
  }
  const ctaStyle: React.CSSProperties = {
    width: '100%', padding: '14px', minHeight: '52px',
    background: loading ? 'rgba(240,180,41,0.60)' : '#F0B429',
    color: '#0A2318', fontWeight: 800, fontSize: '1rem',
    borderRadius: '10px', border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', transition: 'background 0.18s', marginTop: '8px',
  }
  const titleStyle: React.CSSProperties = {
    fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
    fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF',
    marginBottom: '6px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.25,
  }
  const subStyle: React.CSSProperties = {
    fontSize: '14px', color: 'rgba(255,255,255,0.55)',
    marginBottom: '20px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.55,
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: 'rgba(255,255,255,0.70)', marginBottom: '6px',
    textAlign: isRTL ? 'right' : 'left',
  }

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <Stepper current={step} labels={[mode === 'phone' ? t('step_phone') : t('step_email'), t('step_code'), t('step_shop')]} />

      {/* ── Step 0: identity input ── */}
      {step === 0 && (
        <form onSubmit={sendOtp}>
          <h1 style={{ ...titleStyle, outline: 'none' }} tabIndex={-1} data-step-heading>{t('signup_title')}</h1>
          <p style={subStyle}>{t('signup_sub')}</p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
            {(['phone', 'email'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError('') }}
                style={{
                  flex: 1, padding: '9px', border: 'none', borderRadius: '8px',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.18s',
                  background: mode === m ? '#F0B429' : 'transparent',
                  color:      mode === m ? '#0A2318'  : 'rgba(255,255,255,0.55)',
                }}
              >
                {m === 'phone' ? `📱 ${t('phone_tab')}` : `📧 ${t('email_tab')}`}
              </button>
            ))}
          </div>

          {/* Phone input */}
          {mode === 'phone' && (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="su-phone" style={labelStyle}>{t('phone_label')}</label>
              <input
                id="su-phone" type="tel" value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="06 XX XX XX XX" required autoComplete="tel"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#F0B429' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              />
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '6px 0 0', textAlign: isRTL ? 'right' : 'left' }}>
                📱 {t('step1_wa_note')}
              </p>
            </div>
          )}

          {/* Email input */}
          {mode === 'email' && (
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="su-email" style={labelStyle}>{t('email_label')}</label>
              <input
                id="su-email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('email_placeholder')} required autoComplete="email"
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = '#F0B429' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              />
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '6px 0 0', textAlign: isRTL ? 'right' : 'left' }}>
                📧 {t('step1_email_note')}
              </p>
            </div>
          )}

          {error && <p role="alert" style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={ctaStyle}>
            {loading ? '...' : t('step1_cta')}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
              {t('already_account')}{' '}
              <a href={`/${locale}/auth/login`} style={{ color: '#F0B429', fontWeight: 600, textDecoration: 'none' }}>{t('sign_in')}</a>
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
              {t('have_license')}{' '}
              <a href={`/${locale}/portal/login`} style={{ color: 'rgba(255,255,255,0.50)', textDecoration: 'underline' }}>{t('portal_link')}</a>
            </p>
          </div>
        </form>
      )}

      {/* ── Step 1: OTP ── */}
      {step === 1 && (
        <div>
          <h1 style={{ ...titleStyle, outline: 'none' }} tabIndex={-1} data-step-heading>{t('otp_heading')}</h1>
          <p style={{ ...subStyle, marginBottom: '24px' }}>
            {mode === 'phone' ? t('otp_sent_to') : t('otp_sent_to_email')}{' '}
            <strong style={{ color: '#FFFFFF' }}>{mode === 'phone' ? phone : email}</strong>
          </p>
          <OtpBoxes groupLabel={t('code_label')} digitLabel={(n) => t('digit', { n })} value={otpDigits} onChange={setOtpDigits} onComplete={() => {
            const id = setTimeout(() => verifyOtp(), 0)
            return () => clearTimeout(id)
          }} />
          {loading && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '16px' }}>...</p>}
          {error && <p role="alert" style={{ color: '#F87171', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            {countdown.remaining > 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', margin: 0 }}>
                {t('otp_expires')} <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{countdown.display}</strong>
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{t('otp_expired')}</p>
            )}
          </div>

          {!resendAllowed && resendWait.remaining > 0 && (
            <p aria-live="polite" style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '14px' }}>
              {t('resend_in', { seconds: resendWait.remaining })}
            </p>
          )}
          {/* Resend buttons */}
          {resendAllowed && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
              {mode === 'phone' ? (
                <>
                  <button onClick={() => sendOtp()} disabled={loading}
                    style={{ background: 'transparent', border: '1px solid rgba(37,211,102,0.35)', borderRadius: '8px', color: '#25D366', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    📱 {t('resend_wa')}
                  </button>
                  {smsAvailable && (
                    <button onClick={sendSms} disabled={loading}
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '8px', color: 'rgba(255,255,255,0.55)', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      💬 {t('resend_sms')}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={() => sendOtp()} disabled={loading}
                  style={{ background: 'transparent', border: '1px solid rgba(240,180,41,0.35)', borderRadius: '8px', color: '#F0B429', fontSize: '13px', padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  📧 {t('email_tab')} — {t('resend_wa').replace('WhatsApp', 'email')}
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => { setStep(0); setError('') }}
            style={{ display: 'block', margin: '20px auto 0', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.40)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {mode === 'phone' ? t('back_phone') : t('back_email')}
          </button>
        </div>
      )}

      {/* ── Step 2: store setup ── */}
      {step === 2 && (
        <form onSubmit={completeSignup}>
          <h1 style={{ ...titleStyle, outline: 'none' }} tabIndex={-1} data-step-heading>{t('step3_heading')}</h1>
          <p style={subStyle}>{t('step3_sub')}</p>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="store-name" style={labelStyle}>{t('store_name')}</label>
            <input
              id="store-name" type="text" value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder={t('store_name_ph')} required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#F0B429' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="sector" style={labelStyle}>{t('sector_label')}</label>
            <select id="sector" value={sector} onChange={e => setSector(e.target.value)}
              style={{ ...inputStyle, color: sector ? '#FFFFFF' : 'rgba(255,255,255,0.40)' }}>
              <option value="">{t('sector_placeholder')}</option>
              {SECTORS.map(s => (
                <option key={s.value} value={s.value}>
                  {locale === 'ar' ? s.ar : locale === 'fr' ? s.fr : s.en}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="city" style={labelStyle}>{t('city_label')}</label>
            <select id="city" value={city} onChange={e => setCity(e.target.value)}
              style={{ ...inputStyle, color: city ? '#FFFFFF' : 'rgba(255,255,255,0.40)' }}>
              <option value="">{t('city_placeholder')}</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {error && <p role="alert" style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={ctaStyle}>
            {loading ? '...' : t('step3_cta')}
          </button>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginTop: '12px' }}>
            {t('step3_later')}
          </p>
        </form>
      )}

      {/* ── Step 3: confirmation: key, downloads, next steps ── */}
      {step === 3 && done && (() => {
        const lang = locale === 'ar' || locale === 'fr' ? locale : 'en'
        const days = done.trialDays
        const c = {
          ar: {
            title: done.exists ? 'لديك حساب بالفعل' : 'تم إنشاء حسابك',
            body: done.exists
              ? 'هذا الرقم أو البريد مسجّل مسبقاً. مفتاح الترخيص أدناه، ويمكنك تحميل التطبيق مباشرة.'
              : `بدأت تجربتك المجانية لمدة ${days} يوماً. هذا مفتاح الترخيص الخاص بك: احتفظ به، ستحتاجه في التطبيق.`,
            keyLabel: 'مفتاح الترخيص', copy: 'نسخ', copied: 'تم النسخ',
            nokey: 'سنرسل لك مفتاح الترخيص قريباً. يمكنك أيضاً التواصل معنا على واتساب.',
            steps: ['حمّل التطبيق لجهازك', 'افتحه وأدخل مفتاح الترخيص', 'ابدأ البيع'],
            win: 'تحميل لنظام Windows', and: 'تحميل لنظام Android', portal: 'الدخول إلى فضاء التاجر',
          },
          fr: {
            title: done.exists ? 'Vous avez déjà un compte' : 'Votre compte est créé',
            body: done.exists
              ? 'Ce numéro ou cet e-mail est déjà enregistré. Votre clé de licence est ci-dessous et vous pouvez télécharger l’application.'
              : `Votre essai gratuit de ${days} jours a commencé. Voici votre clé de licence : gardez-la, l’application vous la demandera.`,
            keyLabel: 'Clé de licence', copy: 'Copier', copied: 'Copié',
            nokey: 'Votre clé de licence vous sera envoyée très vite. Vous pouvez aussi nous écrire sur WhatsApp.',
            steps: ['Téléchargez l’application', 'Ouvrez-la et saisissez votre clé', 'Commencez à vendre'],
            win: 'Télécharger pour Windows', and: 'Télécharger pour Android', portal: 'Accéder à mon espace',
          },
          en: {
            title: done.exists ? 'You already have an account' : 'Your account is ready',
            body: done.exists
              ? 'This phone number or email is already registered. Your license key is below and you can download the app.'
              : `Your ${days}-day free trial has started. Here is your license key: keep it, the app will ask for it.`,
            keyLabel: 'License key', copy: 'Copy', copied: 'Copied',
            nokey: 'Your license key will be sent to you shortly. You can also message us on WhatsApp.',
            steps: ['Download the app', 'Open it and enter your key', 'Start selling'],
            win: 'Download for Windows', and: 'Download for Android', portal: 'Open my merchant portal',
          },
        }[lang]
        const copyKey = async () => {
          try { await navigator.clipboard.writeText(done.licenseKey ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked: the key stays selectable */ }
        }
        const linkBtn: React.CSSProperties = { ...ctaStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxSizing: 'border-box', marginTop: 0 }
        const ghostBtn: React.CSSProperties = { ...linkBtn, background: 'transparent', color: '#FFFFFF', border: '1.5px solid rgba(255,255,255,0.28)', fontWeight: 700 }
        return (
          <div role="status">
            <div aria-hidden="true" style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#F0B429', color: '#0A2318', display: 'grid', placeItems: 'center', fontSize: '1.6rem', fontWeight: 800, margin: '0 auto 14px' }}>✓</div>
            <h1 style={{ ...titleStyle, textAlign: 'center', outline: 'none' }} tabIndex={-1} data-step-heading>{c.title}</h1>
            <p style={{ ...subStyle, textAlign: 'center' }}>{c.body}</p>

            {done.licenseKey ? (
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(240,180,41,0.35)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F0B429', marginBottom: '6px', textAlign: isRTL ? 'right' : 'left' }}>{c.keyLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', direction: 'ltr' }}>
                  <code style={{ flex: 1, fontSize: '15px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.02em', wordBreak: 'break-all', userSelect: 'all' }}>{done.licenseKey}</code>
                  <button type="button" onClick={copyKey} style={{ minHeight: '44px', padding: '0 16px', borderRadius: '8px', border: '1px solid rgba(240,180,41,0.5)', background: 'transparent', color: '#F0B429', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {copied ? c.copied : c.copy}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ ...subStyle, textAlign: 'center', color: 'rgba(240,180,41,0.85)' }}>{c.nokey}</p>
            )}

            <ol style={{ listStyle: 'none', margin: '0 0 20px', padding: 0, display: 'grid', gap: '8px' }}>
              {c.steps.map((st, i) => (
                <li key={st} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                  <span aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(240,180,41,0.5)', color: '#F0B429', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  {st}
                </li>
              ))}
            </ol>

            <div style={{ display: 'grid', gap: '10px' }}>
              <a href={`/api/download/windows?locale=${locale}`} style={linkBtn}>{c.win}</a>
              <a href={`/api/download/android?locale=${locale}`} style={ghostBtn}>{c.and}</a>
              <a href={`/${locale}/portal/dashboard`} style={{ display: 'block', marginTop: '6px', textAlign: 'center', color: 'rgba(255,255,255,0.65)', fontSize: '14px', textDecoration: 'underline' }}>
                {c.portal}
              </a>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
