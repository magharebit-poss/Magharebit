// SECURITY NOTICE:
// The current admin gate uses a client-side localStorage password check + server-side x-admin-secret header.
// This is acceptable for current scale but MUST be replaced with proper auth (NextAuth, Clerk, or custom JWT)
// before any production deployment with real merchant data.
// Tracked in DEPLOY.md → "Pre-launch backend integration TODOs"

'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AdminSystemStatus from '@/components/admin/AdminSystemStatus';
import Logo from '@/components/brand/Logo';

type LeadStatus = 'new' | 'contacted' | 'converted' | 'rejected' | 'activated';

interface Lead {
  id: string;
  storeName: string;
  phone: string;
  businessType: string;
  city: string;
  locale: string;
  status: LeadStatus;
  createdAt: string;
  licenseKey?: string;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  converted: 'محوّل',
  rejected: 'مرفوض',
  activated: 'مُفعَّل',
};

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string }> = {
  new:       { bg: '#DBEAFE', text: '#1D4ED8' },
  contacted: { bg: '#FEF9C3', text: '#854D0E' },
  converted: { bg: '#DCFCE7', text: '#166534' },
  rejected:  { bg: '#FEE2E2', text: '#991B1B' },
  activated: { bg: '#FEF3C7', text: '#92400E' },
};

type SortKey = 'date_desc' | 'date_asc' | 'name_asc';

