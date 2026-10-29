'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import { LOGO_MAX_SIDE, LOGO_MAX_SOURCE_BYTES, STORE_LOGO_EVENT } from '@/lib/store-logo';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Settings {
  storeName:           string;
  storePhone:          string;
  sector:              string;
  logoUrl:             string;
  currency:            string;
  timezone:            string;
  whatsappEnabled:     boolean;
  dailyReportEnabled:  boolean;
  dailyReportTime:     string;
  lowStockAlert:       boolean;
  receiptHeader:       string;
  receiptFooter:       string;
  receiptShowLogo:     boolean;
  // Sprint 3 fields
  taxEnabled:                     boolean;
  defaultTaxRate:                 0 | 7 | 10 | 14 | 20;
  discountEnabled:                boolean;
  maxDiscountPercent:             number;
  customerWhatsappReceiptEnabled: boolean;
}

const EMPTY_SETTINGS: Settings = {
  storeName:           '',
  storePhone:          '',
  sector:              '',
  logoUrl:             '',
  currency:            'MAD',
  timezone:            'Africa/Casablanca',
  whatsappEnabled:     false,
  dailyReportEnabled:  false,
  dailyReportTime:     '21:00',
  lowStockAlert:       true,
  receiptHeader:       '',
  receiptFooter:       'شكراً لزيارتكم!',
  receiptShowLogo:     true,
  // Sprint 3 defaults (mirrors repository DEFAULTS)
  taxEnabled:                     false,
  defaultTaxRate:                 0,
  discountEnabled:                true,
  maxDiscountPercent:             100,
  customerWhatsappReceiptEnabled: false,
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: '#111827',
  background: '#FFFFFF',
  outline: 'none',
  direction: 'rtl',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '8px',
};

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange(!checked); }}
      style={{
        width: '44px', height: '24px', borderRadius: '999px', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#0F3D2A' : '#D1D5DB',
        position: 'relative', transition: 'background 0.2s ease',
        flexShrink: 0, padding: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '22px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%', background: '#FFFFFF',
        transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
      }} />
    </button>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      maxWidth: '560px', background: '#FFFFFF', border: '1px solid #E5E7EB',
      borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginBottom: '24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid #F3F4F6',
      }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>{icon}</span>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Toggle row (reusable inside section cards) ───────────────────────────────
function ToggleRow({ label, desc, checked, onChange, disabled }: {
  label: string; desc: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: '16px', padding: '16px 0', borderBottom: '1px solid #F3F4F6',
    }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px', color: '#111827' }}>{label}</p>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────
function SaveButton({ label, savedLabel = '✓ تم الحفظ', saved, saving, onClick }: {
  label: string; savedLabel?: string; saved: boolean; saving: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        marginTop: '24px', width: '100%',
        background: saved ? '#22C55E' : '#0F3D2A',
        color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px',
        padding: '12px', cursor: saving ? 'wait' : 'pointer', fontSize: '15px',
        fontFamily: 'inherit', transition: 'background 0.2s ease',
        opacity: saving ? 0.7 : 1,
      }}
    >
      {saving ? '...' : saved ? savedLabel : label}
    </button>
  );
}

