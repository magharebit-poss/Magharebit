'use client';

import { useId, useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

/** `dark` (default) sits on the dark pricing page; `light` on the white / green / gold home sections. */
type Tone = 'dark' | 'light';

const TONE: Record<Tone, { card: string; open: string; q: string; qOpen: string; icon: string; iconOpen: string; a: string; rule: string }> = {
  dark: {
    card: 'border-white/10 bg-white/[0.035]',
    open: 'border-[#F0B429]/35 bg-white/[0.055]',
    q: 'text-white',
    qOpen: 'text-[#F0B429]',
    icon: 'bg-white/10 text-white/75',
    iconOpen: 'bg-[#F0B429] text-[#0A2318]',
    a: 'text-white/80',
    rule: 'border-white/[0.06]',
  },
  light: {
    card: 'border-[#E5E7EB] bg-white hover:border-[#B8860B]/50',
    open: 'border-[#B8860B]/60 bg-white shadow-[0_12px_32px_rgba(10,35,24,0.08)]',
    q: 'text-[#111827]',
    qOpen: 'text-[#0F3D2A]',
    icon: 'bg-[#0F3D2A]/10 text-[#0F3D2A]',
    iconOpen: 'bg-[#F0B429] text-[#0A2318]',
    a: 'text-[#4B5563]',
    rule: 'border-[#F1F2F4]',
  },
};

export default function FaqAccordion({ items, isRTL, tone = 'dark' }: { items: FaqItem[]; isRTL: boolean; tone?: Tone }) {
  const [open, setOpen] = useState<number | null>(null);
  const uid = useId();
  const k = TONE[tone];
  const body = isRTL ? 'font-arabic' : 'font-sans';

  return (
    <div className="flex flex-col gap-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${uid}-panel-${i}`;
        return (
          <div key={i} className={`overflow-hidden rounded-[14px] border transition-[background-color,border-color,box-shadow] duration-200 ${isOpen ? k.open : k.card}`}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex min-h-[56px] w-full items-center justify-between gap-4 px-[22px] py-[18px] text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#B8860B]"
            >
              <span className={`${body} flex-1 text-[15px] font-semibold transition-colors duration-200 ${isOpen ? k.qOpen : k.q}`}>{item.q}</span>
              <span aria-hidden="true" className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-base font-bold leading-none transition-colors duration-200 ${isOpen ? k.iconOpen : k.icon}`}>
                {isOpen ? '−' : '+'}
              </span>
            </button>
            <div id={panelId} role="region" hidden={!isOpen} className={isOpen ? 'block' : 'hidden'}>
              <p className={`${body} m-0 border-t ${k.rule} px-[22px] pb-5 pt-4 text-sm leading-[1.75] ${k.a}`}>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
