'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';

function isMoroccoBusinessHours(): boolean {
  // Africa/Casablanca: UTC+1 most of the year (DST observance varies; UTC+1 is a fair
  // approximation that keeps the indicator close to actual availability)
  const now = new Date();
  const moroccoHour = (now.getUTCHours() + 1) % 24;
  const day = now.getUTCDay(); // 0=Sunday, 6=Saturday

  // Business hours: Monday-Saturday, 9h00-19h00 Morocco time
  const isWeekday = day >= 1 && day <= 6;
  const isBusinessHour = moroccoHour >= 9 && moroccoHour < 19;

  return isWeekday && isBusinessHour;
}

const LABELS = {
  available: {
    ar: 'متاحون الآن — نرد خلال دقائق',
    fr: 'Disponibles maintenant — réponse en quelques minutes',
    en: 'Available now — we reply in minutes',
  },
  unavailable: {
    ar: 'نعود غداً الساعة 9 صباحاً — اترك رسالتك',
    fr: 'Nous revenons demain à 9h — laissez votre message',
    en: 'Back tomorrow at 9am — leave your message',
  },
} as const;

export default function AvailabilityIndicator() {
  const locale = useLocale();
  // `null` means "not yet hydrated" — render nothing then to avoid SSR/CSR mismatch.
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Initial check happens once after mount; interval keeps it fresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot hydration
    setAvailable(isMoroccoBusinessHours());
    const interval = setInterval(() => {
      setAvailable(isMoroccoBusinessHours());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (available === null) return null;

  const set = available ? LABELS.available : LABELS.unavailable;
  const label = set[locale as 'ar' | 'fr' | 'en'] ?? set.fr;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: available ? '#86EFAC' : 'rgba(255,255,255,0.55)',
        fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
      }}
      aria-live="polite"
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: available ? '#22C55E' : 'rgba(255,255,255,0.30)',
          boxShadow: available ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}
