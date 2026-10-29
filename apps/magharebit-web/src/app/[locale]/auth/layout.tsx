import type { Metadata } from 'next'
import { staticParams } from '@/lib/static-params'
import Link from 'next/link'
import { routing } from '@/i18n/routing'
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server'
import Logo from '@/components/brand/Logo'

export async function generateStaticParams() {
  return staticParams(routing.locales.map((locale) => ({ locale })))
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const ICONS = {
  offline: <><path d="M2 8.8a15 15 0 0 1 20 0" /><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.2" r="1" fill="currentColor" /></>,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></>,
  pin: <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
}

/**
 * Auth shell: brand panel (Pine Green, benefits) beside the form card on desktop, form only on phones.
 * Shared by sign-up, login, OTP and password screens.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale((await params).locale)
  const locale = await getLocale()
  const isRTL = locale === 'ar'
  const t = await getTranslations('lead_modal')
  const tAuth = await getTranslations('auth')
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Plus Jakarta Sans, system-ui, sans-serif'
  const benefits = [
    { icon: ICONS.offline, title: t('b1_t'), desc: t('b1_d') },
    { icon: ICONS.chat, title: t('b2_t'), desc: t('b2_d') },
    { icon: ICONS.pin, title: t('b3_t'), desc: t('b3_d') },
  ]

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #071812 0%, #0A2318 50%, #071812 100%)',
        direction: isRTL ? 'rtl' : 'ltr',
        fontFamily: fontBody,
      }}
    >
      {/* Zellige watermark, behind content only (design system: 4-6% opacity) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: '#F0B429',
          WebkitMaskImage: "url('/brand/zellige-pattern.svg')",
          maskImage: "url('/brand/zellige-pattern.svg')",
          WebkitMaskSize: '368px 506.7px',
          maskSize: '368px 506.7px',
          opacity: 0.04,
        }}
      />

      <header className="relative z-10 flex justify-center px-6 pt-7 lg:justify-start lg:px-14">
        <Link href={`/${locale}`} className="inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]">
          <Logo height={36} on="dark" priority variant="horizontal" />
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1120px] flex-1 items-center gap-10 px-5 py-8 lg:grid-cols-[1fr_480px] lg:gap-16 lg:px-14">
        {/* Brand panel: desktop only (phones go straight to the form) */}
        <section aria-label={tAuth('panel_title')} className="hidden text-white lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#F0B429]/35 bg-[#F0B429]/10 px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#F0B429]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F0B429]" />
            {t('badge')}
          </span>
          <h2 className="mt-5 text-[38px] font-extrabold leading-[1.2]">{tAuth('panel_title')}</h2>
          <ul className="mt-9 space-y-6">
            {benefits.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border border-white/10 bg-[#0F3D2A] text-[#F0B429]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{b.icon}</svg>
                </span>
                <span>
                  <span className="block text-[16px] font-bold">{b.title}</span>
                  <span className="mt-1 block max-w-[440px] text-[14.5px] leading-[1.75] text-white/65">{b.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-9 text-[13px] font-semibold text-white/50">{t('trust')}</p>
        </section>

        <div className="mx-auto w-full max-w-[480px]">
          <div
            className="rounded-[20px] border border-white/10 bg-[#0F3D2A] px-6 py-8 shadow-[0_24px_64px_rgba(0,0,0,0.40)] sm:px-9 sm:py-10"
          >
            {children}
          </div>
          <p className="mt-4 text-center text-[12.5px] text-white/40">{tAuth('secure_note')}</p>
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-8 pt-2 text-center">
        <Link href={`/${locale}`} className="inline-flex min-h-[44px] items-center text-[13px] text-white/45 hover:text-white/70">
          {locale === 'ar' ? '← العودة إلى الموقع' : locale === 'fr' ? '← Retour au site' : '← Back to site'}
        </Link>
      </footer>
    </div>
  )
}
