'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Lead capture modal: benefits on the start side (Deep Forest), the form on the end side (Pine Green).
 * Both sides are the dark shell, so the fields use .field-dark (globals.css) for the select popup and autofill.
 * Stacks on phones. Native <dialog>: focus trap, Esc and the backdrop come from the browser.
 * Posts to /api/leads (validated and rate limited server-side).
 */

const TYPES = ['cafe', 'restaurant', 'bakery', 'grocery', 'vegetables', 'general', 'other'] as const;

/** Accepts 06 12 34 56 78, 06.12.34.56.78, +212 6 12 34 56 78, 00212612345678. Returns 0XXXXXXXXX or null. */
export function normalizeMoroccanMobile(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+212')) d = '0' + d.slice(4);
  else if (d.startsWith('00212')) d = '0' + d.slice(5);
  else if (d.startsWith('212') && d.length === 12) d = '0' + d.slice(3);
  return /^0[5-7]\d{8}$/.test(d) ? d : null;
}

function Icon({ name }: { name: 'offline' | 'chat' | 'pin' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
  if (name === 'offline')
    return (<svg {...common}><path d="M2 8.8a15 15 0 0 1 20 0" /><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="19.2" r="1" fill="currentColor" /></svg>);
  if (name === 'chat')
    return (<svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 10.5h7M8.5 13.5h4.5" /></svg>);
  return (<svg {...common}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
}

export default function LeadModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('lead_modal');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [store, setStore] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'store' | 'phone' | 'type', string>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Plus Jakarta Sans, system-ui, sans-serif';

  // Open as a modal on mount; report every kind of close (Esc, backdrop, button) once.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    return () => { document.documentElement.style.overflow = ''; };
  }, []);

  // The dialog's own 'close' event (Esc, this call) reports to the host exactly once.
  const close = useCallback(() => { dialogRef.current?.close(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const normalized = normalizeMoroccanMobile(phone);
    if (store.trim().length < 2) next.store = t('err_store');
    if (!normalized) next.phone = t('err_phone');
    if (!type) next.type = t('err_type');
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) {
      document.getElementById(next.store ? 'lm-store' : next.phone ? 'lm-phone' : 'lm-type')?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: store.trim(), phone: normalized, businessType: type, city: city.trim(), locale }),
      });
      if (res.ok) setDone(true);
      else setFormError(res.status === 429 ? t('err_rate') : t('err_generic'));
    } catch {
      setFormError(t('err_generic'));
    } finally {
      setBusy(false);
    }
  }

  const field =
    'field-dark w-full min-h-[48px] rounded-[10px] border bg-[#0A2318] px-4 text-[15px] placeholder:text-white/45 outline-none transition-shadow ' +
    'focus:border-[#F0B429] focus:shadow-[0_0_0_3px_rgba(240,180,41,0.35)]';
  const bad = 'border-[#FCA5A5]';
  const ok = 'border-white/20 hover:border-white/35';
  const label = 'mb-1.5 block text-[13.5px] font-bold text-white/90';
  const errText = 'mt-1 text-[12.5px] font-semibold text-[#FCA5A5]';

  const benefits = [
    { icon: 'offline' as const, title: t('b1_t'), desc: t('b1_d') },
    { icon: 'chat' as const, title: t('b2_t'), desc: t('b2_d') },
    { icon: 'pin' as const, title: t('b3_t'), desc: t('b3_d') },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="lead-modal-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) close(); }}
      className="m-auto w-[min(960px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] overflow-hidden rounded-[20px] border-0 bg-transparent p-0 backdrop:bg-[#0A2318]/70 backdrop:backdrop-blur-[3px]"
      style={{ direction: isRTL ? 'rtl' : 'ltr', fontFamily: fontBody }}
    >
      <div className="relative grid max-h-[calc(100dvh-24px)] grid-cols-1 overflow-y-auto rounded-[20px] border border-white/10 bg-[#0F3D2A] shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:grid-cols-[1fr_1fr] md:overflow-hidden">
        <button
          type="button"
          onClick={close}
          aria-label={t('close')}
          className="absolute end-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>

        {/* Benefits: Pine Green */}
        <div className="relative overflow-hidden bg-[#0A2318] px-6 pb-5 pt-6 text-white md:px-10 md:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: '#F0B429',
              WebkitMaskImage: "url('/brand/zellige-pattern.svg')",
              maskImage: "url('/brand/zellige-pattern.svg')",
              WebkitMaskSize: '368px 506.7px',
              maskSize: '368px 506.7px',
              opacity: 0.05,
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -end-24 h-72 w-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(240,180,41,0.18), transparent 70%)' }} />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F0B429]/35 bg-[#F0B429]/12 px-4 py-1.5 text-[12px] font-bold tracking-wide text-[#F0B429]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F0B429]" />
              {t('badge')}
            </span>
            <h2 id="lead-modal-title" className="mt-4 text-[22px] font-extrabold leading-[1.25] md:mt-5 md:text-[34px]">
              {t('title_a')} <span className="text-[#F0B429]">{t('title_b')}</span>
            </h2>
            <p className="mt-3 text-[15px] leading-[1.8] text-white/70 max-md:hidden">{t('sub')}</p>

            <ul className="mt-6 space-y-4 max-md:hidden">
              {benefits.map((b) => (
                <li key={b.title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-white/10 bg-[#0F3D2A] text-[#F0B429]">
                    <Icon name={b.icon} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold">{b.title}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-[1.7] text-white/65">{b.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* Phones: titles only, so the form stays above the fold */}
            <ul className="mt-4 flex flex-wrap gap-1.5 md:hidden">
              {benefits.map((b) => (
                <li key={b.title} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#0F3D2A] px-2.5 py-1 text-[11.5px] font-semibold text-white/90">
                  <span className="text-[#F0B429]"><Icon name={b.icon} /></span>
                  {b.title}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[12.5px] font-semibold text-white/55 max-md:hidden">{t('trust')}</p>
          </div>
        </div>

        {/* Form: Pine Green */}
        <div className="bg-[#0F3D2A] px-6 py-6 text-white md:px-10 md:py-12">
          {done ? (
            <div role="status" className="grid h-full content-center justify-items-center py-10 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#0A2318] text-[#F0B429]">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7.5" /></svg>
              </span>
              <h3 className="mt-5 text-[22px] font-extrabold text-white">{t('success_title')}</h3>
              <p className="mt-2 max-w-[340px] text-[15px] leading-[1.8] text-white/75">{t('success_sub')}</p>
              <a
                href={`/${locale}/auth/signup`}
                className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-[#F0B429] px-7 text-[15px] font-bold text-[#0A2318] shadow-[0_6px_20px_rgba(240,180,41,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('success_cta')}
              </a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h3 className="text-[22px] font-extrabold text-white md:text-[26px]">{t('form_title')}</h3>
              <p className="mt-1 text-[14px] text-white/65">{t('form_sub')}</p>

              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="lm-store" className={label}>{t('store')}</label>
                  <input
                    ref={firstFieldRef} id="lm-store" autoComplete="organization" value={store} maxLength={100}
                    onChange={(e) => setStore(e.target.value)} placeholder={t('store_ph')}
                    aria-invalid={!!errors.store} aria-describedby={errors.store ? 'lm-store-err' : undefined}
                    className={`${field} text-white ${errors.store ? bad : ok}`}
                  />
                  {errors.store && <p id="lm-store-err" className={errText}>{errors.store}</p>}
                </div>

                <div>
                  <label htmlFor="lm-phone" className={label}>{t('phone')}</label>
                  <input
                    id="lm-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} maxLength={20}
                    onChange={(e) => setPhone(e.target.value)} placeholder={t('phone_ph')}
                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                    aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'lm-phone-err' : undefined}
                    className={`${field} text-white ${errors.phone ? bad : ok}`}
                  />
                  {errors.phone && <p id="lm-phone-err" className={errText}>{errors.phone}</p>}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="lm-type" className={label}>{t('type')}</label>
                    <select
                      id="lm-type" value={type} onChange={(e) => setType(e.target.value)}
                      aria-invalid={!!errors.type} aria-describedby={errors.type ? 'lm-type-err' : undefined}
                      className={`${field} ${errors.type ? bad : ok} ${type ? 'text-white' : 'text-white/45'}`}
                    >
                      <option value="">{t('type_ph')}</option>
                      {TYPES.map((k) => <option key={k} value={k}>{t(`t_${k}`)}</option>)}
                    </select>
                    {errors.type && <p id="lm-type-err" className={errText}>{errors.type}</p>}
                  </div>
                  <div>
                    <label htmlFor="lm-city" className={label}>
                      {t('city')} <span className="font-medium text-white/50">({t('optional')})</span>
                    </label>
                    <input
                      id="lm-city" autoComplete="address-level2" value={city} maxLength={100}
                      onChange={(e) => setCity(e.target.value)} placeholder={t('city_ph')}
                      className={`${field} text-white ${ok}`}
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <p role="alert" className="mt-4 rounded-[10px] border border-[#FCA5A5]/40 bg-[#D32F2F]/15 px-4 py-3 text-[13.5px] font-semibold text-[#FCA5A5]">{formError}</p>
              )}

              <button
                type="submit" disabled={busy}
                className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#F0B429] px-6 text-[16px] font-bold text-[#0A2318] shadow-[0_6px_20px_rgba(240,180,41,0.4)] transition-[filter] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70"
              >
                {busy ? t('submitting') : t('submit')}
              </button>
              <p className="mt-4 text-[12px] leading-[1.7] text-white/60">
                {t('privacy')}{' '}
                <a href={`/${locale}/privacy`} className="font-semibold text-[#F0B429] underline underline-offset-2">{t('privacy_link')}</a>
              </p>
              <p className="mt-3 text-[12.5px] font-semibold text-white/60 md:hidden">{t('trust')}</p>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
