'use client'

// PLACEHOLDER — MAGHAREBIT uses phone/OTP auth, not password-based auth.
// This route exists as a placeholder for future functionality or
// if users navigate here from a legacy link.
// It redirects to the forgot-password explanation page.

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function ResetPasswordPage() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) ?? 'fr'
  const isRTL = locale === 'ar'
  const t = useTranslations('auth')

  useEffect(() => {
    const id = setTimeout(() => {
      router.replace(`/${locale}/auth/forgot-password`)
    }, 1500)
    return () => clearTimeout(id)
  }, [locale, router])

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🔄</div>
      <p style={{
        fontSize: '15px',
        color: 'rgba(255,255,255,0.55)',
        fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
      }}>
        {t('redirecting')}
      </p>
    </div>
  )
}