export default function AdminLeadsPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] ?? 'ar';

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');

  // Detail panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '';

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/leads', {
        headers: { 'x-admin-secret': adminPassword },
      });
      if (!res.ok) {
        setFetchError('خطأ في الاتصال بالخادم');
        return;
      }
      const data = await res.json();
      setLeads(data.leads ?? []);
      setServerTotal(typeof data.total === 'number' ? data.total : null);
    } catch {
      setFetchError('تعذّر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  const login = () => {
    if (password === adminPassword) {
      setAuthenticated(true);
      setAuthError('');
      fetchLeads();
    } else {
      setAuthError('كلمة المرور غير صحيحة');
    }
  };

  const updateStatus = async (id: string, status: LeadStatus, licenseKey?: string) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminPassword,
        },
        body: JSON.stringify({ status, ...(licenseKey ? { licenseKey } : {}) }),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status, ...(licenseKey ? { licenseKey } : {}) } : l
        )
      );
      if (selectedLead?.id === id) {
        setSelectedLead((prev) =>
          prev ? { ...prev, status, ...(licenseKey ? { licenseKey } : {}) } : prev
        );
      }
    } catch {
      // silent
    }
  };

  const generateLicenseKey = async (lead: Lead) => {
    setGeneratingKey(true);
    const key = `MGB-${crypto.randomUUID().toUpperCase().slice(0, 8)}-${crypto.randomUUID().toUpperCase().slice(0, 8)}`;
    await updateStatus(lead.id, 'activated', key);
    setGeneratingKey(false);
  };

  const exportCSV = () => {
    const headers = ['ID', 'Store Name', 'Phone', 'Business Type', 'City', 'Locale', 'Status', 'License Key', 'Created At'];
    const rows = filteredLeads.map((l) => [
      l.id, l.storeName, l.phone, l.businessType, l.city, l.locale, l.status, l.licenseKey ?? '', l.createdAt,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today = new Date().toDateString();
  const stats = {
    total: leads.length,
    newToday: leads.filter((l) => new Date(l.createdAt).toDateString() === today).length,
    contacted: leads.filter((l) => l.status === 'contacted').length,
    activated: leads.filter((l) => l.status === 'activated').length,
  };

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filteredLeads = (() => {
    const q = search.trim().toLowerCase();
    const afterSearch = q
      ? leads.filter(
          (l) =>
            l.storeName.toLowerCase().includes(q) ||
            l.phone.includes(q) ||
            l.city.toLowerCase().includes(q) ||
            l.businessType.toLowerCase().includes(q)
        )
      : leads;

    const afterFilter =
      filterStatus !== 'all'
        ? afterSearch.filter((l) => l.status === filterStatus)
        : afterSearch;

    const sorted = [...afterFilter];
    if (sortKey === 'date_asc') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortKey === 'name_asc') {
      sorted.sort((a, b) => a.storeName.localeCompare(b.storeName, 'ar'));
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  })();

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            padding: '40px 36px',
            width: '100%',
            maxWidth: '360px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            direction: 'rtl',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', justifyContent: 'center' }}>
            <Logo height={28} on="light" variant="horizontal" />
          </div>

          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 24px' }}>
            لوحة إدارة العملاء
          </h1>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            كلمة المرور
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="••••••••"
            style={{
              width: '100%',
              padding: '10px 14px',
              border: authError ? '1px solid #EF4444' : '1px solid #D1D5DB',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
              marginBottom: '8px',
              boxSizing: 'border-box',
            }}
          />
          {authError && (
            <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 12px' }}>{authError}</p>
          )}

          <button
            onClick={login}
            style={{
              width: '100%',
              background: '#0F3D2A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '11px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: authError ? '0' : '8px',
            }}
          >
            دخول
          </button>
        </div>
      </main>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F8F9FA',
        padding: '32px 24px',
        direction: 'rtl',
      }}
    >
      {/* Slide-in detail panel overlay */}
      {selectedLead && (
        <>
          <div
            onClick={() => setSelectedLead(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 40,
            }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100vh',
              width: '360px',
              maxWidth: '95vw',
              background: '#FFFFFF',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              zIndex: 50,
              overflowY: 'auto',
              padding: '28px 24px',
              direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
                تفاصيل العميل
              </h2>
              <button
                onClick={() => setSelectedLead(null)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            {/* Store name */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '4px' }}>
                {selectedLead.storeName}
              </div>
              <span
                style={{
                  background: STATUS_COLORS[selectedLead.status].bg,
                  color: STATUS_COLORS[selectedLead.status].text,
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                {STATUS_LABELS[selectedLead.status]}
              </span>
            </div>

            {/* Detail rows */}
            {[
              { label: 'الهاتف', value: selectedLead.phone, dir: 'ltr' },
              { label: 'النشاط التجاري', value: selectedLead.businessType || '—', dir: 'rtl' },
              { label: 'المدينة', value: selectedLead.city || '—', dir: 'rtl' },
              { label: 'تاريخ التسجيل', value: new Date(selectedLead.createdAt).toLocaleDateString('ar-MA', { dateStyle: 'long' }), dir: 'ltr' },
            ].map((row) => (
              <div key={row.label} style={{ marginBottom: '14px', borderBottom: '1px solid #F3F4F6', paddingBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  {row.label}
                </div>
                <div style={{ fontSize: '15px', color: '#111827', direction: row.dir as 'ltr' | 'rtl' }}>
                  {row.value}
                </div>
              </div>
            ))}

            {/* License key */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                مفتاح الترخيص
              </div>
              {selectedLead.licenseKey ? (
                <>
                  <div
                    style={{
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: '#166534',
                      direction: 'ltr',
                      wordBreak: 'break-all',
                      marginBottom: '12px',
                    }}
                  >
                    {selectedLead.licenseKey}
                  </div>

                  {/* Message template */}
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    رسالة التفعيل
                  </div>
                  <textarea
                    readOnly
                    value={`مرحباً ${selectedLead.storeName}،\n\nتم تفعيل اشتراككم في MAGHAREBIT POS بنجاح.\n\nمفتاح الترخيص الخاص بكم:\n${selectedLead.licenseKey}\n\n📥 خطوات التفعيل:\n1. حمّل التطبيق من: https://magharebit.com/download\n2. افتح التطبيق وانقر على "تفعيل الترخيص"\n3. أدخل المفتاح أعلاه بدقة\n4. أعد تشغيل التطبيق\n\nمعلومات الدعم:\n📞 05 XX XX XX XX\n💬 https://wa.me/212619522487\n\nشكراً لثقتكم في MAGHAREBIT!`}
                    style={{
                      width: '100%',
                      height: '220px',
                      padding: '12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      color: '#374151',
                      background: '#FFFFFF',
                      resize: 'none',
                      direction: 'rtl',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `مرحباً ${selectedLead.storeName}،\n\nتم تفعيل اشتراككم في MAGHAREBIT POS بنجاح.\n\nمفتاح الترخيص الخاص بكم:\n${selectedLead.licenseKey}\n\n📥 خطوات التفعيل:\n1. حمّل التطبيق من: https://magharebit.com/download\n2. افتح التطبيق وانقر على "تفعيل الترخيص"\n3. أدخل المفتاح أعلاه بدقة\n4. أعد تشغيل التطبيق\n\nمعلومات الدعم:\n📞 05 XX XX XX XX\n💬 https://wa.me/212619522487\n\nشكراً لثقتكم في MAGHAREBIT!`
                        ).then(() => {
                          setCopyToast(true);
                          setTimeout(() => setCopyToast(false), 2000);
                        });
                      }}
                      style={{ flex: 1, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: copyToast ? '#166534' : '#374151', fontFamily: 'inherit' }}
                    >
                      {copyToast ? '✓ تم النسخ' : '📋 نسخ الرسالة'}
                    </button>
                    <a
                      href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً ${selectedLead.storeName}،\n\nمفتاح الترخيص: ${selectedLead.licenseKey}\n\nحمّل التطبيق: https://magharebit.com/download`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flex: 1, background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#166534', fontFamily: 'inherit', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      💬 واتساب
                    </a>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => generateLicenseKey(selectedLead)}
                  disabled={generatingKey}
                  style={{
                    background: '#F0B429',
                    color: '#0A2318',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: generatingKey ? 'not-allowed' : 'pointer',
                    opacity: generatingKey ? 0.7 : 1,
                    width: '100%',
                  }}
                >
                  {generatingKey ? 'جارٍ الإنشاء...' : '🔑 إنشاء مفتاح ترخيص'}
                </button>
              )}
            </div>

            {/* Change status */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                تغيير الحالة
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selectedLead.id, s)}
                    style={{
                      background: selectedLead.status === s ? STATUS_COLORS[s].bg : '#F9FAFB',
                      color: selectedLead.status === s ? STATUS_COLORS[s].text : '#374151',
                      border: `1px solid ${selectedLead.status === s ? 'transparent' : '#E5E7EB'}`,
                      borderRadius: '999px',
                      padding: '5px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Tab navigation */}
        <div
          style={{
            display: 'flex', gap: '4px', background: '#E5E7EB',
            borderRadius: '10px', padding: '4px', marginBottom: '28px',
            width: 'fit-content',
          }}
        >
          <span
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 700,
              fontSize: '14px', background: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: '#111827',
            }}
          >
            العملاء المحتملون
          </span>
          <Link
            href={`/${locale}/admin/licenses`}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 600,
              fontSize: '14px', color: '#6B7280', textDecoration: 'none',
            }}
          >
            التراخيص
          </Link>
          <Link
            href={`/${locale}/admin/merchants`}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 600,
              fontSize: '14px', color: '#6B7280', textDecoration: 'none',
            }}
          >
            المشتركون
          </Link>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              العملاء المحتملون
            </h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              {serverTotal ?? leads.length} عميل مسجّل
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchLeads}
              style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#374151' }}
            >
              تحديث
            </button>
            <button
              onClick={exportCSV}
              disabled={filteredLeads.length === 0}
              style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: filteredLeads.length === 0 ? 'not-allowed' : 'pointer', opacity: filteredLeads.length === 0 ? 0.5 : 1 }}
            >
              تصدير CSV
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'إجمالي العملاء', value: stats.total, icon: '👥', color: '#1D4ED8', bg: '#DBEAFE' },
            { label: 'جدد اليوم', value: stats.newToday, icon: '🆕', color: '#166534', bg: '#DCFCE7' },
            { label: 'تم التواصل', value: stats.contacted, icon: '📞', color: '#854D0E', bg: '#FEF9C3' },
            { label: 'مُفعَّلون', value: stats.activated, icon: '✅', color: '#92400E', bg: '#FEF3C7' },
          ].map((card) => (
            <div
              key={card.label}
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span
                  style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}
                >
                  {card.icon}
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* System status — visible only to authenticated admin */}
        <AdminSystemStatus adminSecret={adminPassword} />

        {/* Search + filter + sort bar */}
        <div
          style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            type="text"
            placeholder="🔍  بحث بالاسم، الهاتف، المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', padding: '9px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#FFFFFF', direction: 'rtl' }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'all')}
            style={{ padding: '9px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', background: '#FFFFFF', cursor: 'pointer', outline: 'none', color: '#374151' }}
          >
            <option value="all">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{ padding: '9px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', background: '#FFFFFF', cursor: 'pointer', outline: 'none', color: '#374151' }}
          >
            <option value="date_desc">الأحدث أولاً</option>
            <option value="date_asc">الأقدم أولاً</option>
            <option value="name_asc">الاسم أ–ي</option>
          </select>
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#991B1B', fontSize: '14px' }}>
            {fetchError}
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>
              جاري التحميل...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>
              {leads.length === 0 ? 'لا يوجد عملاء بعد' : 'لا توجد نتائج تطابق البحث'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['المتجر', 'الهاتف', 'النشاط', 'المدينة', 'اللغة', 'الحالة', 'التاريخ', ''].map((col, i) => (
                    <th
                      key={i}
                      style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    style={{ borderBottom: i < filteredLeads.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {lead.storeName}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', color: '#374151', direction: 'ltr', textAlign: 'right' }}>
                      {lead.phone}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>
                      {lead.businessType || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>
                      {lead.city || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', direction: 'ltr', textAlign: 'right' }}>
                      {lead.locale}
                    </td>
                    <td style={{ padding: '14px 16px' }} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                        style={{
                          background: STATUS_COLORS[lead.status].bg,
                          color: STATUS_COLORS[lead.status].text,
                          border: 'none',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                      {new Date(lead.createdAt).toLocaleDateString('ar-MA')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '13px', color: '#9CA3AF' }}>←</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
