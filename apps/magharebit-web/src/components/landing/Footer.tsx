'use client';

import { useTranslations, useLocale } from 'next-intl';
import { BRAND } from '@/lib/brand';
import Logo from '@/components/brand/Logo';
import SocialLinks from '@/components/SocialLinks';
import NewsletterSignup from '@/components/NewsletterSignup';

export default function Footer() {
  const t = useTranslations('footer');
  const tCities = useTranslations('footer_cities');
  const tFollow = useTranslations('footer_follow');
  const locale = useLocale();
  const l = locale;

  return (
    <footer className="bg-brand-950 border-t border-white/[0.08] py-16 px-6" style={{ background: '#0A2318' }}>
      <div className="max-w-[1100px] mx-auto" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>

        {/* Newsletter block */}
        <div style={{ marginBottom: '48px' }}>
          <NewsletterSignup />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">

          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <Logo height={36} on="dark" variant="horizontal" />
            </div>
            <p className="font-arabic text-sm text-white/45 leading-[1.9] mb-4 max-w-[220px]">
              {t('tagline')}
            </p>
            <div className="space-y-1" style={{ direction: 'ltr', textAlign: locale === 'ar' ? 'right' : 'left' }}>
              <div className="font-sans text-[0.8rem] text-white/50">{BRAND.contact.email}</div>
              <div className="font-sans text-[0.8rem] text-white/50">{BRAND.contact.whatsapp}</div>
            </div>
          </div>

          {/* Products */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 16 }}>
              {t('products')}
            </p>
            <ul className="space-y-3 list-none p-0">
              {([
                [t('pos'),         `/${l}/features`],
                [t('inventory'),   `/${l}/features#inventory`],
                [t('analytics'),   `/${l}/features#analytics`],
                [t('hardware'),    `/${l}/materiel`],
                [t('comparaison'), `/${l}/comparaison`],
                [t('pricing'),     `/${l}/pricing`],
                [t('download'),    `/${l}/download`],
              ] as [string, string][]).map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 16 }}>
              {t('company')}
            </p>
            <ul className="space-y-3 list-none p-0">
              {([
                [t('about'),    `/${l}/about`],
                [t('clients'),  `/${l}/clients`],
                [t('blog'),     `/${l}/blog`],
                [t('partners'), '#'],
                [t('careers'),  '#'],
              ] as [string, string][]).map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Cities sub-block */}
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginTop: 28, marginBottom: 12 }}>
              {tCities('title')}
            </p>
            <ul className="space-y-2 list-none p-0">
              {([
                ['Casablanca', 'casablanca'],
                ['Rabat',      'rabat'],
                ['Marrakech',  'marrakech'],
              ] as [string, string][]).map(([label, slug]) => (
                <li key={slug}>
                  <a href={`/${l}/caisse-enregistreuse-${slug}`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <a href={`/${l}/clients`} className="font-arabic text-[12px] text-gold-400 hover:text-gold-500 transition-colors">
                  {tCities('all')} →
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 16 }}>
              {t('support')}
            </p>
            <ul className="space-y-3 list-none p-0">
              <li><a href={`/${l}/faq`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('faq')}</a></li>
              <li><a href={`/${l}/demo`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('help')}</a></li>
              <li><a href={`/${l}/demo`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('contact')}</a></li>
              <li><a href={`/${l}/privacy`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('privacy')}</a></li>
              <li><a href={`/${l}/status`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('status')}</a></li>
              <li><a href={`/${l}/changelog`} className="font-arabic text-sm text-white/55 hover:text-gold-400 transition-colors">{t('changelog')}</a></li>
              <li>
                <a
                  href={BRAND.contact.waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-arabic text-sm text-[#25D366] hover:text-[#20bd58] transition-colors"
                >
                  {t('whatsapp')}
                </a>
              </li>
            </ul>
          </div>

          {/* Follow us */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 16 }}>
              {tFollow('title')}
            </p>
            <SocialLinks size="md" variant="colored" />
            <p style={{ fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 12, lineHeight: 1.5 }}>
              {tFollow('sub')}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.08] pt-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="font-sans text-white/35" style={{ fontSize: '13px' }}>
            {BRAND.company.copyright} — Wayloz Group. All rights reserved.
          </span>
          <span className="font-arabic text-white/[0.22]" style={{ fontSize: '13px' }}>
            {BRAND.company.signature}
          </span>
        </div>
      </div>
    </footer>
  );
}
