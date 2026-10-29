'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import NotificationsDrawer from '@/components/portal/NotificationsDrawer';
import Logo from '@/components/brand/Logo';
import { STORE_LOGO_EVENT } from '@/lib/store-logo';

// ── Types ──────────────────────────────────────────────────────────────────────

interface MeData {
  storeName:    string;
  logoUrl:      string | null;
  plan:         string | null;
  lowStockCount: number;
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '🏠', label: 'الرئيسية',  slug: 'dashboard' },
  { icon: '📦', label: 'المنتجات',  slug: 'products' },
  { icon: '👥', label: 'الموظفون',  slug: 'employees' },
  { icon: '🤝', label: 'العملاء',   slug: 'customers' },
  { icon: '🚚', label: 'المشتريات', slug: 'purchases' },
  { icon: '📢', label: 'التسويق',   slug: 'marketing' },
  { icon: '📊', label: 'التقارير',  slug: 'reports' },
  { icon: '⚙️', label: 'الإعدادات', slug: 'settings' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const params   = useParams();
  const router   = useRouter();
  const locale   = (params?.locale as string) ?? 'ar';

  const [hovered,    setHovered]    = useState<string | null>(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Live store data ───────────────────────────────────────────────────────
  const [me,          setMe]          = useState<MeData | null>(null);

  const fetchMe = useCallback(() => {
    fetch('/api/portal/auth/me', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json() as MeData;
        setMe(d);
        // Badge products if low stock
        if ((d.lowStockCount ?? 0) > 0) {
          setUnreadCount(prev => Math.max(prev, 1));
        }
      })
      .catch(() => { /* silent */ });
  }, []);

  useEffect(() => {
    void (async () => { fetchMe(); })();
    // The settings page fires this after uploading or removing the store logo
    window.addEventListener(STORE_LOGO_EVENT, fetchMe);
    return () => window.removeEventListener(STORE_LOGO_EVENT, fetchMe);
  }, [fetchMe]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    fetch('/api/portal/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => {
        router.push(`/${locale}/portal/login`);
      });
  }, [locale, router]);

  // ── Nav badge: low-stock count on products ────────────────────────────────
  const navBadges: Record<string, number> = {};
  if (me != null && me.lowStockCount > 0) navBadges.products = me.lowStockCount;

  // ── Avatar initial from store name ────────────────────────────────────────
  const storeInitial = me?.storeName?.trim()
    ? me.storeName.trim().charAt(0)
    : 'م';

  const displayName = me?.storeName?.trim() || '…';
  const displayPlan = me?.plan ?? 'Starter';

  return (
    <aside
      dir="rtl"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '260px',
        height: '100vh',
        background: '#0F3D2A',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      {/* ── Header: avatar + logo + bell ─────────────────────────────────── */}
      <div style={{ padding: '20px 16px 16px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          {/* Store avatar: the uploaded logo, else the store's initial */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: me?.logoUrl ? '#FFFFFF' : 'rgba(240,180,41,0.20)',
            border: '2px solid rgba(240,180,41,0.40)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#F0B429',
            flexShrink: 0, fontFamily: 'Noto Naskh Arabic, serif',
            transition: 'opacity 0.2s', overflow: 'hidden',
          }}>
            {me?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img data-testid="sidebar-store-logo" src={me.logoUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : storeInitial}
          </div>

          {/* Notification bell */}
          <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setNotifOpen(true)}
            role="button"
            aria-label="الإشعارات"
            aria-expanded={notifOpen}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, background: '#EF4444', borderRadius: '50%',
                fontSize: 10, fontWeight: 700, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Logo height={28} on="dark" variant="horizontal" />
        </div>
        <p style={{ fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          لوحة التحكم
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 20px 16px' }} />

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NAV_ITEMS.map(({ icon, label, slug }) => {
          const href    = `/${locale}/portal/${slug}`;
          const active  = pathname.includes(`/portal/${slug}`);
          const isHov   = hovered === slug && !active;
          const badge   = navBadges[slug];

          return (
            <Link
              key={slug}
              href={href}
              onMouseEnter={() => setHovered(slug)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '8px', textDecoration: 'none',
                fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
                fontSize: '15px', fontWeight: active ? 600 : 500,
                color: active ? '#F0B429' : isHov ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                background: active ? 'rgba(240,180,41,0.15)' : isHov ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
              {label}
              {badge != null && badge > 0 ? (
                <span style={{
                  marginInlineStart: 'auto', background: '#EF4444', color: '#FFFFFF',
                  fontSize: '11px', fontWeight: 700, borderRadius: '999px',
                  padding: '1px 7px', lineHeight: '18px', minWidth: '20px',
                  textAlign: 'center', display: 'inline-block',
                }}>
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <NotificationsDrawer
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        onReadAll={() => setUnreadCount(0)}
      />

      {/* ── Store badge ───────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 12px 24px' }}>
        <div style={{
          background: 'rgba(240,180,41,0.12)', borderRadius: '8px', padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
              fontWeight: 600, color: '#FFFFFF', fontSize: '14px', margin: '0 0 4px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {displayName}
            </p>
            <span style={{
              fontFamily: 'Inter, sans-serif', background: '#F0B429', color: '#0A2318',
              fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 10px',
            }}>
              {displayPlan}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, "Noto Naskh Arabic", sans-serif',
              color: 'rgba(255,255,255,0.45)', fontSize: '12px',
              padding: '0 0 0 8px', flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            خروج
          </button>
        </div>
      </div>
    </aside>
  );
}
