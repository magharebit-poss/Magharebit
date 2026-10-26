'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import VideoModal from '@/components/VideoModal';
import Logo from '@/components/brand/Logo';
import { toArabicNumerals, currencySymbol } from '@/lib/formatters';

interface MockupProduct {
  name: string;
  price: string;
  emoji: string;
}

// Functional value propositions only — no merchant counts or uptime figures
// until they can be evidenced.
const PROOF = {
  ar: {
    pill: 'دعم فني محلي',
    stat1: { value: 'المغرب', label: 'مصمم للتجارة المغربية' },
    stat2: { value: 'أوفلاين', label: 'يعمل بدون انقطاع الإنترنت' },
  },
  fr: {
    pill: 'Support technique local',
    stat1: { value: 'Maroc', label: 'Conçu pour le commerce marocain' },
    stat2: { value: 'Hors ligne', label: 'Fonctionne sans coupure internet' },
  },
  en: {
    pill: 'Local technical support',
    stat1: { value: 'Morocco', label: 'Designed for Moroccan retail' },
    stat2: { value: 'Offline', label: 'Keeps working without internet' },
  },
} as const;

// Items the hero mockup "rings up" one by one. Prices are illustrative demo
// values for the mockup, not a price list.
const DEMO_ITEMS = [
  { emoji: '🍵', price: 8, name: { ar: 'أتاي', fr: 'Atay', en: 'Atay (mint tea)' } },
  { emoji: '🥐', price: 8, name: { ar: 'كرواسان', fr: 'Croissant', en: 'Croissant' } },
  { emoji: '☕', price: 10, name: { ar: 'قهوة', fr: 'Café', en: 'Coffee' } },
] as const;
const DEMO_INTERVAL_MS = 3000;

