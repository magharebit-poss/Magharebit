import type { Metadata } from 'next';
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { staticParams } from '@/lib/static-params';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import AOSInit from '@/components/AOSInit';
import { faqSchema } from '@/lib/schemas';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateStaticParams() {
  return staticParams(routing.locales.map((locale) => ({ locale })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('faq');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/faq`),
    openGraph: { ...ogBase(locale), title: t('meta_title'), description: t('meta_desc') },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('faq');
  const locale = (await getLocale()) as 'ar' | 'fr' | 'en';
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  // 5 categories × 4 questions each = 20 questions
  const categories = [
    {
      label: t('cat1'),
      items: [
        { q: t('q1'), a: t('a1') },
        { q: t('q2'), a: t('a2') },
        { q: t('q3'), a: t('a3') },
        { q: t('q4'), a: t('a4') },
      ],
    },
    {
      label: t('cat2'),
      items: [
        { q: t('q5'), a: t('a5') },
        { q: t('q6'), a: t('a6') },
        { q: t('q7'), a: t('a7') },
        { q: t('q8'), a: t('a8') },
      ],
    },
    {
      label: t('cat3'),
      items: [
        { q: t('q9'),  a: t('a9')  },
        { q: t('q10'), a: t('a10') },
        { q: t('q11'), a: t('a11') },
        { q: t('q12'), a: t('a12') },
      ],
    },
    {
      label: t('cat4'),
      items: [
        { q: t('q13'), a: t('a13') },
        { q: t('q14'), a: t('a14') },
        { q: t('q15'), a: t('a15') },
        { q: t('q16'), a: t('a16') },
      ],
    },
    {
      label: t('cat5'),
      items: [
        { q: t('q17'), a: t('a17') },
        { q: t('q18'), a: t('a18') },
        { q: t('q19'), a: t('a19') },
        { q: t('q20'), a: t('a20') },
      ],
    },
  ];

  // Flatten all Q&A for JSON-LD
  const allItems = categories.flatMap((cat) =>
    cat.items.map((item) => ({ question: item.q, answer: item.a }))
  );

  return (
    <>
      <AOSInit />
      <Navbar />

      {/* JSON-LD FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(allItems)) }}
      />

      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ paddingTop: '120px', paddingBottom: '64px', padding: '120px 24px 64px' }}>
          <div
            style={{
              maxWidth: '680px',
              margin: '0 auto',
              textAlign: 'center',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            <span
              className="badge-pill font-display"
              data-aos="fade-down"
            >
              FAQ
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{
                fontSize: 'clamp(2rem, 5vw, 2.8rem)',
                lineHeight: 1.15,
                marginBottom: '16px',
              }}
            >
              {t('hero_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="100"
              style={{
                fontFamily: fontBody,
                fontSize: '17px',
                color: 'rgba(255,255,255,0.60)',
                lineHeight: 1.7,
              }}
            >
              {t('hero_sub')}
            </p>
          </div>
        </section>

        {/* FAQ categories */}
        <section style={{ padding: '0 24px 100px' }}>
          <div
            style={{
              maxWidth: '820px',
              margin: '0 auto',
              direction: isRTL ? 'rtl' : 'ltr',
              display: 'flex',
              flexDirection: 'column',
              gap: '56px',
            }}
          >
            {categories.map((cat, ci) => (
              <div key={ci} data-aos="fade-up" data-aos-delay={String(ci * 80)}>
                {/* Category label */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '24px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(240,180,41,0.12)',
                      border: '1px solid rgba(240,180,41,0.25)',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#F0B429',
                      flexShrink: 0,
                    }}
                  >
                    {ci + 1}
                  </span>
                  <h2
                    style={{
                      fontFamily: 'Noto Naskh Arabic, Cairo, serif',
                      fontWeight: 700,
                      fontSize: 'clamp(1.1rem, 2.5vw, 1.35rem)',
                      color: '#F0B429',
                      margin: 0,
                    }}
                  >
                    {cat.label}
                  </h2>
                </div>

                {/* Items */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {cat.items.map((item, qi) => (
                    <details
                      key={qi}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}
                    >
                      <summary
                        style={{
                          padding: '18px 22px',
                          fontFamily: fontBody,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          listStyle: 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          userSelect: 'none',
                        }}
                      >
                        <span>{item.q}</span>
                        <span
                          style={{
                            flexShrink: 0,
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(240,180,41,0.1)',
                            border: '1px solid rgba(240,180,41,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#F0B429',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          +
                        </span>
                      </summary>
                      <div
                        style={{
                          padding: '0 22px 18px',
                          fontFamily: fontBody,
                          fontSize: '14px',
                          color: 'rgba(255,255,255,0.65)',
                          lineHeight: 1.75,
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          paddingTop: '16px',
                        }}
                      >
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA strip */}
        <section
          style={{
            padding: '0 24px 80px',
            textAlign: 'center',
          }}
        >
          <div
            data-aos="fade-up"
            style={{
              maxWidth: '500px',
              margin: '0 auto',
              background: 'rgba(240,180,41,0.06)',
              border: '1px solid rgba(240,180,41,0.18)',
              borderRadius: '20px',
              padding: '40px 32px',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            <p
              style={{
                fontFamily: fontBody,
                fontSize: '15px',
                color: 'rgba(255,255,255,0.70)',
                marginBottom: '20px',
                lineHeight: 1.6,
              }}
            >
              {locale === 'ar'
                ? 'لم تجد إجابة سؤالك؟ فريقنا جاهز للمساعدة.'
                : locale === 'fr'
                ? 'Vous ne trouvez pas votre réponse ? Notre équipe est là pour vous aider.'
                : "Didn't find your answer? Our team is ready to help."}
            </p>
            <a
              href={`/${locale}/demo`}
              style={{
                display: 'inline-flex',
                fontFamily: fontBody,
                fontWeight: 700,
                fontSize: '15px',
                color: '#0A2318',
                background: '#F0B429',
                borderRadius: '999px',
                padding: '12px 32px',
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(240,180,41,0.35)',
              }}
            >
              {locale === 'ar' ? 'تواصل معنا' : locale === 'fr' ? 'Nous contacter' : 'Contact us'}
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
