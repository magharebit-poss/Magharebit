'use client';

import React from 'react';

type Platform = 'youtube' | 'linkedin' | 'x' | 'facebook' | 'pinterest';
type Size = 'sm' | 'md' | 'lg';
type Variant = 'default' | 'colored';

interface PlatformConfig {
  name: string;
  url: string;
  brandColor: string;
  brandText: string;
  paths: React.ReactNode;
}

const PLATFORMS: Record<Platform, PlatformConfig> = {
  youtube: {
    name: 'YouTube',
    url: 'https://www.youtube.com/channel/UCsFWs7PYax6j70XYrJYKjUg',
    brandColor: '#FF0000',
    brandText: '#FFFFFF',
    paths: (
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    ),
  },
  linkedin: {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/magharebit-team-15a025414/',
    brandColor: '#0A66C2',
    brandText: '#FFFFFF',
    paths: (
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    ),
  },
  x: {
    name: 'X (Twitter)',
    url: 'https://x.com/teamMagharebit',
    brandColor: '#000000',
    brandText: '#FFFFFF',
    paths: (
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    ),
  },
  facebook: {
    name: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61590535894132',
    brandColor: '#1877F2',
    brandText: '#FFFFFF',
    paths: (
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    ),
  },
  pinterest: {
    name: 'Pinterest',
    url: 'https://fr.pinterest.com/1oe8lul3hlebthv4yd6wd1gx3sdqlk',
    brandColor: '#BD081C',
    brandText: '#FFFFFF',
    paths: (
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
    ),
  },
};

const SIZE_MAP: Record<Size, number> = { sm: 28, md: 36, lg: 44 };
const ICON_SIZE_MAP: Record<Size, number> = { sm: 14, md: 18, lg: 22 };

export default function SocialLinks({
  size = 'md',
  variant = 'default',
  platforms = ['youtube', 'linkedin', 'x', 'facebook', 'pinterest'],
}: {
  size?: Size;
  variant?: Variant;
  platforms?: Platform[];
}) {
  const btnSize = SIZE_MAP[size];
  const iconSize = ICON_SIZE_MAP[size];

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {platforms.map((p) => {
        const cfg = PLATFORMS[p];
        return (
          <a
            key={p}
            href={cfg.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={cfg.name}
            style={{
              width: btnSize,
              height: btnSize,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              color: 'rgba(255,255,255,0.80)',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              if (variant === 'colored') {
                e.currentTarget.style.background = cfg.brandColor;
                e.currentTarget.style.color = cfg.brandText;
                e.currentTarget.style.borderColor = cfg.brandColor;
              } else {
                e.currentTarget.style.background = 'rgba(240,180,41,0.15)';
                e.currentTarget.style.color = '#F0B429';
                e.currentTarget.style.borderColor = 'rgba(240,180,41,0.40)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.80)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width={iconSize}
              height={iconSize}
              fill="currentColor"
              aria-hidden="true"
            >
              {cfg.paths}
            </svg>
          </a>
        );
      })}
    </div>
  );
}