export default function HeroSection() {
  const t = useTranslations('hero');
  const tMock = useTranslations('hero.mockup');
  const tLead = useTranslations('lead_modal');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  const proof = PROOF[lang];
  const [videoOpen, setVideoOpen] = useState(false);

  // Live cart simulation: one demo item is added every 3 s, then the cart
  // resets. Reduced-motion visitors get the completed cart and no timer, and
  // everyone gets a pause control (WCAG 2.2.2).
  const [demoCount, setDemoCount] = useState(0);
  const [demoPaused, setDemoPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (reducedMotion || demoPaused) return;
    const id = window.setInterval(() => {
      // 0 → 1 → 2 → 3 items, hold on the full cart for one beat, then reset.
      setDemoCount((c) => (c > DEMO_ITEMS.length ? 0 : c + 1));
    }, DEMO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, demoPaused]);
  const shownCount = reducedMotion ? DEMO_ITEMS.length : Math.min(demoCount, DEMO_ITEMS.length);
  const lastAdded = shownCount > 0 && !reducedMotion ? shownCount - 1 : -1;
  const cartItems = DEMO_ITEMS.slice(0, shownCount);
  const demoTotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const demoPauseLabel =
    lang === 'ar'
      ? demoPaused ? 'تشغيل العرض التوضيحي' : 'إيقاف العرض التوضيحي'
      : lang === 'fr'
      ? demoPaused ? 'Reprendre la démo' : 'Mettre la démo en pause'
      : demoPaused ? 'Resume demo' : 'Pause demo';

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

  // Product grid: the three demo items first (so the one being "tapped" is
  // always visible), then the remaining catalogue tiles to fill six slots.
  const gridTiles: { emoji: string; name: string; price: string }[] = [
    ...DEMO_ITEMS.map((d) => ({ emoji: d.emoji, name: d.name[lang], price: String(d.price) })),
    ...mockupProducts.filter((p) => !DEMO_ITEMS.some((d) => d.emoji === p.emoji)),
  ].slice(0, 6);

  return (
    <section
      className="relative min-h-screen bg-brand-950 flex items-start overflow-hidden"
      style={{ paddingBottom: '48px' }}
    >

      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none">
        {/* A1 ambient backdrop: Moroccan counter still (AI draft, decorative only).
            Kept under a Pine Green wash so text contrast and the brand tint hold;
            every sign, screen and logo is drawn in code on top, never in the image. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/media/a1-hero.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 65%',
            opacity: 0.32,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,35,24,0.78) 0%, rgba(10,35,24,0.62) 45%, #0A2318 100%)',
            mixBlendMode: 'multiply',
          }}
        />
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

        {/* Above the fold: no data-aos here. AOS keeps those elements invisible until its
            script runs, which pushed the largest paint back to after hydration. */}

        {/* Live indicator */}
        <div style={{ marginBottom: '14px' }}>
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
            <span>{proof.pill}</span>
          </div>
        </div>

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/[0.18] rounded-full px-5 py-2 mb-10"
        >
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
          <span className="font-arabic text-sm text-white/88">{t('badge')}</span>
        </div>

        {/* Headline */}
        <h1
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
          className="text-white/38 text-base font-sans mb-3 mt-2"
        >
          {t('line3')}
        </p>

        {/* Subheadline */}
        <p
          className="font-arabic text-white/65 max-w-[600px] mx-auto leading-[2] mb-10"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)' }}
        >
          {t('sub')}
        </p>

        {/* CTA buttons */}
        <div
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
            href={`/${locale}/auth/signup`}
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

        {/* Trust row */}
        <div
          className="flex flex-wrap gap-6 justify-center font-arabic text-sm text-white/42 mt-8 mb-4"
        >
          {(['trust1', 'trust2', 'trust3'] as const).map((k) => (
            <span key={k}>
              <span className="text-brand-400">✓ </span>
              {t(k)}
            </span>
          ))}
        </div>

        {/* Soft conversion path: opens the lead capture modal (LeadModalHost) */}
        <button
          type="button"
          data-lead-modal
          className="font-arabic mb-10 min-h-[44px] px-3 text-sm font-semibold text-gold-400 underline underline-offset-4 hover:text-gold-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
        >
          {tLead('callback_link')}
        </button>

        {/* Hero mockup */}
        <div
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

            {/* App top bar: native brand lockup (vector), never AI-drawn */}
            <div
              className="flex items-center justify-between px-3"
              style={{
                height: '34px',
                background: '#0A2318',
                direction: isRTL ? 'rtl' : 'ltr',
                borderBottom: '1px solid rgba(240,180,41,0.35)',
              }}
            >
              <Logo variant="horizontal" on="dark" height={20} alt="MAGHAREBIT" />
              {!reducedMotion && (
                <button
                  type="button"
                  onClick={() => setDemoPaused((p) => !p)}
                  aria-pressed={demoPaused}
                  aria-label={demoPauseLabel}
                  title={demoPauseLabel}
                  className="flex items-center justify-center rounded-full text-[10px] text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
                  style={{ width: '24px', height: '24px', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <span aria-hidden="true">{demoPaused ? '▶' : '❚❚'}</span>
                </button>
              )}
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
                    {shownCount}
                  </span>
                  <span>{mockupBasketTitle}</span>
                </div>
                {/* Announced politely so assistive tech hears the total, not each tick */}
                <div aria-live="off" className="flex flex-col gap-1.5">
                  {cartItems.map((item, idx) => (
                    <div
                      key={item.emoji}
                      className="text-[10px] text-[#374151] flex justify-between py-1.5 border-b border-[#F1F5F9]"
                      style={{
                        fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
                        animation: idx === lastAdded ? 'fade-in-row 0.4s ease-out' : undefined,
                      }}
                    >
                      <span className="font-bold">{item.price.toFixed(2)} {mockupCurrency}</span>
                      <span>{item.name[lang]} × 1</span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-2 border-t-2 border-[#0F3D2A]">
                  <div
                    className="flex justify-between font-bold text-[11px] mb-1.5"
                    style={{ fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif' }}
                  >
                    <span className="text-[#B8860B]">{demoTotal.toFixed(2)} {mockupCurrency}</span>
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
                  {gridTiles.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white border rounded-lg p-1.5 text-center flex flex-col items-center justify-center gap-0.5 transition-all hover:border-[#0F3D2A] hover:shadow-sm"
                      style={
                        idx === lastAdded
                          ? { borderColor: '#B8860B', boxShadow: '0 0 0 2px rgba(240,180,41,0.55)' }
                          : { borderColor: '#E2E8F0' }
                      }
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
              {proof.stat1.value}
            </span>
            <span style={{
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '4px',
            }}>
              {proof.stat1.label}
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
              {proof.stat2.value}
            </span>
            <span style={{
              fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.6)',
              marginTop: '4px',
            }}>
              {proof.stat2.label}
            </span>
          </div>

        </div>

        {/* Mobile stat row — shown only on small screens */}
        <div
          className="flex md:hidden justify-center gap-8 mt-10"
          style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        >
          {[
            { value: proof.stat1.value, label: proof.stat1.label },
            { value: proof.stat2.value, label: proof.stat2.label },
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
