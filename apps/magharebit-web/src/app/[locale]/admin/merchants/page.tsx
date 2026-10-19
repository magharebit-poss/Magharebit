// ADMIN AUTH: the password is verified server-side (POST /api/admin/login, compared to ADMIN_SECRET)
// and the browser only holds an HttpOnly session cookie. No secret exists in client code.
// Still a single shared password: replace with per-user auth before many admins use this.

'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/brand/Logo'

// ── Types ─────────────────────────────────────────────────────────────────────

type MerchantStatus = 'pending' | 'approved' | 'suspended'
type LicensePlan    = 'Starter' | 'Business' | 'Enterprise'

interface Merchant {
  id:                string
  phone:             string
  email?:            string
  storeName:         string
  sector:            string
  city:              string
  locale:            string
  createdAt:         string
  status:            MerchantStatus
  plan?:             LicensePlan
  subscriptionEndsAt?: string
  approvedAt?:       string
}

interface License {
  id:            string
  key:           string
  plan:          LicensePlan
  durationMonths: number
  issuedAt:      string
  expiresAt:     string
  status:        'active' | 'expired' | 'revoked'
}

interface ApproveResult {
  merchant:  Merchant
  license:   License
  whatsapp:  { sent: boolean; messageId?: string; error?: string }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLANS: { value: LicensePlan; labelAr: string; price: string }[] = [
  { value: 'Starter',    labelAr: 'ستارتر',    price: '249 درهم/شهر' },
  { value: 'Business',   labelAr: 'بيزنس',     price: '499 درهم/شهر' },
  { value: 'Enterprise', labelAr: 'إنتربرايز', price: 'مخصص' },
]

const DURATIONS: { months: number; label: string }[] = [
  { months: 1,  label: 'شهر'    },
  { months: 3,  label: '3 أشهر' },
  { months: 6,  label: '6 أشهر' },
  { months: 12, label: 'سنة'    },
  { months: 24, label: 'سنتان'  },
]

const SECTOR_LABELS: Record<string, string> = {
  'cafe-restaurant': 'كافيه / مطعم',
  'epicerie':        'بقالة / ماركت',
  'boulangerie':     'مخبزة',
  'boucherie':       'جزارة',
  'pharmacie':       'صيدلية',
  'textile':         'ملابس',
  'electronique':    'إلكترونيات',
  'other':           'أخرى',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ status }: { status: MerchantStatus }) {
  const cfg = {
    pending:   { bg: '#FEF3C7', text: '#92400E', label: 'بانتظار الموافقة' },
    approved:  { bg: '#DCFCE7', text: '#166534', label: 'موافق عليه' },
    suspended: { bg: '#FEE2E2', text: '#991B1B', label: 'موقوف' },
  }[status]
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>
      {cfg.label}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} title="نسخ" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '2px 4px', color: copied ? '#22C55E' : '#9CA3AF' }}>
      {copied ? '✓' : '📋'}
    </button>
  )
}

function EmptyRow({ msg }: { msg: string }) {
  return (
    <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>{msg}</td></tr>
  )
}

// ── Approve modal ─────────────────────────────────────────────────────────────

interface ApproveModalProps {
  merchant:     Merchant
  onClose:      () => void
  onApproved:   (result: ApproveResult, merchant: Merchant) => void
}

