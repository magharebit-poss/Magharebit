import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import VideoSection from '@/components/landing/VideoSection';
import { breadcrumbSchema } from '@/lib/schemas';
import { HREFLANG, SITE_URL, ogBase, pageAlternates, type SiteLocale } from '@/lib/seo';

const PATH = '/about';
const asLocale = (l: string): SiteLocale => (l === 'ar' || l === 'fr' || l === 'en' ? l : 'ar');

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const title = t('meta_title');
  const description = t('meta_desc');
  // Share card rendered by src/app/[locale]/opengraph-image.tsx. Declared explicitly: a page that defines its own
  // openGraph/twitter blocks does not reliably get the file-based image merged in.
  const image = { url: `/${asLocale(locale)}/opengraph-image`, width: 1200, height: 630, alt: t('og_alt'), type: 'image/png' };
  return {
    // absolute: the brand is already in the title, no template suffix
    title: { absolute: title },
    description,
    alternates: pageAlternates(locale, PATH),
    openGraph: { ...ogBase(locale), url: `/${asLocale(locale)}${PATH}`, title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

/** Breadcrumb + an AboutPage node that points at the Organization and SoftwareApplication of the site-wide graph
 *  (src/lib/schemas.ts siteGraph, emitted by the layout on every page) instead of declaring them a second time. */
function aboutJsonLd(locale: SiteLocale, title: string, description: string, home: string) {
  const url = `${SITE_URL}/${locale}${PATH}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: HREFLANG[locale],
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      mainEntity: { '@id': `${SITE_URL}/#organization` },
      mentions: { '@id': `${SITE_URL}/#software` },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/media/a1-hero.webp` },
    },
    breadcrumbSchema(locale, [[home, ''], [title.split('|')[0].trim(), PATH]]),
  ];
}

// ── Decorative pieces (aria-hidden) ──────────────────────────────────────────

/** Eight-point star (khatam), the motif behind the zellige pattern. */
function Khatam({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" />
    </svg>
  );
}

/** A thin band of the brand zellige pattern, used as a section border. */
function ZelligeBand({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-3 w-full bg-[#F0B429] opacity-25 [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:92px_126.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:92px_126.7px] ${className}`}
    />
  );
}

