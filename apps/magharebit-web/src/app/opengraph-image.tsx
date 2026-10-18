import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MAGHAREBIT POS — نظام نقطة البيع للتجار المغاربة';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A2318 0%, #0F3D2A 60%, #1a5c3a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Brand emblem (same geometry/colors as /brand/emblem-light.svg) */}
        <svg
          width="103"
          height="120"
          viewBox="0 0 240 280"
          style={{ marginBottom: '24px' }}
        >
          <path fill="#FFFFFF" fillRule="evenodd" d="M120 4C124 10 132 13 143 17C180 27 219 62 219 110C219 130 219 148 219 164C219 204 192 228 160 244C147 251 131 265 120 275C109.0 265 93.0 251 80.0 244C48.0 228 21.0 204 21.0 164C21.0 148 21.0 130 21.0 110C21.0 62 60.0 27 97.0 17C108.0 13 116.0 10 120.0 4ZM120 24.65C122.91 29.01 129.71 29.19 137.7 32.1C169.06 40.57 203 69.49 203 110.16C203 130.05 203 147.95 203 163.86C203 197.3 179.27 216.48 152.53 229.85C142.18 235.43 128.75 245.65 120 253.6C111.25 245.65 97.82 235.43 87.47 229.85C60.73 216.48 37 197.3 37 163.86C37 147.95 37 130.05 37 110.16C37 69.49 70.94 40.57 102.3 32.1C110.29 29.19 117.09 29.01 120 24.65Z" />
          <path fill="#F0B429" d="M120 79.56L133.44 93L120 106.44L106.56 93ZM132.42 92.58L151.42 92.58L151.42 111.58L132.42 111.58ZM151 110.56L164.44 124L151 137.44L137.56 124ZM132.42 136.42L151.42 136.42L151.42 155.42L132.42 155.42ZM120 141.56L133.44 155L120 168.44L106.56 155ZM88.58 136.42L107.58 136.42L107.58 155.42L88.58 155.42ZM89 110.56L102.44 124L89 137.44L75.56 124ZM88.58 92.58L107.58 92.58L107.58 111.58L88.58 111.58Z" />
          <path fill="#FFFFFF" d="M120 109.5L123.25 116.15L130.25 113.75L127.85 120.75L134.5 124L127.85 127.25L130.25 134.25L123.25 131.85L120 138.5L116.75 131.85L109.75 134.25L112.15 127.25L105.5 124L112.15 120.75L109.75 113.75L116.75 116.15Z" />
          <path fill="#F0B429" d="M75 213V197A20 20 0 0 1 115 197V198A5 5 0 0 0 125 198V197A20 20 0 0 1 165 197V213H155V197A10 10 0 0 0 135 197V198A15 15 0 0 1 105 198V197A10 10 0 0 0 85 197V213Z" />
        </svg>

        {/* Brand name */}
        <div
          style={{
            display: 'flex',
            fontSize: '56px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-1px',
            marginBottom: '12px',
          }}
        >
          MAGHAR
          <span style={{ color: '#F0B429' }}>EBIT</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.65)',
            marginBottom: '32px',
          }}
        >
          POS — نظام إدارة المتاجر المغربي
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '16px',
            padding: '20px 40px',
          }}
        >
          {[
            { value: '500+', label: 'Active Stores' },
            { value: '99.9%', label: 'Uptime' },
            { value: '2 min', label: 'Setup Time' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#F0B429' }}>
                {stat.value}
              </span>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