function ApproveModal({ merchant, onClose, onApproved }: ApproveModalProps) {
  const [plan, setPlan]         = useState<LicensePlan>('Business')
  const [months, setMonths]     = useState(12)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}/approve`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, durationMonths: months }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'فشل — حاول مجددًا'); return }
      onApproved(data as ApproveResult, merchant)
    } catch {
      setError('خطأ في الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#FFFFFF', borderRadius: '16px', padding: '32px',
        width: '460px', maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 50, direction: 'rtl',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>موافقة على التسجيل</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF', lineHeight: 1 }}>✕</button>
        </div>

        {/* Merchant info */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{merchant.storeName}</div>
          <div style={{ fontSize: '13px', color: '#6B7280' }}>
            📱 {merchant.phone}
            {merchant.email && <> · 📧 {merchant.email}</>}
            {' · '}{merchant.city}
            {' · '}{SECTOR_LABELS[merchant.sector] ?? merchant.sector}
          </div>
        </div>

        {/* Plan selector */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>الخطة</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PLANS.map(p => (
              <label key={p.value} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                border: `2px solid ${plan === p.value ? '#0F3D2A' : '#E5E7EB'}`,
                borderRadius: '8px', cursor: 'pointer',
                background: plan === p.value ? '#F0FDF4' : '#FFFFFF',
                transition: 'all 0.15s',
              }}>
                <input type="radio" name="plan" value={p.value} checked={plan === p.value} onChange={() => setPlan(p.value)} style={{ accentColor: '#0F3D2A' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827', flex: 1 }}>{p.value} — {p.labelAr}</span>
                <span style={{ fontSize: '12px', color: '#6B7280', fontFamily: 'monospace' }}>{p.price}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Duration selector */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>مدة الاشتراك</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {DURATIONS.map(d => (
              <button key={d.months} onClick={() => setMonths(d.months)}
                style={{
                  padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  border: `2px solid ${months === d.months ? '#0F3D2A' : '#E5E7EB'}`,
                  background: months === d.months ? '#0F3D2A' : '#FFFFFF',
                  color: months === d.months ? '#FFFFFF' : '#374151',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={submit} disabled={loading} style={{
            flex: 1, background: loading ? '#9CA3AF' : '#0F3D2A', color: '#FFFFFF',
            border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px',
            fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'جارٍ الموافقة...' : '✅ موافقة وإرسال عبر واتساب'}
          </button>
          <button onClick={onClose} style={{
            flex: 1, background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB',
            borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            إلغاء
          </button>
        </div>
      </div>
    </>
  )
}

// ── Approval result card ──────────────────────────────────────────────────────

function ApprovalResult({ result, onClose }: { result: ApproveResult; onClose: () => void }) {
  const expDate = new Date(result.license.expiresAt).toLocaleDateString('ar-MA', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#FFFFFF', borderRadius: '16px', padding: '32px',
        width: '460px', maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 50, direction: 'rtl',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#166534', margin: 0 }}>تمت الموافقة بنجاح</h3>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '6px 0 0' }}>{result.merchant.storeName}</p>
        </div>

        {/* License key */}
        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔑 مفتاح الترخيص</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <code style={{
              flex: 1, fontSize: '15px', fontFamily: 'monospace', color: '#0A2318',
              background: '#FFFFFF', padding: '10px 12px', borderRadius: '6px',
              border: '1px solid #D1FAE5', letterSpacing: '0.04em', direction: 'ltr', textAlign: 'left',
            }}>
              {result.license.key}
            </code>
            <CopyBtn text={result.license.key} />
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'الخطة',      value: result.license.plan },
            { label: 'المدة',      value: `${result.license.durationMonths} شهر` },
            { label: 'تاريخ الانتهاء', value: expDate },
            { label: 'الحالة',     value: result.license.status === 'active' ? 'نشط ✅' : result.license.status },
          ].map(item => (
            <div key={item.label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600, marginBottom: '2px' }}>{item.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* WhatsApp delivery status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: result.whatsapp.sent ? '#DCFCE7' : '#FEF3C7',
          color:      result.whatsapp.sent ? '#166534'  : '#92400E',
          marginBottom: '20px',
        }}>
          {result.whatsapp.sent
            ? <>✅ تم إرسال المفتاح عبر واتساب</>
            : <>⚠️ لم يُرسَل عبر واتساب — أرسله يدويًا<br /><span style={{ fontWeight: 400, fontSize: '11px', wordBreak: 'break-all' }}>{result.whatsapp.error}</span></>
          }
        </div>

        <button onClick={onClose} style={{
          width: '100%', background: '#0F3D2A', color: '#FFFFFF', border: 'none',
          borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          إغلاق
        </button>
      </div>
    </>
  )
}

// ── Revoke confirm ─────────────────────────────────────────────────────────────

interface RevokeConfirmProps {
  merchant:    Merchant
  onClose:     () => void
  onRevoked:   (id: string) => void
}

function RevokeConfirm({ merchant, onClose, onRevoked }: RevokeConfirmProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'admin_dashboard', notify: true }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'فشل'); return }
      onRevoked(merchant.id)
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 40 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#FFFFFF', borderRadius: '16px', padding: '28px 32px',
        width: '400px', maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 50, direction: 'rtl',
      }}>
        <div style={{ fontSize: '32px', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', textAlign: 'center', marginBottom: '10px' }}>
          إيقاف ترخيص المتجر
        </h3>
        <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', lineHeight: 1.5, marginBottom: '20px' }}>
          سيتم إيقاف <strong style={{ color: '#111827' }}>{merchant.storeName}</strong> وإلغاء مفتاح الترخيص.
          البرنامج سيُقفَل عند التحقق التالي.
        </p>
        {error && <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '10px', textAlign: 'center' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={submit} disabled={loading} style={{
            flex: 1, background: loading ? '#9CA3AF' : '#EF4444', color: '#FFFFFF',
            border: 'none', borderRadius: '8px', padding: '10px',
            fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'جارٍ الإيقاف...' : 'نعم، إيقاف'}
          </button>
          <button onClick={onClose} style={{
            flex: 1, background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB',
            borderRadius: '8px', padding: '10px', fontSize: '14px',
            fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            إلغاء
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminMerchantsPage() {
  const pathname = usePathname()
  const locale   = pathname.split('/')[1] ?? 'ar'

  // ── Auth state ───────────────────────────────────────────────────────────────
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword]           = useState('')
  const [authError, setAuthError]         = useState('')

  // ── Data state ───────────────────────────────────────────────────────────────
  const [merchants, setMerchants]   = useState<Merchant[]>([])
  const [loading, setLoading]       = useState(false)
  const [fetchError, setFetchError] = useState('')

  // ── Sub-tab ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MerchantStatus>('pending')

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [approving, setApproving]   = useState<Merchant | null>(null)
  const [revoking, setRevoking]     = useState<Merchant | null>(null)
  const [lastResult, setLastResult] = useState<ApproveResult | null>(null)

  const fetchMerchants = useCallback(async () => {
    setLoading(true); setFetchError('')
    try {
      const res = await fetch('/api/admin/merchants?limit=200')
      if (res.status === 401) { setAuthenticated(false); return } // session expired
      if (!res.ok) { setFetchError('خطأ في الاتصال بالخادم'); return }
      const data = await res.json()
      setMerchants(data.merchants ?? [])
    } catch {
      setFetchError('تعذّر تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [])

  // Restore an existing admin session (HttpOnly cookie) after a reload.
  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => {
        if (r.ok) {
          setAuthenticated(true)
          void fetchMerchants()
        }
      })
      .catch(() => {})
  }, [fetchMerchants])

  // Escape closes modals
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setApproving(null); setRevoking(null); setLastResult(null)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const login = async () => {
    setAuthError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setPassword('')
        setAuthenticated(true)
        void fetchMerchants()
      } else if (res.status === 429) {
        setAuthError('محاولات كثيرة، حاول لاحقاً')
      } else if (res.status === 503) {
        setAuthError('لوحة الإدارة غير مهيأة على الخادم')
      } else {
        setAuthError('كلمة المرور غير صحيحة')
      }
    } catch {
      setAuthError('تعذّر الاتصال بالخادم')
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const pending   = merchants.filter(m => m.status === 'pending')
  const approved  = merchants.filter(m => m.status === 'approved')
  const suspended = merchants.filter(m => m.status === 'suspended')
  const displayed = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : suspended

  const onApproved = (result: ApproveResult, orig: Merchant) => {
    setMerchants(prev =>
      prev.map(m => m.id === orig.id ? result.merchant : m)
    )
    setApproving(null)
    setLastResult(result)
  }

  const onRevoked = (id: string) => {
    setMerchants(prev =>
      prev.map(m => m.id === id ? { ...m, status: 'suspended' as MerchantStatus } : m)
    )
    setRevoking(null)
    setActiveTab('suspended')
  }

  // ── Password gate ─────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '40px 36px', width: '100%', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', direction: 'rtl' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', justifyContent: 'center' }}>
            <Logo height={28} on="light" variant="horizontal" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 24px' }}>إدارة المشتركين</h1>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>كلمة المرور</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="••••••••"
            style={{ width: '100%', padding: '10px 14px', border: authError ? '1px solid #EF4444' : '1px solid #D1D5DB', borderRadius: '8px', fontSize: '15px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
          {authError && <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 12px' }}>{authError}</p>}
          <button onClick={login} style={{ width: '100%', background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginTop: authError ? '0' : '8px' }}>دخول</button>
        </div>
      </main>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: '#F8F9FA', padding: '32px 24px', direction: 'rtl' }}>

      {/* Modals */}
      {approving && <ApproveModal merchant={approving} onClose={() => setApproving(null)} onApproved={onApproved} />}
      {revoking  && <RevokeConfirm merchant={revoking} onClose={() => setRevoking(null)} onRevoked={onRevoked} />}
      {lastResult && <ApprovalResult result={lastResult} onClose={() => setLastResult(null)} />}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Top nav tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#E5E7EB', borderRadius: '10px', padding: '4px', marginBottom: '28px', width: 'fit-content' }}>
          {([
            { href: `/${locale}/admin/leads`,     label: 'العملاء المحتملون' },
            { href: `/${locale}/admin/licenses`,  label: 'التراخيص' },
            { href: `/${locale}/admin/merchants`, label: 'المشتركون', active: true },
          ] as const).map(tab => (
            'active' in tab && tab.active
              ? <span key={tab.label} style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: '#111827' }}>{tab.label}</span>
              : <Link key={tab.label} href={tab.href} style={{ padding: '8px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', color: '#6B7280', textDecoration: 'none' }}>{tab.label}</Link>
          ))}
        </div>

        {/* Page header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>المشتركون</h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              {pending.length} بانتظار الموافقة · {approved.length} موافق عليهم · {suspended.length} موقوفون
            </p>
          </div>
          <button onClick={() => void fetchMerchants()}
            style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            تحديث
          </button>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'بانتظار الموافقة', count: pending.length,   icon: '⏳', color: '#92400E', bg: '#FEF3C7' },
            { label: 'موافق عليهم',      count: approved.length,  icon: '✅', color: '#166534', bg: '#DCFCE7' },
            { label: 'موقوفون',          count: suspended.length, icon: '🚫', color: '#991B1B', bg: '#FEE2E2' },
          ].map(card => (
            <div key={card.label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{card.icon}</span>
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{card.count}</div>
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid #E5E7EB', marginBottom: '20px' }}>
          {([
            { key: 'pending',   label: 'بانتظار الموافقة', count: pending.length },
            { key: 'approved',  label: 'موافق عليهم',      count: approved.length },
            { key: 'suspended', label: 'موقوفون',          count: suspended.length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                color: activeTab === tab.key ? '#0F3D2A' : '#6B7280',
                borderBottom: `2px solid ${activeTab === tab.key ? '#0F3D2A' : 'transparent'}`,
                marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{ background: activeTab === tab.key ? '#0F3D2A' : '#9CA3AF', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {fetchError && <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#991B1B', fontSize: '14px' }}>{fetchError}</div>}

        {/* Table */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>جاري التحميل...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['المتجر', 'الاتصال', 'المدينة / القطاع', 'تاريخ التسجيل',
                    activeTab === 'approved' ? 'الخطة / الانتهاء' : 'الحالة',
                    'إجراء'].map((col, i) => (
                    <th key={i} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0
                  ? <EmptyRow msg={activeTab === 'pending' ? 'لا يوجد تجار بانتظار الموافقة' : activeTab === 'approved' ? 'لا يوجد تجار موافق عليهم بعد' : 'لا يوجد تجار موقوفون'} />
                  : displayed.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < displayed.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    {/* Store name */}
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '14px', color: '#111827' }}>{m.storeName}</td>

                    {/* Contact */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                      <div style={{ direction: 'ltr', textAlign: 'right' }}>{m.phone}</div>
                      {m.email && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{m.email}</div>}
                    </td>

                    {/* City / Sector */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>
                      <div>{m.city}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{SECTOR_LABELS[m.sector] ?? m.sector}</div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                      {new Date(m.createdAt).toLocaleDateString('ar-MA')}
                    </td>

                    {/* Plan / Status */}
                    <td style={{ padding: '14px 16px' }}>
                      {activeTab === 'approved' && m.plan
                        ? (
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{m.plan}</span>
                            {m.subscriptionEndsAt && (
                              <div style={{ fontSize: '11px', color: '#9CA3AF', direction: 'ltr', textAlign: 'right' }}>
                                {new Date(m.subscriptionEndsAt).toLocaleDateString('ar-MA')}
                              </div>
                            )}
                          </div>
                        )
                        : <Badge status={m.status} />
                      }
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px' }}>
                      {m.status === 'pending' && (
                        <button onClick={() => setApproving(m)}
                          style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '7px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          موافقة ←
                        </button>
                      )}
                      {m.status === 'approved' && (
                        <button onClick={() => setRevoking(m)}
                          style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: '7px', padding: '6px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          إيقاف
                        </button>
                      )}
                      {m.status === 'suspended' && (
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>موقوف</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  )
}