function Kicker({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={`mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] ${dark ? 'text-[#F0B429]' : 'text-[#B8860B]'}`}>
      <Khatam className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

const FACT_ICONS = [
  'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.8M12 20h.01',
  'M3 5h12M9 3v2c0 4.4-2.7 8.2-6 10M5 9c1.6 2.3 4.2 4.2 7 5M12 21l5-11 5 11M13.5 18h7',
  'M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z',
];
const TRUST_ICONS = [
  'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  'M2 7h20v12H2zM2 11h20M6 15h4',
  'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 14h6M9 17h3',
];

function Icon({ d, className = 'h-6 w-6' }: { d: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = asLocale(raw);
  const t = await getTranslations('about');
  const isRTL = locale === 'ar';
  const body = isRTL ? 'font-arabic' : 'font-sans';
  const display = isRTL ? 'font-arabic' : 'font-display';

  const facts = [1, 2, 3, 4].map((i) => ({ value: t(`fact${i}_value`), label: t(`fact${i}_label`), desc: t(`fact${i}_desc`), icon: FACT_ICONS[i - 1] }));
  const trust = [1, 2, 3].map((i) => ({ title: t(`trust${i}_title`), desc: t(`trust${i}_desc`), icon: TRUST_ICONS[i - 1] }));
  const timeline = [1, 2, 3].map((i) => ({ year: t(`yr${i}`), title: t(`story${i}_title`), text: t(`story${i}_text`) }));
  const values = [1, 2, 3].map((i) => ({ title: t(`val${i}_title`), desc: t(`val${i}_desc`) }));
  const team = [1, 2, 3].map((i) => ({ initials: t(`member${i}_initials`), name: t(`member${i}_name`), role: t(`member${i}_role`), note: t(`member${i}_note`) }));
  const jsonLd = aboutJsonLd(locale, t('meta_title'), t('meta_desc'), t('breadcrumb_home'));

  const ctas = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href={`/${locale}/auth/signup`}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#F0B429] px-7 text-base font-bold text-[#0A2318] shadow-[0_10px_30px_rgba(240,180,41,0.25)] transition-colors hover:bg-[#F5C451] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]"
        data-testid="about-cta-trial"
      >
        {t('cta_trial')}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
      <Link
        href={`/${locale}/contact`}
        className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:border-[#F0B429] hover:text-[#F0B429] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]"
        data-testid="about-cta-demo"
      >
        {t('cta_demo')}
      </Link>
    </div>
  );

  return (
    <>
      {jsonLd.map((node, i) => (
        // JSON-LD from our own static copy; "<" is escaped so no string can ever close the script element
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }} />
      ))}
      <Navbar />
      <main dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className={`${body} bg-[#0A2318]`} data-testid="about-page">

        {/* ── Hero: dark shell, zellige behind the content only ── */}
        <section className="relative overflow-hidden px-6 pb-20 pt-32 sm:pb-24 sm:pt-40" aria-labelledby="about-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-[0.05] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(240,180,41,0.12),transparent_70%)]" />
          <div className="relative mx-auto max-w-[860px] text-center">
            <Kicker dark>{t('hero_kicker')}</Kicker>
            <h1 id="about-title" className={`${display} text-balance text-[clamp(2rem,5.2vw,3.5rem)] font-extrabold leading-[1.12] text-white`}>
              {t('hero_title')}
            </h1>
            <p className="mx-auto mt-6 max-w-[680px] text-lg leading-[1.8] text-white/70">{t('hero_sub')}</p>
            <div className="mt-10 flex justify-center">{ctas}</div>
          </div>
        </section>
        <ZelligeBand />

        {/* ── Story + photo ── */}
        <section className="bg-[#F8F9FA] px-6 py-20 sm:py-28" aria-labelledby="about-story">
          <div className="mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Kicker>{t('story_kicker')}</Kicker>
              <h2 id="about-story" className={`${display} text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight text-[#111827]`}>{t('story_heading')}</h2>
              <div className="mt-6 space-y-5 text-[17px] leading-[1.85] text-[#374151]">
                <p>{t('story_p1')}</p>
                <p>{t('story_p2')}</p>
                <p className="font-medium text-[#111827]">{t('story_p3')}</p>
              </div>
              <p className="mt-8 border-s-4 border-[#B8860B] ps-4 text-sm font-semibold text-[#6B7280]">{t('story_signature')}</p>
            </div>
            <figure className="relative">
              <div aria-hidden="true" className="absolute -inset-3 rounded-[28px] border border-[#B8860B]/30" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#0F3D2A] shadow-[0_30px_70px_rgba(10,35,24,0.25)]">
                <Image
                  src="/media/a1-hero.webp"
                  alt={t('story_img_alt')}
                  fill
                  sizes="(min-width: 1100px) 520px, (min-width: 1024px) 45vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <Khatam className="absolute -bottom-5 end-8 h-10 w-10 text-[#B8860B]" />
            </figure>
          </div>
        </section>

        {/* ── Facts (verifiable product facts, not invented counters) ── */}
        <section className="bg-white px-6 py-20 sm:py-24" aria-labelledby="about-facts">
          <div className="mx-auto max-w-[1100px]">
            <div className="mx-auto max-w-[640px] text-center">
              <Kicker>{t('facts_kicker')}</Kicker>
              <h2 id="about-facts" className={`${display} text-[clamp(1.5rem,3vw,2.1rem)] font-bold text-[#111827]`}>{t('facts_heading')}</h2>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {facts.map((f) => (
                <li key={f.label} className="group rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-6 transition-colors hover:border-[#B8860B]/50" data-testid="about-fact">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0F3D2A] text-[#F0B429]"><Icon d={f.icon} /></span>
                  <p className="mt-5 font-display text-2xl font-extrabold text-[#0F3D2A]" dir={/^[A-Z ·]+$/.test(f.value) ? 'ltr' : undefined}>{f.value}</p>
                  <p className="mt-1 font-semibold text-[#111827]">{f.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{f.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Trust / Law 09-08 ── */}
        <section className="relative overflow-hidden bg-[#0F3D2A] px-6 py-20 sm:py-24" aria-labelledby="about-trust">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-[0.04] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
          <div className="relative mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
            <div>
              <Kicker dark>{t('trust_kicker')}</Kicker>
              <h2 id="about-trust" className={`${display} text-[clamp(1.5rem,3vw,2.2rem)] font-bold text-white`}>{t('trust_heading')}</h2>
              <p className="mt-5 text-base leading-[1.8] text-white/70">{t('trust_sub')}</p>
            </div>
            <ul className="grid gap-4">
              {trust.map((x) => (
                <li key={x.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F0B429]/15 text-[#F0B429]"><Icon d={x.icon} className="h-5 w-5" /></span>
                  <span>
                    <span className="block font-semibold text-white">{x.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-white/65">{x.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Milestones + values ── */}
        <section className="bg-[#F8F9FA] px-6 py-20 sm:py-24" aria-labelledby="about-timeline">
          <div className="mx-auto max-w-[1100px]">
            <div className="text-center">
              <Kicker>{t('story_kicker')}</Kicker>
              <h2 id="about-timeline" className={`${display} text-[clamp(1.5rem,3vw,2.1rem)] font-bold text-[#111827]`}>{t('timeline_heading')}</h2>
            </div>
            <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              <span aria-hidden="true" className="absolute inset-x-[16%] top-[13px] hidden border-t-2 border-dashed border-[#B8860B]/40 md:block" />
              {timeline.map((e) => (
                <li key={e.year} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
                  <span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F0B429] text-[#0A2318] shadow-[0_0_0_6px_#F8F9FA]"><Khatam className="h-3.5 w-3.5" /></span>
                  <span>
                    <span className="block font-display text-2xl font-extrabold text-[#B8860B]">{e.year}</span>
                    <span className="mt-1 block font-semibold text-[#111827]">{e.title}</span>
                    <span className="mt-2 block max-w-[300px] text-sm leading-relaxed text-[#6B7280]">{e.text}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-20 grid gap-5 md:grid-cols-3">
              <h3 className={`${display} md:col-span-3 text-xl font-bold text-[#111827]`}>{t('values_title')}</h3>
              {values.map((v) => (
                <div key={v.title} className="rounded-2xl border-s-4 border-[#0F3D2A] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <p className="font-semibold text-[#111827]">{v.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Video showcase (NEXT_PUBLIC_DEMO_VIDEO_URL, poster + click-to-play modal) ── */}
        <VideoSection />

        {/* ── Team ── */}
        <section className="bg-white px-6 py-20 sm:py-24" aria-labelledby="about-team">
          <div className="mx-auto max-w-[1100px]">
            <div className="text-center">
              <h2 id="about-team" className={`${display} text-[clamp(1.5rem,3vw,2.1rem)] font-bold text-[#111827]`}>{t('team_title')}</h2>
              <p className="mt-3 text-[#6B7280]">{t('team_sub')}</p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-3">
              {team.map((m) => (
                <li key={m.name} className="rounded-2xl border border-[#E5E7EB] p-6 text-center">
                  <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#0F3D2A] font-display text-lg font-bold text-[#F0B429]" dir="ltr">{m.initials}</span>
                  <p className="mt-4 font-semibold text-[#111827]">{m.name}</p>
                  <p className="text-sm font-medium text-[#B8860B]">{m.role}</p>
                  <p className="mt-2 text-sm text-[#6B7280]">{m.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Conversion block ── */}
        <section className="relative overflow-hidden px-6 py-20 sm:py-28" aria-labelledby="about-cta">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_50%_100%,rgba(240,180,41,0.16),transparent_70%)]" />
          <div className="relative mx-auto max-w-[760px] rounded-[28px] border border-[#F0B429]/30 bg-[#0F3D2A] px-6 py-14 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:px-12">
            <Khatam className="mx-auto mb-5 h-8 w-8 text-[#F0B429]" />
            <h2 id="about-cta" className={`${display} text-[clamp(1.6rem,3.6vw,2.4rem)] font-bold text-white`}>{t('cta_heading')}</h2>
            <p className="mx-auto mt-4 max-w-[520px] text-white/70">{t('cta_sub')}</p>
            <div className="mt-8 flex justify-center">{ctas}</div>
            <p className="mt-6 text-sm text-white/50">{t('cta_note')}</p>
          </div>
        </section>
        <ZelligeBand />
      </main>
      <Footer />
    </>
  );
}
