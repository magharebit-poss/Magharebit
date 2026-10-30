'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';
import Logo from '@/components/brand/Logo';

// ─── Products dropdown items ──────────────────────────────────────────────────
const PRODUCT_ITEMS = [
  {
    key: 'pos',
    emoji: '🖥️',
    labelAr: 'نقطة البيع (POS)',
    labelFr: 'Caisse (POS)',
    labelEn: 'Point of Sale (POS)',
    descAr: 'كاشير سريع يعمل بدون إنترنت',
    descFr: 'Caisse rapide sans Internet',
    descEn: 'Fast POS that works offline',
    path: '/#products',
  },
  {
    key: 'inventory',
    emoji: '📦',
    labelAr: 'إدارة المخزون',
    labelFr: 'Gestion des stocks',
    labelEn: 'Inventory management',
    descAr: 'تتبع المخزون في الوقت الفعلي',
    descFr: 'Suivi des stocks en temps réel',
    descEn: 'Real-time stock tracking',
    path: '/features#inventory',
  },
  {
    key: 'reports',
    emoji: '📊',
    labelAr: 'التقارير والتحليلات',
    labelFr: 'Rapports & analytiques',
    labelEn: 'Reports & analytics',
    descAr: 'قرارات مبنية على بيانات حقيقية',
    descFr: 'Décisions basées sur des données',
    descEn: 'Data-driven decisions',
    path: '/features#ai',
  },
  {
    key: 'materiel',
    emoji: '🖨️',
    labelAr: 'المعدات المتوافقة',
    labelFr: 'Matériel compatible',
    labelEn: 'Compatible hardware',
    descAr: 'الطابعات والماسحات والمزيد',
    descFr: 'Imprimantes, scanners et plus',
    descEn: 'Printers, scanners and more',
    path: '/materiel',
  },
  {
    key: 'comparaison',
    emoji: '⚖️',
    labelAr: 'مقارنة',
    labelFr: 'Comparaison',
    labelEn: 'Comparison',
    descAr: 'MAGHAREBIT مقابل الحلول الأخرى',
    descFr: 'MAGHAREBIT vs autres solutions',
    descEn: 'MAGHAREBIT vs other solutions',
    path: '/comparaison',
  },
];

// ─── Sectors dropdown items ───────────────────────────────────────────────────
const SECTOR_ITEMS = [
  { slug: 'boulangerie', emoji: '🥖', labelAr: 'المخابز', labelFr: 'Boulangeries', labelEn: 'Bakeries' },
  { slug: 'epicerie', emoji: '🛒', labelAr: 'البقالة', labelFr: 'Épiceries', labelEn: 'Groceries' },
  { slug: 'cafe-restaurant', emoji: '☕', labelAr: 'المقاهي والمطاعم', labelFr: 'Cafés & restaurants', labelEn: 'Cafés & restaurants' },
  { slug: 'salon-beaute', emoji: '💄', labelAr: 'صالونات التجميل', labelFr: 'Salons de beauté', labelEn: 'Beauty salons' },
  { slug: 'boutique-vetements', emoji: '👗', labelAr: 'محلات الملابس', labelFr: 'Boutiques vêtements', labelEn: 'Clothing boutiques' },
  { slug: 'pharmacie', emoji: '💊', labelAr: 'الصيدليات', labelFr: 'Pharmacies', labelEn: 'Pharmacies' },
];

type DropdownKey = 'products' | 'sectors' | null;

