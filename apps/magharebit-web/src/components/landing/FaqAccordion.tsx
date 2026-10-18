'use client';

import { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({
  items,
  isRTL,
}: {
  items: FaqItem[];
  isRTL: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const fontBody = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Inter, sans-serif';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            style={{
              // Each row is now a real card with its own surface, so the text
              // never sits directly on the page background.
              background: isOpen ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.035)',
              border: isOpen
                ? '1px solid rgba(240,180,41,0.35)'
                : '1px solid rgba(255,255,255,0.10)',
              borderRadius: '14px',
              overflow: 'hidden',
              transition: 'background 0.2s ease, border-color 0.2s ease',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: isRTL ? 'right' : 'left',
                direction: isRTL ? 'rtl' : 'ltr',
                gap: '16px',
              }}
            >
              <span
                style={{
                  fontFamily: fontBody,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: isOpen ? '#F0B429' : '#FFFFFF',
                  transition: 'color 0.2s ease',
                  flex: 1,
                }}
              >
                {item.q}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: isOpen ? '#F0B429' : 'rgba(255,255,255,0.10)',
                  color: isOpen ? '#0A2318' : 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  lineHeight: 1,
                }}
              >
                {isOpen ? '−' : '+'}
              </span>
            </button>

            <div
              style={{
                overflow: 'hidden',
                maxHeight: isOpen ? '400px' : '0px',
                transition: 'max-height 0.3s ease',
              }}
            >
              <p
                style={{
                  fontFamily: fontBody,
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.82)',
                  lineHeight: 1.75,
                  padding: '0 22px 20px',
                  margin: 0,
                  direction: isRTL ? 'rtl' : 'ltr',
                  textAlign: isRTL ? 'right' : 'left',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: '16px',
                }}
              >
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
