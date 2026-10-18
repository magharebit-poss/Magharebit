'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ isOpen, onClose }: Props) {
  const t = useTranslations('hero');
  const videoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '';

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Demo video"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '820px',
          background: '#0A2318',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(255,255,255,0.12)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            fontSize: '16px',
            color: '#FFFFFF',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          aria-label="Close video"
        >
          ✕
        </button>

        {videoUrl ? (
          /* Responsive 16:9 iframe wrapper */
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              src={videoUrl}
              title="MAGHAREBIT POS demo video"
              loading="lazy"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          /* Coming-soon placeholder */
          <div
            style={{
              padding: '64px 32px',
              textAlign: 'center',
              color: '#FFFFFF',
            }}
          >
            <div style={{ fontSize: '56px', marginBottom: '20px', lineHeight: 1 }}>🎬</div>
            <p style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#F0B429',
              margin: '0 0 10px',
            }}>
              {t('video_coming_soon')}
            </p>
            <p style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, Inter, sans-serif',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.55)',
              margin: 0,
            }}>
              MAGHAREBIT POS
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
