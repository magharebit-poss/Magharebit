'use client';

import { useState, useEffect } from 'react';

interface LiveClockProps {
  locale?: string;
}

export default function LiveClock({ locale = 'ar' }: LiveClockProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  useEffect(() => {
    // Defer initial state update to avoid synchronous setState in effect body
    const init = setTimeout(() => setNow(new Date()), 0);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    const updateTimer = setInterval(
      () => setLastUpdated((prev) => prev + 1),
      60_000
    );
    return () => {
      clearTimeout(init);
      clearInterval(clockTimer);
      clearInterval(updateTimer);
    };
  }, []);

  if (!now) {
    return <div style={{ height: '48px', minWidth: '160px' }} />;
  }

  const timeStr = now.toLocaleTimeString(
    locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-GB',
    { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
  );

  const dateStr = now.toLocaleDateString(
    locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-GB',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  const updatedLabel =
    locale === 'ar'
      ? lastUpdated === 0
        ? 'آخر تحديث: الآن'
        : `آخر تحديث: منذ ${lastUpdated} دقيقة`
      : locale === 'fr'
      ? lastUpdated === 0
        ? 'Dernière mise à jour : maintenant'
        : `Dernière mise à jour : il y a ${lastUpdated} min`
      : lastUpdated === 0
      ? 'Last updated: just now'
      : `Last updated: ${lastUpdated} min ago`;

  return (
    <div style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}>
      <div
        style={{
          fontSize: '26px',
          fontWeight: 800,
          color: '#0F3D2A',
          fontFamily: 'Inter, monospace',
          lineHeight: 1.1,
          letterSpacing: '0.04em',
        }}
      >
        {timeStr}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: '#6B7280',
          marginTop: '2px',
          fontFamily:
            locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
        }}
      >
        {dateStr}
      </div>
      <div
        style={{
          fontSize: '11px',
          color: '#9CA3AF',
          marginTop: '4px',
          fontFamily:
            locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
        }}
      >
        🔄 {updatedLabel}
      </div>
    </div>
  );
}
