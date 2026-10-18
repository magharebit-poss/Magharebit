'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import SocialLinks from '@/components/SocialLinks';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(' ');
}

export default function DemoForm() {
  const t = useTranslations('demo');
  const locale = useLocale();

  const [storeName, setStoreName]   = useState('');
  const [phone, setPhone]           = useState('');
  const [bizType, setBizType]       = useState('');
  const [city, setCity]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [errors, setErrors]         = useState<Record<string, boolean>>({});

  const inputClass = (field: string) =>
    `w-full px-4 py-3 bg-white/[0.06] border rounded-[10px] text-white font-arabic placeholder:text-white/35 outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(240,180,41,0.15)] ${
      errors[field]
        ? 'border-red-400 animate-[shake_0.4s_ease]'
        : 'border-white/[0.12] focus:border-gold-400'
    }`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};
    if (!storeName.trim()) newErrors.storeName = true;
    if (!phone.trim())     newErrors.phone     = true;
    if (!bizType)          newErrors.bizType   = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors({});
      requestAnimationFrame(() => setErrors(newErrors));
      return;
    }

    setSubmitting(true);
    try {
      // POST to both legacy endpoint and new leads store in parallel
      await Promise.allSettled([
        fetch('/api/demo-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeName, phone, businessType: bizType, city, locale }),
        }),
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeName, phone, businessType: bizType, city, locale }),
        }),
      ]);
    } catch {
      // silent — always succeed from lead's perspective
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  const bizTypes = [
    ['vegetables', t('type_vegetables')],
    ['cafe',       t('type_cafe')],
    ['restaurant', t('type_restaurant')],
    ['bakery',     t('type_bakery')],
    ['general',    t('type_general')],
    ['multi',      t('type_multi')],
    ['other',      t('type_other')],
  ];

  return (
    <section id="demo" className="bg-brand-900 py-20 px-6 relative overflow-hidden" style={{ background: '#0F3D2A' }}>

      {/* Radial shimmer */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(240,180,41,0.08) 0%, transparent 70%)' }}
      />

      <div data-aos="fade-up" className="max-w-[680px] mx-auto relative z-10 text-center" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>

        <span className="inline-block bg-gold-400/15 text-gold-400 font-display font-bold text-[11px] tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">
          {t('label')}
        </span>

        <h2
          className="font-arabic font-bold text-white leading-[1.5] mb-3"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
        >
          {t('heading')}
        </h2>

        <p className="font-arabic text-white/55 text-base leading-[1.9] mb-10">
          {t('sub')}
        </p>

        <div
          className={`bg-white/[0.04] border border-white/10 rounded-2xl p-8 md:p-10 backdrop-blur-sm ${locale === 'ar' ? 'text-right' : 'text-left'}`}
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
        >

          {submitted ? (
            <div style={{ padding: '24px 0' }}>
              <div style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.30)',
                borderRadius: '12px',
                padding: '16px 20px',
                color: '#FFFFFF',
                fontSize: '15px',
                textAlign: 'center',
                marginBottom: '24px',
                fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
              }}>
                {t('success')}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif', color: '#F0B429', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
                  {t('success_title')}
                </div>
                <div style={{ fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif', color: 'rgba(255,255,255,0.60)', fontSize: '14px', lineHeight: 1.7 }}>
                  {t('success_sub')}
                </div>
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <div style={{ fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif', fontSize: '14px', color: 'rgba(255,255,255,0.60)', marginBottom: '12px' }}>
                    {locale === 'ar' ? 'في انتظار مكالمتنا، تابعنا:' : locale === 'en' ? 'While waiting for our call, follow us:' : "En attendant notre appel, suivez-nous :"}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <SocialLinks size="md" variant="colored" platforms={['youtube', 'linkedin', 'facebook']} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="font-arabic text-sm font-semibold text-white/70 block mb-2">
                    {t('store_name')} *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t('store_placeholder')}
                    className={inputClass('storeName')}
                  />
                </div>

                <div>
                  <label className="font-arabic text-sm font-semibold text-white/70 block mb-2">
                    {t('phone')} *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder={t('phone_placeholder')}
                    dir="ltr"
                    style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
                    className={inputClass('phone')}
                  />
                </div>
              </div>

              <div className="mb-5">
                <label className="font-arabic text-sm font-semibold text-white/70 block mb-2">
                  {t('type')} *
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={bizType}
                    onChange={(e) => setBizType(e.target.value)}
                    className={inputClass('bizType')}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      paddingRight: locale === 'ar' ? '16px' : '40px',
                      paddingLeft: locale === 'ar' ? '40px' : '16px',
                    }}
                  >
                    <option value="" disabled>
                      {t('type_placeholder')}
                    </option>
                    {bizTypes.map(([val, label]) => (
                      <option key={val} value={val} style={{ background: '#0F3D2A', color: '#fff' }}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {/* Custom gold dropdown arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      ...(locale === 'ar' ? { left: '14px' } : { right: '14px' }),
                      pointerEvents: 'none',
                      color: '#F0B429',
                      fontSize: '10px',
                      lineHeight: 1,
                    }}
                  >
                    ▼
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="font-arabic text-sm font-semibold text-white/70 block mb-2">
                  {t('city')}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t('city_placeholder')}
                  className={inputClass('city')}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gold-400 text-brand-950 font-arabic font-bold rounded-full transition-all duration-200 hover:bg-gold-500 hover:-translate-y-0.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                style={{
                  fontSize: '16px',
                  padding: '14px 32px',
                  border: 'none',
                  boxShadow: '0 6px 24px rgba(240,180,41,0.35)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(240,180,41,0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(240,180,41,0.35)'; }}
              >
                {submitting ? t('submitting') : t('submit')}
              </button>

              <div className="flex flex-wrap gap-6 justify-center font-arabic text-white/55" style={{ marginTop: '12px', fontSize: '13px' }}>
                {(['trust1', 'trust2', 'trust3'] as const).map((k) => (
                  <span key={k}>
                    <span className="text-gold-400">✓ </span>
                    {t(k)}
                  </span>
                ))}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
