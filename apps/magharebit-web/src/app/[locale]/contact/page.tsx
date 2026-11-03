import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import ContactForm from '@/components/ContactForm';
import { BRAND } from '@/lib/brand';
import { breadcrumbSchema } from '@/lib/schemas';
import { HREFLANG, SITE_URL, ogBase, pageAlternates, type SiteLocale } from '@/lib/seo';

const PATH = '/contact';
const asLocale = (l: string): SiteLocale => (l === 'ar' || l === 'fr' || l === 'en' ? l : 'ar');

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact_page');
  const title = t('meta_title');
  const description = t('meta_desc');
  const image = { url: `/${asLocale(locale)}/opengraph-image`, width: 1200, height: 630, alt: title, type: 'image/png' };
  return {
    title: { absolute: title },
    description,
    alternates: pageAlternates(locale, PATH),
    openGraph: { ...ogBase(locale), url: `/${asLocale(locale)}${PATH}`, title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  setRequestLocale(raw);
  const locale = asLocale(raw);
  const t = await getTranslations('contact_page');
  const tAbout = await getTranslations('about');
  const isRTL = locale === 'ar';
  const display = isRTL ? 'font-arabic' : 'font-display';
  const url = `${SITE_URL}/${locale}${PATH}`;
  const waHref = `${BRAND.contact.waLink}?text=${encodeURIComponent(t('wa_prefill'))}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      '@id': `${url}#webpage`,
      url,
      name: t('meta_title'),
      description: t('meta_desc'),
      inLanguage: HREFLANG[locale],
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` },
      mainEntity: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: BRAND.contact.phoneE164,
        email: BRAND.contact.email,
        areaServed: 'MA',
        availableLanguage: ['Arabic', 'French', 'English'],
        hoursAvailable: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '09:00',
          closes: '19:00',
        },
      },
    },
    breadcrumbSchema(locale, [[tAbout('breadcrumb_home'), ''], [t('breadcrumb'), PATH]]),
  ];

  const info: Array<[string, string, string, React.ReactNode]> = [
    [t('phone_label'), 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z', 'phone',
      <a key="p" href={`tel:${BRAND.contact.phoneE164}`} dir="ltr" className="font-semibold text-[#0F3D2A] hover:underline">{BRAND.contact.whatsapp}</a>],
    [t('email_label'), 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6', 'email',
      <a key="e" href={`mailto:${BRAND.contact.email}`} dir="ltr" className="font-semibold text-[#0F3D2A] hover:underline">{BRAND.contact.email}</a>],
    [t('hours_label'), 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2', 'hours', <span key="h" className="text-[#374151]">{t('hours_value')}</span>],
    [t('where_label'), 'M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'where',
      <span key="w" className="text-[#374151]"><span className="block font-semibold text-[#111827]">{t('where_value')}</span><span className="mt-1 block text-sm text-[#6B7280]">{t('where_note')}</span></span>],
  ];

  return (
    <>
      {jsonLd.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }} />
      ))}
      <Navbar />
      <main dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className={`${isRTL ? 'font-arabic' : 'font-sans'} bg-[#0A2318]`} data-testid="contact-page">
        <section className="relative overflow-hidden px-6 pb-16 pt-32 sm:pt-40" aria-labelledby="contact-title">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-[0.05] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
          <div className="relative mx-auto max-w-[760px] text-center">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F0B429]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" /></svg>
              {t('kicker')}
            </p>
            <h1 id="contact-title" className={`${display} text-balance text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.12] text-white`}>{t('title')}</h1>
            <p className="mx-auto mt-5 max-w-[600px] text-lg leading-[1.8] text-white/70">{t('sub')}</p>
            <div className="mt-9 flex flex-col items-center gap-2">
              <a
                href={waHref} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-xl bg-[#25D366] px-8 text-lg font-bold text-white shadow-[0_12px_32px_rgba(37,211,102,0.3)] transition-colors hover:bg-[#1EBE5A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
                data-testid="contact-wa"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.1.1.7-.2 1.3z" /></svg>
                {t('wa_button')}
              </a>
              <span className="text-sm text-white/55">{t('wa_hint')}</span>
            </div>
          </div>
        </section>

        <section className="bg-[#F8F9FA] px-6 py-16 sm:py-20" aria-labelledby="contact-form-title">
          <div className="mx-auto grid max-w-[1000px] gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_50px_rgba(10,35,24,0.08)] sm:p-9">
              <h2 id="contact-form-title" className={`${display} text-2xl font-bold text-[#111827]`}>{t('form_title')}</h2>
              <p className="mb-7 mt-2 text-[#6B7280]">{t('form_sub')}</p>
              <ContactForm />
            </div>
            <aside className="rounded-3xl bg-[#0F3D2A] p-6 text-white sm:p-9" aria-labelledby="contact-info-title">
              <h2 id="contact-info-title" className={`${display} text-xl font-bold`}>{t('info_title')}</h2>
              <dl className="mt-6 space-y-6">
                {info.map(([label, icon, key, value]) => (
                  <div key={key} className="flex gap-4" data-testid={`contact-${key}`}>
                    <dt aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F0B429]/15 text-[#F0B429]"><Icon d={icon} /></dt>
                    <dd className="min-w-0 rounded-lg bg-white/95 px-4 py-3 text-sm leading-relaxed first:mt-0 grow">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</span>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
