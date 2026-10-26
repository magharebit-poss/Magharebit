import type { Metadata } from 'next';
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import NewsletterSignup from '@/components/NewsletterSignup';
import Link from 'next/link';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('about');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/about`),
    openGraph: { ...ogBase(locale), title: t('meta_title'), description: t('meta_desc') },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('about');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const stats = [
    { value: t('stat1_value'), label: t('stat1_label') },
    { value: t('stat2_value'), label: t('stat2_label') },
    { value: t('stat3_value'), label: t('stat3_label') },
    { value: t('stat4_value'), label: t('stat4_label') },
  ];

  const values = [
    { emoji: t('val1_emoji'), title: t('val1_title'), desc: t('val1_desc') },
    { emoji: t('val2_emoji'), title: t('val2_title'), desc: t('val2_desc') },
    { emoji: t('val3_emoji'), title: t('val3_title'), desc: t('val3_desc') },
  ];

  return (
    <>
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* ── Hero ── */}
        <section
          style={{
            paddingTop: '120px',
            paddingBottom: '80px',
            paddingLeft: '24px',
            paddingRight: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '680px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span
              className="badge-pill font-display"
              data-aos="fade-down"
            >
              {t('badge')}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '20px' }}
            >
              {t('hero_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="100"
              style={{ fontFamily: fontBody, fontSize: '18px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.75 }}
            >
              {t('hero_sub')}
            </p>
          </div>
        </section>

        {/* ── Mission + Stats (2-col) ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ maxWidth: '1100px', margin: '0 auto', gap: '64px', alignItems: 'start', direction: isRTL ? 'rtl' : 'ltr' }}
          >

            {/* Left — Mission text */}
            <div data-aos="fade-up">
              <h2
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '24px' }}
              >
                {t('mission_title')}
              </h2>
              <p
                style={{ fontFamily: fontBody, fontSize: '16px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.8, marginBottom: '20px' }}
              >
                {t('mission_p1')}
              </p>
              <p
                style={{ fontFamily: fontBody, fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}
              >
                {t('mission_p2')}
              </p>
            </div>

            {/* Right — 2×2 stat grid */}
            <div
              data-aos="fade-up"
              data-aos-delay="120"
              className="grid grid-cols-2"
              style={{ gap: '16px' }}
            >
              {stats.map((stat, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isRTL ? 'flex-end' : 'flex-start',
                    direction: isRTL ? 'rtl' : 'ltr',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 800,
                      fontSize: '2rem',
                      color: '#F0B429',
                      lineHeight: 1,
                      marginBottom: '8px',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {stat.value}
                  </span>
                  <span
                    style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ── Divider ── */}
        <div style={{ maxWidth: '1100px', margin: '0 auto 80px', padding: '0 24px' }}>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* ── Our Story Timeline ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '48px' }}
            >
              {t('story_title')}
            </h2>

            {/* Desktop: 3-column horizontal timeline */}
            <div
              className="hidden md:grid md:grid-cols-3"
              style={{ position: 'relative' }}
            >
              {/* Horizontal dashed gold connector */}
              <div style={{
                position: 'absolute',
                top: '13px',
                left: 'calc(100% / 6)',
                right: 'calc(100% / 6)',
                borderTop: '2px dashed rgba(240,180,41,0.35)',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {[
                { year: t('yr1'), title: t('story1_title'), text: t('story1_text') },
                { year: t('yr2'), title: t('story2_title'), text: t('story2_text') },
                { year: t('yr3'), title: t('story3_title'), text: t('story3_text') },
              ].map((entry, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 120)}
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: '0 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#F0B429',
                    marginBottom: '14px',
                    flexShrink: 0,
                    boxShadow: '0 0 16px rgba(240,180,41,0.4)',
                  }} />
                  <span style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 800,
                    fontSize: '24px',
                    color: '#F0B429',
                    lineHeight: 1,
                  }}>
                    {entry.year}
                  </span>
                  <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#fff', margin: '8px 0 6px' }}>
                    {entry.title}
                  </div>
                  <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, maxWidth: '260px' }}>
                    {entry.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Mobile: vertical timeline */}
            <div className="flex md:hidden flex-col" style={{ gap: '32px' }}>
              {[
                { year: t('yr1'), title: t('story1_title'), text: t('story1_text') },
                { year: t('yr2'), title: t('story2_title'), text: t('story2_text') },
                { year: t('yr3'), title: t('story3_title'), text: t('story3_text') },
              ].map((entry, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F0B429', flexShrink: 0, boxShadow: '0 0 12px rgba(240,180,41,0.4)' }} />
                    {i < 2 && (
                      <div style={{ width: '2px', minHeight: '48px', flex: 1, background: 'linear-gradient(to bottom, rgba(240,180,41,0.35), transparent)', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ textAlign: isRTL ? 'right' : 'left', paddingBottom: '8px' }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '22px', color: '#F0B429', lineHeight: 1, display: 'block' }}>
                      {entry.year}
                    </span>
                    <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#fff', margin: '6px 0 4px' }}>
                      {entry.title}
                    </div>
                    <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
                      {entry.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Team section ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <h2
                data-aos="fade-up"
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '8px' }}
              >
                {t('team_title')}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.55)' }}>
                {t('team_sub')}
              </p>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-3"
              style={{ gap: '24px' }}
            >
              {[
                {
                  initials: t('member1_initials'),
                  name: t('member1_name'),
                  role: t('member1_role'),
                  note: t('member1_note'),
                },
                {
                  initials: t('member2_initials'),
                  name: t('member2_name'),
                  role: t('member2_role'),
                  note: t('member2_note'),
                },
                {
                  initials: t('member3_initials'),
                  name: t('member3_name'),
                  role: t('member3_role'),
                  note: t('member3_note'),
                },
              ].map((member, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 100)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
                      border: '2px solid rgba(240,180,41,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 700,
                      fontSize: '16px',
                      color: '#F0B429',
                    }}
                  >
                    {member.initials}
                  </div>
                  <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#FFFFFF', marginBottom: '4px' }}>
                    {member.name}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600, marginBottom: '8px' }}>
                    {member.role}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    {member.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Follow the team (social) ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '880px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr', textAlign: 'center' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '24px' }}
            >
              {locale === 'ar' ? 'تابع فريق MAGHAREBIT' : locale === 'en' ? 'Follow the MAGHAREBIT team' : "Suivez l'équipe MAGHAREBIT"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '16px' }}>
              {([
                {
                  bg: '#0A66C2',
                  emoji: 'in',
                  href: 'https://www.linkedin.com/in/magharebit-team-15a025414/',
                  name: 'LinkedIn',
                  tagline: { ar: 'أخبار المنتج والفريق', fr: 'Actualités produit et équipe', en: 'Product and team updates' },
                },
                {
                  bg: '#FF0000',
                  emoji: '▶',
                  href: 'https://www.youtube.com/channel/UCsFWs7PYax6j70XYrJYKjUg',
                  name: 'YouTube',
                  tagline: { ar: 'دروس وعروض وشهادات', fr: 'Tutoriels, démos, témoignages', en: 'Tutorials, demos, testimonials' },
                },
                {
                  bg: '#1877F2',
                  emoji: 'f',
                  href: 'https://www.facebook.com/profile.php?id=61590535894132',
                  name: 'Facebook',
                  tagline: { ar: 'مجتمع التجار', fr: 'Communauté des marchands', en: 'Merchant community' },
                },
              ] as const).map((card, i) => (
                <a
                  key={card.name}
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    textDecoration: 'none',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      background: card.bg,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '20px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      flexShrink: 0,
                    }}
                  >
                    {card.emoji}
                  </div>
                  <div>
                    <div style={{ fontFamily: fontBody, fontWeight: 600, color: '#fff', fontSize: '14px' }}>{card.name}</div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                      {card.tagline[locale as 'ar' | 'fr' | 'en']}
                    </div>
                    <div style={{ fontFamily: fontBody, fontSize: '12px', color: '#F0B429', marginTop: '6px', fontWeight: 600 }}>
                      {locale === 'ar' ? 'متابعة ←' : locale === 'en' ? 'Follow →' : 'Suivre →'}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── Newsletter ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <NewsletterSignup />
          </div>
        </section>

        {/* ── Values (3 cards) ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '48px', direction: isRTL ? 'rtl' : 'ltr' }}
            >
              {t('values_title')}
            </h2>

            <div
              className="grid grid-cols-1 md:grid-cols-3"
              style={{ gap: '24px' }}
            >
              {values.map((val, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 100)}
                  className="card-feature-hover"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <div style={{ fontSize: '40px', lineHeight: 1 }}>{val.emoji}</div>
                  <div
                    style={{ fontFamily: fontBody, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}
                  >
                    {val.title}
                  </div>
                  <div
                    style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.65 }}
                  >
                    {val.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section
          style={{
            padding: '60px 24px 100px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            <Link
              href={`/${locale}/demo`}
              style={{
                display: 'inline-flex',
                fontFamily: fontBody,
                fontWeight: 700,
                fontSize: '16px',
                color: '#0A2318',
                background: '#F0B429',
                borderRadius: '999px',
                padding: '14px 40px',
                textDecoration: 'none',
                boxShadow: '0 6px 24px rgba(240,180,41,0.4)',
              }}
            >
              {t('cta')}
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
