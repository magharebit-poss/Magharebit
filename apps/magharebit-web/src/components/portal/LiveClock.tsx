'use client';

import { useEffect, useState } from 'react';
import type { Lang } from '@/components/landing/useLang';

const LOCALE: Record<Lang, string> = { ar: 'ar-MA-u-nu-latn', fr: 'fr-MA', en: 'en-GB' };

/** Time and date of the merchant's device, ticking every second. Western digits in every language. */
export default function LiveClock({ lang }: { lang: Lang }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const init = setTimeout(() => setNow(new Date()), 0); // after hydration: server and client clocks differ
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => { clearTimeout(init); clearInterval(tick); };
  }, []);

  if (!now) return <div className="h-12 min-w-[160px]" aria-hidden="true" />;

  return (
    <div className="text-start" aria-hidden="true">
      <div className="font-mono text-2xl font-extrabold leading-none tracking-wide text-[#0F3D2A] tabular-nums" dir="ltr">
        {now.toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </div>
      <div className="mt-1 text-xs text-[#6B7280]">
        {now.toLocaleDateString(LOCALE[lang], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}
