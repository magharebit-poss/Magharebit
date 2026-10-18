import type { NextConfig } from 'next';

// Static export for Tauri and Capacitor native builds.
// Both use out/ as their web bundle directory.
const isTauriBuild    = process.env.TAURI_BUILD === 'true';
const isNativeBuild   = process.env.NEXT_PUBLIC_IS_NATIVE === 'true';
const isStaticExport  = isTauriBuild || isNativeBuild;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport && {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
    images: { unoptimized: true },
  }),
  env: {
    NEXT_PUBLIC_IS_NATIVE: process.env.NEXT_PUBLIC_IS_NATIVE ?? 'false',
  },
};

export default nextConfig;
