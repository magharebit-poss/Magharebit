'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
function OtpBoxes({ value, onChange, onComplete }: {
  value:      string[]
  onChange:   (v: string[]) => void
  onComplete: () => void
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
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
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

// ── Progress dots ─────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? '20px' : '8px', height: '8px', borderRadius: '999px',
          background: i === current ? '#F0B429' : i < current ? 'rgba(240,180,41,0.40)' : 'rgba(255,255,255,0.18)',
          transition: 'all 0.25s',
        }} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SignupPage() {
  const params = useParams()
  const router = useRouter()
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

  const resendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const smsTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown      = useImperativeCountdown()

  const startResendTimers = useCallback(() => {
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
    if (smsTimerRef.current)    clearTimeout(smsTimerRef.current)
    setResendAllowed(false)
    setSmsAvailable(false)
    resendTimerRef.current = setTimeout(() => setResendAllowed(true), 60000)
    smsTimerRef.current    = setTimeout(() => setSmsAvailable(true),  60000)
  }, [])

  useEffect(() => () => {
    if (resendTimerRef.current) clearTimeout(resendTimerRef.current)
    if (smsTimerRef.current)    clearTimeout(smsTimerRef.current)
  }, [])

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
      router.push(`/${locale}/demo`)
    } finally { setLoading(false) }
  }, [storeName, mode, phone, email, sector, city, locale, router, t])

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
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    borderRadius: '10px', color: '#FFFFFF', fontSize: '1rem',
    outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', direction: 'ltr', transition: 'border-color 0.18s',
  }
  const ctaStyle: React.CSSProperties = {
    width: '100%', padding: '13px',
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
      <StepDots current={step} total={3} />

      {/* ── Step 0: identity input ── */}
      {step === 0 && (
        <form onSubmit={sendOtp}>
          <h1 style={titleStyle}>{t('signup_title')}</h1>
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

          {error && <p style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
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
          <h1 style={titleStyle}>{t('otp_heading')}</h1>
          <p style={{ ...subStyle, marginBottom: '24px' }}>
            {mode === 'phone' ? t('otp_sent_to') : t('otp_sent_to_email')}{' '}
            <strong style={{ color: '#FFFFFF' }}>{mode === 'phone' ? phone : email}</strong>
          </p>
          <OtpBoxes value={otpDigits} onChange={setOtpDigits} onComplete={() => {
            const id = setTimeout(() => verifyOtp(), 0)
            return () => clearTimeout(id)
          }} />
          {loading && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '16px' }}>...</p>}
          {error && <p style={{ color: '#F87171', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</p>}

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            {countdown.remaining > 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', margin: 0 }}>
                {t('otp_expires')} <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{countdown.display}</strong>
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#F87171', margin: 0 }}>{t('otp_expired')}</p>
            )}
          </div>

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
          <h1 style={titleStyle}>{t('step3_heading')}</h1>
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
          {error && <p style={{ color: '#F87171', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={ctaStyle}>
            {loading ? '...' : t('step3_cta')}
          </button>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginTop: '12px' }}>
            {t('step3_later')}
          </p>
        </form>
      )}
    </div>
  )
}