// ─── Logo resize (browser) ────────────────────────────────────────────────────
// Longest side LOGO_MAX_SIDE, WebP when the browser can encode it (keeps transparency), PNG otherwise.
// Drawing through a canvas also drops EXIF data (GPS etc.) from phone photos.
async function resizeLogo(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const encode = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.9);
  const blob = webp && webp.type === 'image/webp' ? webp : await encode('image/png');
  if (!blob) throw new Error('encode_failed');
  return blob;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  const [settings, setSettings]         = useState<Settings>(EMPTY_SETTINGS);
  const [loading, setLoading]           = useState(true);
  const [logoBusy, setLogoBusy]         = useState(false);
  const [logoError, setLogoError]       = useState('');
  const [uploadHovered, setUploadHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-section save state
  const [storeSaving,    setStoreSaving]    = useState(false);
  const [storeSaved,     setStoreSaved]     = useState(false);
  const [waSaving,       setWaSaving]       = useState(false);
  const [waSaved,        setWaSaved]        = useState(false);
  const [tvaSaving,      setTvaSaving]      = useState(false);
  const [tvaSaved,       setTvaSaved]       = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountSaved,  setDiscountSaved]  = useState(false);
  const [rcptSaving,     setRcptSaving]     = useState(false);
  const [rcptSaved,      setRcptSaved]      = useState(false);

  const [error, setError] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  const fetchSettings = useCallback(() => {
    setLoading(true);
    setError('');
    fetch('/api/portal/settings', { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push(`/${locale}/portal/login`); return; }
        if (!res.ok) { setError('تعذّر تحميل الإعدادات'); return; }
        const data = await res.json() as Settings;
        setSettings(data);
      })
      .catch(() => setError('تعذّر تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, [locale, router]);

  useEffect(() => {
    void (async () => { fetchSettings(); })();
  }, [fetchSettings]);

  // ── Generic patch helper ──────────────────────────────────────────────────
  function patch(
    fields: Partial<Settings>,
    setSaving: (v: boolean) => void,
    setSaved:  (v: boolean) => void
  ) {
    setSaving(true);
    fetch('/api/portal/settings', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          setError(d.error ?? 'فشل الحفظ');
          return;
        }
        const data = await res.json() as Settings;
        setSettings(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      })
      .catch(() => setError('فشل الحفظ'))
      .finally(() => setSaving(false));
  }

  // ── Store logo: resize in the browser, then PUT the bytes (DELETE to remove) ──
  function sendLogo(init: RequestInit) {
    setLogoBusy(true);
    setLogoError('');
    fetch('/api/portal/settings/logo', { credentials: 'include', ...init })
      .then(async (res) => {
        if (res.status === 401) { router.push(`/${locale}/portal/login`); return; }
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          setLogoError(
            d.error === 'unsupported_type' ? 'الصيغة غير مدعومة: استعمل PNG أو JPG أو WebP'
            : d.error === 'too_large'      ? 'الصورة كبيرة جداً'
            : d.error === 'rate_limited'   ? 'محاولات كثيرة، حاول بعد قليل'
            : 'تعذّر حفظ الشعار، حاول مرة أخرى'
          );
          return;
        }
        const d = await res.json() as { logoUrl: string };
        setSettings(s => ({ ...s, logoUrl: d.logoUrl }));
        window.dispatchEvent(new Event(STORE_LOGO_EVENT));
      })
      .catch(() => setLogoError('تعذّر حفظ الشعار، حاول مرة أخرى'))
      .finally(() => setLogoBusy(false));
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // picking the same file again must fire onChange again
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setLogoError('الصيغة غير مدعومة: استعمل PNG أو JPG أو WebP'); return; }
    if (file.size > LOGO_MAX_SOURCE_BYTES) { setLogoError('الصورة كبيرة جداً (الحد 8 ميغابايت)'); return; }
    setLogoBusy(true);
    setLogoError('');
    resizeLogo(file)
      .then((blob) => sendLogo({ method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob }))
      .catch(() => { setLogoBusy(false); setLogoError('تعذّرت قراءة الصورة، جرّب ملفاً آخر'); });
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', color: '#111827' }}>
        <PortalBreadcrumb current="الإعدادات" />
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '32px' }}>جاري التحميل…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', color: '#111827' }}>
      <PortalBreadcrumb current="الإعدادات" />

      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>الإعدادات</h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
          ضبط معلومات متجرك وتفضيلاتك
        </p>
      </div>

      {error && (
        <div style={{
          maxWidth: '560px', background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
          fontSize: '14px', color: '#DC2626',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ float: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Section 1: Store info ──────────────────────────────────────────────── */}
      <SectionCard icon="⚙️" title="إعدادات المتجر" subtitle="المعلومات الأساسية">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '4px' }}>

          <div>
            <label style={LABEL}>اسم المتجر</label>
            <input
              type="text"
              value={settings.storeName}
              onChange={(e) => setSettings(s => ({ ...s, storeName: e.target.value }))}
              placeholder="متجر العلوي"
              style={INPUT}
            />
          </div>

          {/* Logo: saved on pick (no need to press "save"), shown in the portal sidebar */}
          <div>
            <label htmlFor="store-logo-input" style={LABEL}>شعار المتجر</label>
            <input id="store-logo-input" ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFilePick} style={{ display: 'none' }} />
            <button
              type="button"
              data-testid="store-logo-pick"
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={() => setUploadHovered(true)}
              onMouseLeave={() => setUploadHovered(false)}
              disabled={logoBusy}
              aria-busy={logoBusy}
              style={{
                width: '100%', fontFamily: 'inherit',
                border: `2px dashed ${uploadHovered ? '#0F3D2A' : '#E5E7EB'}`,
                borderRadius: '12px', padding: '32px', textAlign: 'center',
                cursor: logoBusy ? 'wait' : 'pointer', background: '#F9FAFB', transition: 'border-color 0.2s ease',
              }}
            >
              {logoBusy ? (
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>جارٍ رفع الشعار…</p>
              ) : settings.logoUrl ? (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img data-testid="store-logo-img" src={settings.logoUrl} alt="شعار المتجر" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain', borderRadius: '8px' }} />
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>انقر لتغيير الصورة</span>
                </span>
              ) : (
                <>
                  <span style={{ display: 'block', fontSize: '32px', marginBottom: '8px' }}>📷</span>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>انقر لرفع الشعار</span>
                  <span style={{ display: 'block', fontSize: '12px', color: '#9CA3AF', margin: 0 }}>PNG أو JPG أو WebP حتى 8MB، تُصغَّر تلقائياً</span>
                </>
              )}
            </button>
            {logoError && (
              <p role="alert" style={{ fontSize: '13px', color: '#DC2626', marginTop: '8px', marginBottom: 0 }}>{logoError}</p>
            )}
            {settings.logoUrl && !logoBusy && (
              <button
                type="button"
                data-testid="store-logo-remove"
                onClick={() => { if (window.confirm('إزالة شعار المتجر؟')) sendLogo({ method: 'DELETE' }); }}
                style={{
                  marginTop: '8px', minHeight: '44px', background: 'none', border: 'none', padding: '0 4px',
                  color: '#DC2626', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                إزالة الشعار
              </button>
            )}
          </div>

          <div>
            <label style={LABEL}>العملة</label>
            <select value={settings.currency} onChange={(e) => setSettings(s => ({ ...s, currency: e.target.value }))} style={{ ...INPUT, cursor: 'pointer' }}>
              <option value="MAD">درهم مغربي (MAD)</option>
              <option value="EUR">يورو (EUR)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>
          </div>

          <div>
            <label style={LABEL}>المنطقة الزمنية</label>
            <input
              type="text" value="Africa/Casablanca (UTC+1)" readOnly
              style={{ ...INPUT, color: '#6B7280', background: '#F9FAFB', fontFamily: 'Inter, monospace', direction: 'ltr', textAlign: 'right', cursor: 'default', border: '1px solid #E5E7EB' }}
            />
          </div>
        </div>

        <SaveButton
          label="حفظ التغييرات"
          saved={storeSaved} saving={storeSaving}
          onClick={() => patch({ storeName: settings.storeName, currency: settings.currency }, setStoreSaving, setStoreSaved)}
        />
      </SectionCard>

      {/* ── Section 2: WhatsApp ────────────────────────────────────────────────── */}
      <SectionCard icon="💬" title="واتساب والإشعارات" subtitle="تقارير وتنبيهات تصلك على هاتفك مباشرةً">

        {/* Master toggle */}
        <ToggleRow
          label="تفعيل واتساب"
          desc="تفعيل جميع الرسائل التلقائية عبر واتساب"
          checked={settings.whatsappEnabled}
          onChange={(v) => setSettings(s => ({ ...s, whatsappEnabled: v }))}
        />

        {/* Phone input */}
        <div style={{ padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
          <label style={LABEL}>رقم واتساب المتجر</label>
          <input
            type="tel"
            value={settings.storePhone}
            onChange={(e) => setSettings(s => ({ ...s, storePhone: e.target.value }))}
            placeholder="0612345678"
            disabled={!settings.whatsappEnabled}
            style={{ ...INPUT, direction: 'ltr', textAlign: 'right', opacity: settings.whatsappEnabled ? 1 : 0.5 }}
          />
          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', marginBottom: 0 }}>
            الرقم الذي ستُرسَل إليه التقارير والتنبيهات
          </p>
        </div>

        {/* Daily report */}
        <ToggleRow
          label="التقرير اليومي"
          desc="ملخص مبيعات اليوم يُرسَل تلقائياً كل مساء"
          checked={settings.dailyReportEnabled}
          onChange={(v) => setSettings(s => ({ ...s, dailyReportEnabled: v }))}
          disabled={!settings.whatsappEnabled}
        />

        {/* Report time — only show if daily report enabled */}
        {settings.dailyReportEnabled && settings.whatsappEnabled && (
          <div style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={LABEL}>وقت إرسال التقرير</label>
            <input
              type="time"
              value={settings.dailyReportTime}
              onChange={(e) => setSettings(s => ({ ...s, dailyReportTime: e.target.value }))}
              style={{ ...INPUT, direction: 'ltr', textAlign: 'right', width: '140px' }}
            />
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', marginBottom: 0 }}>
              الإرسال الافتراضي عند الساعة 21:00 (UTC+1)
            </p>
          </div>
        )}

        {/* Low-stock alert */}
        <ToggleRow
          label="تنبيه المخزون المنخفض"
          desc="رسالة فورية عند وصول منتج للحد الأدنى"
          checked={settings.lowStockAlert}
          onChange={(v) => setSettings(s => ({ ...s, lowStockAlert: v }))}
          disabled={!settings.whatsappEnabled}
        />

        {/* Customer receipts — SEPARATE from the merchant's own alerts above */}
        <div style={{ padding: '12px 0 4px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
            إشعارات الزبائن
          </p>
          <ToggleRow
            label="إيصالات الزبائن عبر واتساب"
            desc="إرسال وصل الشراء تلقائياً للزبون على واتساب بعد كل معاملة"
            checked={settings.customerWhatsappReceiptEnabled}
            onChange={(v) => setSettings(s => ({ ...s, customerWhatsappReceiptEnabled: v }))}
            disabled={!settings.whatsappEnabled}
          />
        </div>

        {/* WhatsApp not configured warning */}
        {settings.whatsappEnabled && !settings.storePhone && (
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px',
            padding: '10px 14px', marginTop: '12px',
            fontSize: '13px', color: '#92400E',
          }}>
            ⚠️ أدخل رقم واتساب المتجر حتى تُرسَل التنبيهات
          </div>
        )}

        <SaveButton
          label="حفظ إعدادات واتساب"
          saved={waSaved} saving={waSaving}
          onClick={() => patch({
            whatsappEnabled:                settings.whatsappEnabled,
            storePhone:                     settings.storePhone,
            dailyReportEnabled:             settings.dailyReportEnabled,
            dailyReportTime:                settings.dailyReportTime,
            lowStockAlert:                  settings.lowStockAlert,
            customerWhatsappReceiptEnabled: settings.customerWhatsappReceiptEnabled,
          }, setWaSaving, setWaSaved)}
        />
      </SectionCard>

      {/* ── Section 3: TVA & Tax ──────────────────────────────────────────────── */}
      <SectionCard icon="🏷️" title="الضريبة على القيمة المضافة (TVA)" subtitle="ضريبة TVA الافتراضية المُطبَّقة على مبيعاتك">

        <ToggleRow
          label="تفعيل TVA"
          desc="تطبيق ضريبة القيمة المضافة على الفواتير تلقائياً"
          checked={settings.taxEnabled}
          onChange={(v) => setSettings(s => ({ ...s, taxEnabled: v }))}
        />

        {settings.taxEnabled && (
          <div style={{ padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={LABEL}>نسبة TVA الافتراضية</label>
            <select
              value={settings.defaultTaxRate}
              onChange={(e) => setSettings(s => ({
                ...s,
                defaultTaxRate: parseInt(e.target.value) as 0 | 7 | 10 | 14 | 20,
              }))}
              style={{ ...INPUT, cursor: 'pointer', width: '160px' }}
            >
              {([0, 7, 10, 14, 20] as const).map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', marginBottom: 0 }}>
              النسب المعتمدة رسمياً في المغرب: 0%، 7%، 10%، 14%، 20%
            </p>
          </div>
        )}

        <SaveButton
          label="حفظ إعدادات TVA"
          saved={tvaSaved} saving={tvaSaving}
          onClick={() => patch(
            { taxEnabled: settings.taxEnabled, defaultTaxRate: settings.defaultTaxRate },
            setTvaSaving, setTvaSaved
          )}
        />
      </SectionCard>

      {/* ── Section 4: Discounts ──────────────────────────────────────────────── */}
      <SectionCard icon="🎟️" title="الخصومات" subtitle="حدود الخصومات المسموح بها في نقطة البيع">

        <ToggleRow
          label="تفعيل الخصومات"
          desc="السماح للكاشيير بمنح خصومات على الطلبات"
          checked={settings.discountEnabled}
          onChange={(v) => setSettings(s => ({ ...s, discountEnabled: v }))}
        />

        {settings.discountEnabled && (
          <div style={{ padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
            <label style={LABEL}>الحد الأقصى للخصم (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={settings.maxDiscountPercent}
                onChange={(e) => {
                  const raw = parseInt(e.target.value);
                  const clamped = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw));
                  setSettings(s => ({ ...s, maxDiscountPercent: clamped }));
                }}
                style={{ ...INPUT, direction: 'ltr', textAlign: 'right', width: '120px' }}
              />
              <span style={{ fontSize: '14px', color: '#6B7280' }}>%</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px', marginBottom: 0 }}>
              لن يتمكن الكاشيير من منح خصم يتجاوز هذه النسبة (0 = لا خصم، 100 = مفتوح)
            </p>
          </div>
        )}

        <SaveButton
          label="حفظ إعدادات الخصومات"
          saved={discountSaved} saving={discountSaving}
          onClick={() => patch(
            { discountEnabled: settings.discountEnabled, maxDiscountPercent: settings.maxDiscountPercent },
            setDiscountSaving, setDiscountSaved
          )}
        />
      </SectionCard>

      {/* ── Section 5: Receipt ────────────────────────────────────────────────── */}
      <SectionCard icon="🧾" title="إعدادات الفاتورة" subtitle="تخصيص الفواتير المطبوعة">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '8px' }}>

          <div>
            <label style={LABEL}>اسم المتجر على الفاتورة</label>
            <input
              type="text"
              value={settings.receiptHeader || settings.storeName}
              onChange={(e) => setSettings(s => ({ ...s, receiptHeader: e.target.value }))}
              placeholder={settings.storeName || 'اسم المتجر'}
              style={INPUT}
            />
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', marginBottom: 0 }}>
              يُعرض في أعلى الفاتورة — اتركه فارغاً لاستخدام اسم المتجر تلقائياً
            </p>
          </div>

          <div>
            <label style={LABEL}>رقم الهاتف على الفاتورة</label>
            <input
              type="text"
              value={settings.storePhone}
              onChange={(e) => setSettings(s => ({ ...s, storePhone: e.target.value }))}
              placeholder="06 XX XX XX XX"
              style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }}
            />
          </div>

          <div>
            <label style={LABEL}>نص تذييل الفاتورة</label>
            <input
              type="text"
              value={settings.receiptFooter}
              onChange={(e) => setSettings(s => ({ ...s, receiptFooter: e.target.value }))}
              placeholder="شكراً لزيارتكم!"
              style={INPUT}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: '1px solid #F3F4F6' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px', color: '#111827' }}>إظهار الشعار</p>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>طباعة شعار المتجر في أعلى الفاتورة</p>
            </div>
            <Toggle checked={settings.receiptShowLogo} onChange={(v) => setSettings(s => ({ ...s, receiptShowLogo: v }))} />
          </div>
        </div>

        <SaveButton
          label="حفظ إعدادات الفاتورة"
          saved={rcptSaved} saving={rcptSaving}
          onClick={() => patch({
            receiptHeader:   settings.receiptHeader,
            receiptFooter:   settings.receiptFooter,
            receiptShowLogo: settings.receiptShowLogo,
            storePhone:      settings.storePhone,
          }, setRcptSaving, setRcptSaved)}
        />
      </SectionCard>

      {/* ── Section 6: Danger zone ────────────────────────────────────────────── */}
      <div style={{
        maxWidth: '560px', background: '#FFF5F5', border: '1px solid #FECACA',
        borderRadius: '12px', padding: '32px', marginBottom: '24px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #FEE2E2',
        }}>
          <span style={{ fontSize: '28px', lineHeight: 1 }}>⚠️</span>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#991B1B' }}>منطقة الخطر</h2>
            <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0 }}>إجراءات غير قابلة للتراجع</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            {
              title: 'مسح بيانات اليوم',
              desc: 'حذف جميع مبيعات ومعاملات اليوم الحالي',
              label: 'مسح البيانات',
              confirm: 'هل أنت متأكد من مسح بيانات اليوم؟ لا يمكن التراجع.',
              action: () => { /* TODO: DELETE /api/portal/transactions?today=true */ },
            },
            {
              title: 'إعادة ضبط الإعدادات',
              desc: 'العودة للإعدادات الافتراضية',
              label: 'إعادة الضبط',
              confirm: 'هل أنت متأكد من إعادة الضبط؟',
              action: () => {
                setSettings(EMPTY_SETTINGS);
                patch(EMPTY_SETTINGS, () => {}, () => {});
              },
            },
          ].map((item) => (
            <div key={item.title} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '16px', padding: '14px 16px', background: '#FFFFFF',
              border: '1px solid #FECACA', borderRadius: '8px',
            }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px', color: '#111827' }}>{item.title}</p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{item.desc}</p>
              </div>
              <button
                onClick={() => { if (window.confirm(item.confirm)) item.action(); }}
                style={{
                  background: item.label === 'مسح البيانات' ? '#DC2626' : '#FFFFFF',
                  color: item.label === 'مسح البيانات' ? '#FFFFFF' : '#DC2626',
                  border: item.label === 'مسح البيانات' ? 'none' : '1px solid #DC2626',
                  borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
