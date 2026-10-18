'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

function OtpBoxes({
  value,
  onChange,
  onComplete,
}: {
  value: string[]
  onChange: (v: string[]) => void
  onComplete: () => void
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      const next = [...value]; next[idx] = ''; onChange(next); return
    }
    if (raw.length > 1) {
      const chars = raw.slice(0, 6).split('')
      const next = [...value]
      chars.forEach((c, i) => { if (idx + i < 6) next[idx + i] = c })
      onChange(next)
      refs.current[Math.min(idx + chars.length - 1, 5)]?.focus()
      if (next.filter(Boolean).length === 6) onComplete()
      return
    }
    const next = [...value]; next[idx] = raw.slice(-1); onChange(next)
    if (idx < 5) refs.current[idx + 1]?.focus()
    if (next.filter(Boolean).length === 6) onComplete()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) refs.current[idx - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent, idx: number) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...value]
    pasted.split('').forEach((c, i) => { if (idx + i < 6) next[idx + i] = c })
    onChange(next)
    refs.current[Math.min(idx + pasted.length - 1, 5)]?.focus()
    if (next.filter(Boolean).length === 6) onComplete()
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', direction: 'ltr' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={6}
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

export default function OtpPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = (params?.locale as string) ?? 'fr'
  const isRTL = locale === 'ar'
  const t = useTranslations('auth')

  const phone = searchParams?.get('phone') ?? ''
  const redirectTo = searchParams?.get('redirectTo') ?? `/${locale}/portal/dashboard`

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const verifyOtp = useCallback(async () => {
    const otp = otpDigits.join('')
    if (otp.length < 6) return
    if (!phone) { setError(t('phone_invalid')); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'invalid_otp') setError(t('otp_invalid', { remaining: data.attemptsRemaining ?? 0 }))
        else if (data.error === 'too_many_attempts') setError(t('too_many_attempts'))
        else setError(t('otp_expired'))
        return
      }
      router.push(redirectTo)
    } finally { setLoading(false) }
  }, [otpDigits, phone, locale, router, redirectTo, t])

  useEffect(() => {
    if (otpDigits.every(Boolean) && otpDigits.join('').length === 6) {
      const id = setTimeout(() => verifyOtp(), 0)
      return () => clearTimeout(id)
    }
  }, [otpDigits, verifyOtp])

  const titleStyle: React.CSSProperties = {
    fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
    fontSize: '1.4rem', fontWeight: 800, color: '#FFFFFF',
    marginBottom: '6px', textAlign: isRTL ? 'right' : 'left', lineHeight: 1.25,
  }

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <h1 style={titleStyle}>{t('otp_heading')}</h1>
      {phone && (
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.50)', marginBottom: '28px', textAlign: isRTL ? 'right' : 'left' }}>
          {t('otp_sent_to')} <strong style={{ color: '#FFFFFF' }}>{phone}</strong>
        </p>
      )}

      <OtpBoxes value={otpDigits} onChange={setOtpDigits} onComplete={verifyOtp} />

      {loading && (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '16px' }}>...</p>
      )}

      {error && (
        <p style={{ color: '#F87171', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</p>
      )}

      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <a
          href={`/${locale}/auth/login`}
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', textDecoration: 'none' }}
        >
          {t('back_phone')}
        </a>
      </div>
    </div>
  )
}
