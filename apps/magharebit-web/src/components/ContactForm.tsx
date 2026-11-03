'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLang } from '@/components/landing/useLang';
import { BRAND } from '@/lib/brand';

const TYPES = ['vegetables', 'cafe', 'restaurant', 'bakery', 'general', 'multi', 'other'] as const;
const FIELD =
  'min-h-[48px] w-full rounded-[10px] border border-[#D1D5DB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#0F3D2A] focus-visible:ring-2 focus-visible:ring-[#B8860B]/40 aria-[invalid=true]:border-[#D32F2F]';

/** Lead form for /contact. Same payload and server-side validation as every other lead form (POST /api/leads). */
export default function ContactForm() {
  const t = useTranslations('contact_page');
  const { locale } = useLang();
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<{ field?: 'name' | 'phone' | 'city'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    // Same rules as the server (src/lib/lead-input.ts); the server stays the authority
    if (storeName.trim().length < 2) return setError({ field: 'name', text: t('err_name') });
    if (!/^0[5-7]\d{8}$/.test(phone.replace(/\s/g, ''))) return setError({ field: 'phone', text: t('err_phone') });
    setSending(true); setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, phone, businessType, city, locale }),
      });
      if (res.ok) { setDone(true); return; }
      if (res.status === 429) return setError({ text: t('err_rate') });
      const msg = String((await res.json().catch(() => ({})))?.error ?? '');
      if (res.status === 400 && /^storeName/.test(msg)) return setError({ field: 'name', text: t('err_name') });
      if (res.status === 400 && /^phone/.test(msg)) return setError({ field: 'phone', text: t('err_phone') });
      if (res.status === 400 && /^city/.test(msg)) return setError({ field: 'city', text: t('err_city') });
      setError({ text: t('err_generic') });
    } catch {
      setError({ text: t('err_generic') });
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF6] p-8 text-center" data-testid="contact-success">
        <span aria-hidden="true" className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0F3D2A] text-[#F0B429]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </span>
        <h3 className="mt-4 text-xl font-bold text-[#0F3D2A]">{t('success_title')}</h3>
        <p className="mt-2 text-[#374151]">{t('success_text')}</p>
        <a href={BRAND.contact.waLink} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#25D366] px-6 font-bold text-white hover:bg-[#1EBE5A]">
          {t('wa_button')}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="contact-form">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#374151]">{t('store_name')} *</span>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={t('store_placeholder')} maxLength={100} autoComplete="organization" aria-invalid={error?.field === 'name'} className={FIELD} data-testid="contact-store" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[#374151]">{t('phone')} *</span>
        <input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" autoComplete="tel" aria-invalid={error?.field === 'phone'} className={`${FIELD} text-start`} data-testid="contact-phone" />
        <span className="mt-1 block text-xs text-[#6B7280]">{t('phone_hint')}</span>
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#374151]">{t('business_type')}</span>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={FIELD} data-testid="contact-type">
            <option value="">{t('business_placeholder')}</option>
            {TYPES.map((k) => <option key={k} value={k}>{t(`type_${k}`)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#374151]">{t('city')} <span className="font-normal text-[#9CA3AF]">({t('city_optional')})</span></span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('city_placeholder')} maxLength={100} autoComplete="address-level2" aria-invalid={error?.field === 'city'} className={FIELD} data-testid="contact-city" />
        </label>
      </div>
      {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]" data-testid="contact-error">{error.text}</p>}
      <button type="submit" aria-disabled={sending} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#0F3D2A] px-6 text-base font-bold text-white transition-colors hover:bg-[#145236] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B] aria-disabled:cursor-not-allowed aria-disabled:opacity-60" data-testid="contact-submit">
        {sending ? t('sending') : t('submit')}
      </button>
      <p className="text-center text-xs text-[#6B7280]">
        {t('privacy')} <Link href={`/${locale}/privacy`} className="font-semibold text-[#0F3D2A] underline">{t('privacy_link')}</Link>
      </p>
    </form>
  );
}
