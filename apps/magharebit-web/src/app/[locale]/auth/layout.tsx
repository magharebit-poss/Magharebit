import type { Metadata } from 'next'
import Link from 'next/link'
import { routing } from '@/i18n/routing'
import { getLocale } from 'next-intl/server'
import Logo from '@/components/brand/Logo'

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const isRTL = locale === 'ar'
  const backLabel = locale === 'ar' ? '← العودة إلى الموقع' : locale === 'fr' ? '← Retour au site' : '← Back to site'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #071812 0%, #0A2318 50%, #071812 100%)',
        display: 'flex',
        flexDirection: 'column',
        direction: isRTL ? 'rtl' : 'ltr',
        fontFamily: isRTL
          ? 'Noto Naskh Arabic, Cairo, serif'
          : 'Inter, Plus Jakarta Sans, sans-serif',
      }}
    >
      {/* Top bar — logo */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 24px 0' }}>
        <Link
          href={`/${locale}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
        >
          <Logo height={36} on="dark" priority variant="horizontal" />
        </Link>
      </div>

      {/* Centered card */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '32px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: '440px',
          background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '20px', padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
        }}>
          {children}
        </div>
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', padding: '20px 24px 32px' }}>
        <Link
          href={`/${locale}`}
          style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