export default function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const pathname = usePathname();

  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [activeHash,  setActiveHash]  = useState('');
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  // Mobile expanded sections
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  // Track last pathname to close menus on navigation
  const [prevPathname, setPrevPathname] = useState(pathname);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getHref = (path: string) =>
    path.startsWith('/') ? `/${locale}${path}` : `/${locale}/${path}`;

  const isHomepage = pathname === `/${locale}` || pathname === `/${locale}/`;

  // Close menus on route change (setState-during-render pattern — no effect needed)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setOpenDropdown(null);
    setMobileExpanded({});
  }

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hash tracking
  useEffect(() => {
    const onHash = () => setActiveHash(window.location.hash);
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // A menu opened with the chevron (click/touch/keyboard) closes on Escape or a click elsewhere
  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDropdown(null); };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-nav-dropdown]')) setOpenDropdown(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [openDropdown]);

  // Dropdown hover handlers with delay on leave
  const handleDropdownEnter = (key: DropdownKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(key);
  };

  const handleDropdownLeave = () => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const isProductsActive =
    pathname === `/${locale}/features` ||
    (isHomepage && (activeHash === '#products' || (!activeHash)));

  const isSectorsActive =
    pathname === `/${locale}/sectors` ||
    pathname.startsWith(`/${locale}/sectors/`);

  const fontBody: React.CSSProperties = {
    fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
  };

  function getLabel(item: typeof PRODUCT_ITEMS[0]) {
    return locale === 'ar' ? item.labelAr : locale === 'fr' ? item.labelFr : item.labelEn;
  }
  function getDesc(item: typeof PRODUCT_ITEMS[0]) {
    return locale === 'ar' ? item.descAr : locale === 'fr' ? item.descFr : item.descEn;
  }
  function getSectorLabel(s: typeof SECTOR_ITEMS[0]) {
    return locale === 'ar' ? s.labelAr : locale === 'fr' ? s.labelFr : s.labelEn;
  }

  return (
    <>
      {/* ─── NAVBAR ─── */}
      <nav
        dir={isRTL ? 'rtl' : 'ltr'}
        className="h-14 md:h-16"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          transition: 'background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease',
          background: scrolled ? 'rgba(10,35,24,0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 2px 24px rgba(0,0,0,0.45)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(240,180,41,0.15)' : '1px solid transparent',
        }}
      >
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>

          {/* ── LOGO ── */}
          <Link
            href={`/${locale}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <Logo variant="horizontal" on="dark" height={40} priority />
          </Link>

          {/* ── DESKTOP NAV LINKS ── */}
          <div className="hidden md:flex" style={{ gap: '2rem', alignItems: 'center' }}>

            {/* Products dropdown */}
            <div
              style={{ position: 'relative' }}
              data-nav-dropdown
              onMouseEnter={() => handleDropdownEnter('products')}
              onMouseLeave={handleDropdownLeave}
            >
              <DropdownTrigger
                href={`/${locale}/features`}
                label={t('products')}
                menuLabel={MENU_LABEL[locale as keyof typeof MENU_LABEL]?.(t('products')) ?? t('products')}
                active={isProductsActive}
                open={openDropdown === 'products'}
                onToggle={() => setOpenDropdown(openDropdown === 'products' ? null : 'products')}
                fontBody={fontBody}
              />

              {openDropdown === 'products' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    ...(isRTL ? { right: 0 } : { left: 0 }),
                    background: 'rgba(10,35,24,0.97)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '14px',
                    padding: '8px',
                    minWidth: '280px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    zIndex: 70,
                  }}
                >
                  {PRODUCT_ITEMS.map((item) => (
                    <a
                      key={item.key}
                      href={getHref(item.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(240,180,41,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        flexShrink: 0,
                      }}>
                        {item.emoji}
                      </div>
                      <div style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
                        <div style={{ ...fontBody, fontWeight: 600, fontSize: '14px', color: '#FFFFFF' }}>
                          {getLabel(item)}
                        </div>
                        <div style={{ ...fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                          {getDesc(item)}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Features link */}
            <NavLink
              href={`/${locale}/features`}
              isActive={pathname === `/${locale}/features`}
              isRTL={isRTL}
            >
              {t('features')}
            </NavLink>

            {/* Pricing link */}
            <NavLink
              href={`/${locale}/pricing`}
              isActive={pathname === `/${locale}/pricing`}
              isRTL={isRTL}
            >
              {t('pricing')}
            </NavLink>

            {/* Sectors dropdown */}
            <div
              style={{ position: 'relative' }}
              data-nav-dropdown
              onMouseEnter={() => handleDropdownEnter('sectors')}
              onMouseLeave={handleDropdownLeave}
            >
              <DropdownTrigger
                href={`/${locale}/sectors`}
                label={t('sectors')}
                menuLabel={MENU_LABEL[locale as keyof typeof MENU_LABEL]?.(t('sectors')) ?? t('sectors')}
                active={isSectorsActive}
                open={openDropdown === 'sectors'}
                onToggle={() => setOpenDropdown(openDropdown === 'sectors' ? null : 'sectors')}
                fontBody={fontBody}
              />

              {openDropdown === 'sectors' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    ...(isRTL ? { right: 0 } : { left: 0 }),
                    background: 'rgba(10,35,24,0.97)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '14px',
                    padding: '8px',
                    width: '360px',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    zIndex: 70,
                  }}
                >
                  {/* 2-col grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '4px' }}>
                    {SECTOR_ITEMS.map((s) => (
                      <a
                        key={s.slug}
                        href={`/${locale}/sectors/${s.slug}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
                        <span style={{ ...fontBody, fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.85)', direction: isRTL ? 'rtl' : 'ltr' }}>
                          {getSectorLabel(s)}
                        </span>
                      </a>
                    ))}
                  </div>
                  {/* Footer link */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px', marginTop: '4px' }}>
                    <a
                      href={`/${locale}/sectors`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{ ...fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600 }}>
                        {locale === 'ar' ? 'عرض كل القطاعات ←' : locale === 'fr' ? 'Voir tous les secteurs →' : 'View all sectors →'}
                      </span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Clients link */}
            <NavLink
              href={`/${locale}/clients`}
              isActive={pathname === `/${locale}/clients` || pathname.startsWith(`/${locale}/clients/`)}
              isRTL={isRTL}
            >
              {t('clients')}
            </NavLink>

            {/* Demo link */}
            <NavLink
              href={`/${locale}/demo`}
              isActive={pathname === `/${locale}/demo`}
              isRTL={isRTL}
            >
              {t('demo')}
            </NavLink>
          </div>

          {/* ── DESKTOP RIGHT ── */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <LanguageSwitcher />
            <a
              href={`/${locale}/portal/login`}
              style={{
                ...fontBody,
                fontWeight: 500,
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                padding: '10px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.18)',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
              }}
            >
              {t('login')}
            </a>
            <CtaButton href={`/${locale}/auth/signup`} fontBody={fontBody}>
              {t('cta')}
            </CtaButton>
          </div>

          {/* ── MOBILE: lang switcher + hamburger ── */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: '8px' }}>
            <LanguageSwitcher />
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={isRTL ? 'فتح القائمة' : locale === 'fr' ? 'Ouvrir le menu' : 'Open menu'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                flexShrink: 0,
              }}
            >
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: 'block',
                  width: '22px',
                  height: '2px',
                  background: 'rgba(255,255,255,0.85)',
                  borderRadius: '2px',
                  transition: 'opacity 0.15s ease',
                }} />
              ))}
            </button>
          </div>

        </div>
      </nav>

      {/* ─── MOBILE BACKDROP ─── */}
      <div
        onClick={() => setMobileOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 998,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* ─── MOBILE DRAWER ─── */}
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed',
          top: 0,
          ...(isRTL ? { left: 0 } : { right: 0 }),
          width: '300px',
          height: '100%',
          background: 'rgba(10,35,24,0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 999,
          transform: mobileOpen
            ? 'translateX(0)'
            : isRTL
              ? 'translateX(-100%)'
              : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          ...(isRTL
            ? { borderRight: '1px solid rgba(255,255,255,0.07)' }
            : { borderLeft:  '1px solid rgba(255,255,255,0.07)' }),
          overflowY: 'auto',
        }}
      >
        {/* Drawer header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: '64px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <Logo variant="horizontal" on="dark" height={32} />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label={isRTL ? 'إغلاق القائمة' : locale === 'fr' ? 'Fermer le menu' : 'Close menu'}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '1.3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              transition: 'background 0.15s ease, color 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            ×
          </button>
        </div>

        {/* Drawer links */}
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '16px 12px 0', gap: '2px', flex: 1 }}>

          {/* Products expandable */}
          <MobileSection
            label={t('products')}
            isActive={isProductsActive}
            expanded={!!mobileExpanded['products']}
            onToggle={() => setMobileExpanded(p => ({ ...p, products: !p.products }))}
            fontBody={fontBody}
          >
            {PRODUCT_ITEMS.map((item) => (
              <a
                key={item.key}
                href={getHref(item.path)}
                onClick={() => setMobileOpen(false)}
                style={{
                  ...fontBody,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px 9px 28px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '14px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{item.emoji}</span>
                {getLabel(item)}
              </a>
            ))}
          </MobileSection>

          {/* Features */}
          <MobileLink
            href={`/${locale}/features`}
            isActive={pathname === `/${locale}/features`}
            onClick={() => setMobileOpen(false)}
            fontBody={fontBody}
          >
            {t('features')}
          </MobileLink>

          {/* Pricing */}
          <MobileLink
            href={`/${locale}/pricing`}
            isActive={pathname === `/${locale}/pricing`}
            onClick={() => setMobileOpen(false)}
            fontBody={fontBody}
          >
            {t('pricing')}
          </MobileLink>

          {/* Sectors expandable */}
          <MobileSection
            label={t('sectors')}
            isActive={isSectorsActive}
            expanded={!!mobileExpanded['sectors']}
            onToggle={() => setMobileExpanded(p => ({ ...p, sectors: !p.sectors }))}
            fontBody={fontBody}
          >
            {SECTOR_ITEMS.map((s) => (
              <a
                key={s.slug}
                href={`/${locale}/sectors/${s.slug}`}
                onClick={() => setMobileOpen(false)}
                style={{
                  ...fontBody,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 16px 9px 28px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: '14px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{s.emoji}</span>
                {getSectorLabel(s)}
              </a>
            ))}
            <a
              href={`/${locale}/sectors`}
              onClick={() => setMobileOpen(false)}
              style={{
                ...fontBody,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px 9px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#F0B429',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {locale === 'ar' ? 'عرض الكل ←' : locale === 'fr' ? 'Voir tout →' : 'View all →'}
            </a>
          </MobileSection>

          {/* Clients */}
          <MobileLink
            href={`/${locale}/clients`}
            isActive={pathname === `/${locale}/clients`}
            onClick={() => setMobileOpen(false)}
            fontBody={fontBody}
          >
            {t('clients')}
          </MobileLink>

          {/* Demo */}
          <MobileLink
            href={`/${locale}/demo`}
            isActive={pathname === `/${locale}/demo`}
            onClick={() => setMobileOpen(false)}
            fontBody={fontBody}
          >
            {t('demo')}
          </MobileLink>
        </nav>

        {/* Drawer CTA */}
        <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={`/${locale}/portal/login`}
            onClick={() => setMobileOpen(false)}
            style={{
              ...fontBody,
              fontWeight: 500,
              fontSize: '0.95rem',
              color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '999px',
              padding: '13px 22px',
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center',
            }}
          >
            {t('login')}
          </a>
          <a
            href={`/${locale}/auth/signup`}
            onClick={() => setMobileOpen(false)}
            style={{
              ...fontBody,
              fontWeight: 700,
              fontSize: '0.95rem',
              color: '#0A2318',
              background: '#F0B429',
              borderRadius: '999px',
              padding: '13px 22px',
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center',
              boxShadow: '0 4px 16px rgba(240,180,41,0.4)',
              transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(240,180,41,0.55)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(240,180,41,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {t('cta')}
          </a>
        </div>
      </div>
    </>
  );
}

/* ─── Sub-components ─── */

function NavLink({
  href,
  isActive,
  isRTL,
  children,
}: {
  href: string;
  isActive: boolean;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#F0B429' : 'rgba(255,255,255,0.70)',
        textDecoration: 'none',
        paddingBottom: '3px',
        borderBottom: isActive ? '2px solid #F0B429' : '2px solid transparent',
        transition: 'color 0.15s ease, border-color 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F0B429'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isActive ? '#F0B429' : 'rgba(255,255,255,0.70)'; }}
    >
      {children}
    </a>
  );
}

// Accessible name of the chevron button that opens a menu ("Produits" → "Menu Produits").
const MENU_LABEL = {
  ar: (name: string) => `قائمة ${name}`,
  fr: (name: string) => `Menu ${name}`,
  en: (name: string) => `${name} menu`,
} as const;

/**
 * Desktop menu trigger: the label is a real link (Produits → /features, Secteurs → /sectors), the chevron is a
 * button that opens the menu. Hover still opens it (handled by the wrapper); the button makes it work on touch
 * and with the keyboard, which a hover-only label did not.
 */
function DropdownTrigger({
  href,
  label,
  menuLabel,
  active,
  open,
  onToggle,
  fontBody,
}: {
  href: string;
  label: string;
  menuLabel: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  fontBody: React.CSSProperties;
}) {
  const color = active ? '#F0B429' : 'rgba(255,255,255,0.70)';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <a
        href={href}
        style={{
          ...fontBody,
          fontSize: '0.875rem',
          fontWeight: active ? 600 : 400,
          color,
          textDecoration: 'none',
          paddingBottom: '3px',
          borderBottom: active ? '2px solid #F0B429' : '2px solid transparent',
          transition: 'color 0.15s ease, border-color 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F0B429'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = color; }}
      >
        {label}
      </a>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={menuLabel}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color,
          minWidth: '24px',
          minHeight: '32px',
          padding: '0 4px',
          fontSize: '9px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span aria-hidden="true" style={{ opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>▾</span>
      </button>
    </span>
  );
}

function MobileLink({
  href,
  isActive,
  onClick,
  fontBody,
  children,
}: {
  href: string;
  isActive: boolean;
  onClick: () => void;
  fontBody: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      style={{
        ...fontBody,
        fontSize: '1rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#F0B429' : 'rgba(255,255,255,0.75)',
        textDecoration: 'none',
        padding: '12px 16px',
        borderRadius: '12px',
        background: isActive ? 'rgba(240,180,41,0.1)' : 'transparent',
        transition: 'background 0.15s ease, color 0.15s ease',
        display: 'block',
      }}
      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff'; } }}
      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; } }}
    >
      {children}
    </a>
  );
}

function MobileSection({
  label,
  isActive,
  expanded,
  onToggle,
  fontBody,
  children,
}: {
  label: string;
  isActive: boolean;
  expanded: boolean;
  onToggle: () => void;
  fontBody: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          ...fontBody,
          width: '100%',
          textAlign: 'start',
          fontSize: '1rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#F0B429' : 'rgba(255,255,255,0.75)',
          background: isActive && !expanded ? 'rgba(240,180,41,0.1)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: '12px', opacity: 0.6, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '4px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function CtaButton({
  href,
  fontBody,
  children,
}: {
  href: string;
  fontBody: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        ...fontBody,
        fontWeight: 700,
        fontSize: '0.875rem',
        color: '#0A2318',
        background: '#F0B429',
        borderRadius: '999px',
        padding: '10px 22px',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 16px rgba(240,180,41,0.35)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(240,180,41,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(240,180,41,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {children}
    </a>
  );
}
