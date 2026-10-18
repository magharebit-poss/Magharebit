import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#0A2318',
          900: '#0F3D2A',
          700: '#1A5C3A',
          600: '#2E8B57',
          500: '#3DAA6B',
          400: '#5EC485',
          100: '#E8F5EE',
          50:  '#F0FDF6',
        },
        gold: {
          600: '#B8860B',
          500: '#D4A017',
          400: '#F0B429',
          100: '#FEF3C7',
        },
        text: {
          primary: '#111827',
          muted:   '#6B7280',
        },
      },
      fontFamily: {
        arabic:  ['Noto Naskh Arabic', 'Cairo', 'serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      animation: {
        shimmer:      'shimmer 4s linear infinite',
        float:        'float 6s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-12px)' },
        },
        'pulse-gold': {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.4' },
        },
      },
    },
  },
  safelist: [
    // ── Color utilities ──────────────────────────────────────────────────
    'bg-brand-950', 'bg-brand-900', 'bg-brand-700', 'bg-brand-600',
    'bg-brand-100', 'bg-gold-400', 'bg-gold-500',
    'text-brand-950', 'text-brand-600', 'text-brand-400',
    'text-gold-400', 'text-gold-500',
    'border-brand-600', 'border-gold-400',
    'shadow-brand-950',
    'from-brand-600', 'to-brand-950', 'via-brand-900',

    // ── Display & layout ─────────────────────────────────────────────────
    'hidden', 'flex', 'grid', 'block', 'inline-flex', 'inline-block',
    'flex-col', 'flex-row', 'flex-wrap',
    'items-center', 'items-start', 'items-stretch',
    'justify-center', 'justify-between',
    'text-center', 'text-left', 'text-right',
    'w-full', 'h-full',
    'relative', 'absolute',

    // ── Grid columns (base) ──────────────────────────────────────────────
    'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4',
    'col-span-1', 'col-span-2',

    // ── md: responsive ───────────────────────────────────────────────────
    'md:flex', 'md:hidden', 'md:block', 'md:grid', 'md:inline-flex',
    'md:flex-row', 'md:flex-col',
    'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4',
    'md:col-span-1', 'md:col-span-2',
    'md:h-16',
    'md:w-1/2', 'md:w-full',
    'md:text-left', 'md:text-right', 'md:text-center',
    'md:px-6', 'md:py-12', 'md:py-20',
    'md:items-start', 'md:items-center',
    'md:scale-105', 'md:order-1', 'md:order-2',

    // ── lg: responsive ───────────────────────────────────────────────────
    'lg:flex', 'lg:hidden', 'lg:grid',
    'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4',
    'lg:text-5xl', 'lg:text-6xl',

    // ── sm: responsive ───────────────────────────────────────────────────
    'sm:flex-row', 'sm:grid-cols-2',

    // ── lg: col-span ─────────────────────────────────────────────────────
    'lg:col-span-1', 'lg:col-span-2',

    // ── hover: state utilities ───────────────────────────────────────────
    'hover:-translate-y-0.5',
    'hover:bg-gold-500',
    'hover:border-gold-400',
    'hover:scale-110',
    'hover:text-gold-400',
    'hover:bg-white/10',

    // ── focus: state utilities ────────────────────────────────────────────
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-brand-600',
    'focus:ring-offset-2',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-brand-600',

    // ── group-hover: utilities ────────────────────────────────────────────
    'group-hover:opacity-100',
    'group-hover:translate-x-1',
    'group',
  ],
  plugins: [],
}

export default config
