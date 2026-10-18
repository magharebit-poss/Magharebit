'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useTransition } from 'react';

const locales = [
  { code: 'ar', label: 'AR' },
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    const segments = pathname.split('/');
    segments[1] = next;
    startTransition(() => {
      router.replace(segments.join('/'));
    });
  }

  return (
    <div className="flex gap-[2px] bg-white/10 rounded-full p-[3px]">
      {locales.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider transition-all duration-150 font-display ${
            locale === code
              ? 'bg-gold-400 text-brand-950'
              : 'text-white/60 hover:text-white bg-transparent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
