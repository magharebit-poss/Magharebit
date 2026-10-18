'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import VideoModal from '@/components/VideoModal';
import { toArabicNumerals, currencySymbol } from '@/lib/formatters';

interface MockupProduct {
  name: string;
  price: string;
  emoji: string;
}
interface MockupBasketItem {
  name: string;
  qty: string;
  price: string;
}

export default function HeroSection() {
  const t = useTranslations('hero');
  const tMock = useTranslations('hero.mockup');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const [videoOpen, setVideoOpen] = useState(false);

  // Localized mockup data
  const mockupUrl = tMock('url');
  const mockupSearch = tMock('search');
  // Currency derived from locale so it stays consistent with the rest of the site
  // (د.م. for Arabic, DH for French, MAD for English) — overrides translation key.
  const mockupCurrency = currencySymbol(locale);
  const mockupBasketTitle = tMock('basket_title');
  const mockupTotalLabel = tMock('total_label');
  const mockupCheckoutBtn = tMock('checkout_btn');
  const mockupCategories = tMock.raw('categories') as string[];
  const mockupProducts = tMock.raw('products') as MockupProduct[];
  const mockupBasketItems = tMock.raw('basket_items') as MockupBasketItem[];

  // Basket total — sum of basket_items, formatted to Arabic-Indic numerals when ar
  const basketTotalRaw = mockupBasketItems
    .reduce((sum, item) => sum + parseFloat(item.price), 0)
    .toFixed(2);
  const basketTotal = toArabicNumerals(basketTotalRaw, locale);
  const basketCount = toArabicNumerals(mockupBasketItems.length, locale);

  return (
    <section
      className="relative min-h-screen bg-brand-950 flex items-start overflow-hidden"
      style={{ paddingBottom: '48px' }}
    >

      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 65% 55% at 50% 100%, rgba(46,139,87,0.28) 0%, transparent 70%)'
        }} />
        {/* Gold headline glow */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '600px',
          background: 'radial-gradient(ellipse at center, rgba(240,180,41,0.07) 0%, rgba(15,61,42,0.15) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        {/* Zellige ambient watermark (SVG as mask → gold lines on pine) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundColor: '#F0B429',
            WebkitMaskImage: "url('/brand/zellige-pattern.svg')",
            maskImage: "url('/brand/zellige-pattern.svg')",
            WebkitMaskRepeat: 'repeat',
            maskRepeat: 'repeat',
            WebkitMaskSize: '368px 506.7px',
            maskSize: '368px 506.7px',
            opacity: 0.05,
          }}
        />
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000, transparent 80%)',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 30%, #000, transparent 80%)',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(transparent, #0A2318)' }} />
      </div>

      {/* Content */}
      <div
        className="relative z-10 max-w-[1100px] mx-auto text-center px-6 pt-32 pb-20 w-full"
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >

        {/* Live indicator */}
        <div data-aos="fade-down" style={{ marginBottom: '14px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(34,197,94,0.10)',
              border: '1px solid rgba(34,197,94,0.22)',
              borderRadius: '999px',
              padding: '5px 14px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.80)',
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
            }}
          >
            <span style={{ color: '#22C55E', fontSize: '10px', lineHeight: 1 }}>●</span>
            <span>
              {locale === 'ar'
                ? '23 تاجر يستخدم النظام الآن'
                : locale === 'fr'
                ? '23 commerçants utilisent le système maintenant'
                : '23 merchants using the system now'}
            </span>
          </div>
        </div>

        {/* Badge */}
        <div
          data-aos="fade-down"
          data-aos-delay="50"
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/[0.18] rounded-full px-5 py-2 mb-10"
        >
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
          <span className="font-arabic text-sm text-white/88">{t('badge')}</span>
        </div>

        {/* Headline */}
        <h1
          data-aos="fade-up"
          data-aos-delay="100"
          className="font-arabic font-bold leading-[1.2] mb-4"
          style={{ letterSpacing: '-0.01em', lineHeight: '1.12' }}
        >
          <span
            className="block text-white"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 5.5rem)' }}
          >
            {t('line1')}
          </span>
          <span
            className="block text-shimmer"
            style={{ fontSize: 'clamp(2.5rem, 8vw, 5.5rem)' }}
          >
            {t('line2')}
          </span>
        </h1>

        {/* Subtitle line 3 */}
        <p
          data-aos="fade-up"
          data-aos-delay="150"
          className="text-white/38 text-base font-sans mb-3 mt-2"
        >
          {t('line3')}
        </p>

        {/* Subheadline */}
        <p
          data-aos="fade-up"
          data-aos-delay="200"
          className="font-arabic text-white/65 max-w-[600px] mx-auto leading-[2] mb-10"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}
        >
          {t('sub')}
        </p>

        {/* CTA buttons */}
        <div
          data-aos="fade-up"
          data-aos-delay="250"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <a
            href={`/${locale}/demo`}
            className="font-arabic font-bold transition-all duration-200 hover:-translate-y-0.5"
            style={{
              display: 'inline-flex',
              width: 'auto',
              whiteSpace: 'nowrap',
              borderRadius: '999px',
              padding: '.9rem 2.25rem',
              background: '#F0B429',
              color: '#0A2318',
              boxShadow: '0 6px 24px rgba(240,180,41,0.45)',
            }}
          >
            {t('cta_primary')} ←
          </a>
          <button
            onClick={() => setVideoOpen(true)}
            className="font-arabic font-medium transition-all duration-200"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              width: 'auto',
              whiteSpace: 'nowrap',
              borderRadius: '999px',
              padding: '.9rem 2.25rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '14px' }}>▶</span>
            {t('cta_secondary')}
          </button>
        </div>

        {/* YouTube demo link */}
        <div data-aos="fade-up" data-aos-delay="270" style={{ marginTop: '16px' }}>
          <a
            href="https://www.youtube.com/channel/UCsFWs7PYax6j70XYrJYKjUg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.50)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
            }}
          >
            📺{' '}
            {locale === 'ar'
              ? 'شاهد العرض على YouTube'
              : locale === 'fr'
              ? 'Voir notre démo sur YouTube'
              : 'Watch our demo on YouTube'}
          </a>
        </div>

        {/* Trust row */}
        <div
          data-aos="fade-up"
          data-aos-delay="300"
          className="flex flex-wrap gap-6 justify-center font-arabic text-sm text-white/42 mt-8 mb-4"
        >
          {(['trust1', 'trust2', 'trust3'] as const).map((k) => (
            <span key={k}>
              <span className="text-brand-400">✓ </span>
              {t(k)}
            </span>
          ))}
        </div>

        {/* Hero mockup */}
        <div
          data-aos="fade-up"
          data-aos-delay="400"
          className="max-w-[880px] mx-auto animate-[float_6s_ease-in-out_infinite]"
          style={{ position: 'relative' }}
        >
          {/* Radial glow behind mockup */}
          <div style={{
            position: 'absolute',
            inset: '-20%',
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(46,139,87,0.25), transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          {/* Browser frame */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {/* Chrome bar */}
            <div
              style={{
                height: '32px',
                background: '#1a4a32',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '14px',
                paddingRight: '14px',
                gap: '6px',
              }}
            >
              {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
                <span
                  key={c}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: c,
                  }}
                />
              ))}
              <div
                style={{
                  flex: 1,
                  marginLeft: '10px',
                  marginRight: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '999px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                  {mockupUrl}
                </span>
              </div>
            </div>

            {/* Screen — locale-aware POS mockup */}
            <div
              className="bg-white h-[280px] overflow-hidden grid"
              style={{
                direction: isRTL ? 'rtl' : 'ltr',
                gridTemplateColumns: '35% 65%',
              }}
            >
              {/* Cart panel */}
              <div
                className="bg-[#F8FAFC] flex flex-col gap-1.5 p-3"
                style={{
                  borderLeft: isRTL ? '1px solid #F1F5F9' : 'none',
                  borderRight: isRTL ? 'none' : '1px solid #F1F5F9',
                }}
              >
                <div
                  className="font-bold text-xs text-[#0F172A] flex justify-between items-center mb-1"
                  style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                >
                  <span className="bg-[#F0B429] text-[#0A2318] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {basketCount}
                  </span>
                  <span>{mockupBasketTitle}</span>
                </div>
                {mockupBasketItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="text-[10px] text-[#374151] flex justify-between py-1.5 border-b border-[#F1F5F9]"
                    style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                  >
                    <span className="font-bold">{toArabicNumerals(item.price, locale)}</span>
                    <span>{item.name} {toArabicNumerals(item.qty, locale)}</span>
                  </div>
                ))}
                <div className="mt-auto pt-2 border-t-2 border-[#0F3D2A]">
                  <div
                    className="flex justify-between font-bold text-[11px] mb-1.5"
                    style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                  >
                    <span className="text-[#F0B429]">{basketTotal} {mockupCurrency}</span>
                    <span>{mockupTotalLabel}</span>
                  </div>
                  <div
                    className="bg-[#0F3D2A] text-white rounded-lg py-2 w-full text-[10px] text-center font-bold"
                    style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                  >
                    {mockupCheckoutBtn}
                  </div>
                </div>
              </div>

              {/* Products panel */}
              <div className="p-2.5 flex flex-col gap-1.5" style={{ position: 'relative' }}>
                {/* Top inner shadow suggesting scroll depth */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '12px',
                    background: 'linear-gradient(180deg, rgba(15,23,42,0.08), transparent)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
                <div
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg h-7 flex items-center px-2 text-[10px] text-[#94A3B8]"
                  style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                >
                  <span style={{ display: 'inline-block', transform: isRTL ? 'scaleX(-1)' : 'none' }}>🔍</span>
                  <span style={{ marginInlineStart: '4px' }}>{mockupSearch}</span>
                </div>
                <div className="flex gap-1 overflow-hidden">
                  {mockupCategories.map((cat, i) => (
                    <span
                      key={cat + i}
                      className={`text-[9px] px-2.5 py-1 rounded-full font-bold flex-shrink-0 ${
                        i === 0
                          ? 'bg-[#0F3D2A] text-white'
                          : 'bg-white text-[#64748B] border border-[#E2E8F0]'
                      }`}
                      style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5 flex-1">
                  {mockupProducts.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-[#E2E8F0] rounded-lg p-1.5 text-center flex flex-col items-center justify-center gap-0.5 transition-all hover:border-[#0F3D2A] hover:shadow-sm"
                    >
                      <div className="text-[20px] leading-none">{p.emoji}</div>
                      <span
                        className="text-[9px] text-[#0F172A] block leading-tight font-medium"
                        style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                      >
                        {p.name}
                      </span>
                      <span className="text-[9px] text-[#0F3D2A] font-bold block">
                        {toArabicNumerals(p.price, locale)} {mockupCurrency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stat card 1 — active stores (desktop only) */}
          <div
            className="hidden md:flex"
            style={{
              position: 'absolute',
              bottom: '-16px',
              ...(isRTL ? { right: '-16px' } : { left: '-16px' }),
              background: 'rgba(15,61,42,0.92)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '12px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              flexDirection: 'column',
              alignItems: isRTL ? 'flex-end' : 'flex-start',
              minWidth: '120px',
              zIndex: 10,
            }}
          >
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
              fontSize: '1.6rem',
              color: '#F0B429',
              lineHeight: 1,
            }}>
              {t('stat1_value')}
            </span>
            <span style={{
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '4px',
            }}>
              {t('stat1_label')}
            </span>
          </div>

          {/* Stat card 2 — uptime (desktop only) */}
          <div
            className="hidden md:flex"
            style={{
              position: 'absolute',
              bottom: '-16px',
              ...(isRTL ? { left: '-16px' } : { right: '-16px' }),
              background: 'rgba(15,61,42,0.92)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '14px',
              padding: '12px 18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              flexDirection: 'column',
              alignItems: isRTL ? 'flex-end' : 'flex-start',
              minWidth: '120px',
              zIndex: 10,
            }}
          >
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 800,
              fontSize: '1.6rem',
              color: '#F0B429',
              lineHeight: 1,
            }}>
              {t('stat2_value')}
            </span>
            <span style={{
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '4px',
            }}>
              {t('stat2_label')}
            </span>
          </div>

        </div>

        {/* Mobile stat row — shown only on small screens */}
        <div
          className="flex md:hidden justify-center gap-8 mt-10"
          style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        >
          {[
            { value: t('stat1_value'), label: t('stat1_label') },
            { value: t('stat2_value'), label: t('stat2_label') },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'rgba(15,61,42,0.7)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '14px',
                padding: '12px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '110px',
              }}
            >
              <span style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 800,
                fontSize: '1.5rem',
                color: '#F0B429',
                lineHeight: 1,
              }}>
                {stat.value}
              </span>
              <span style={{
                fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.6)',
                marginTop: '5px',
                textAlign: 'center',
              }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

      </div>

      <VideoModal isOpen={videoOpen} onClose={() => setVideoOpen(false)} />
    </section>
  );
}
