'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ─────────────────────────────────────────────────────────────────────
type EmployeeRole = 'cashier' | 'manager' | 'owner';
interface Employee {
  id: string;
  name: string;
  loginId: string;
  role: EmployeeRole;
  phone?: string;
  isActive: boolean;
  totalSales: number;
  txCount: number;
  lastLoginAt?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function roleLabel(r: EmployeeRole) {
  const m: Record<EmployeeRole, string> = { cashier: 'كاشير', manager: 'مدير', owner: 'مالك' };
  return m[r] ?? r;
}
function roleColors(r: EmployeeRole): { bg: string; text: string } {
  const m: Record<EmployeeRole, { bg: string; text: string }> = {
    cashier: { bg: '#DBEAFE', text: '#1D4ED8' },
    manager: { bg: '#FEF3C7', text: '#92400E' },
    owner:   { bg: '#EDE9FE', text: '#5B21B6' },
  };
  return m[r] ?? { bg: '#F3F4F6', text: '#374151' };
}
function fmt(n: number) {
  return `MAD ${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? '') + (parts[1][0] ?? '');
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const pinInputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '24px', fontFamily: 'monospace', color: '#111827', background: '#FFFFFF',
  outline: 'none', textAlign: 'center', letterSpacing: '8px', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};
const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box', direction: 'rtl',
  fontFamily: 'inherit', background: '#FFFFFF',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const router = useRouter();

  // ── List state ──
  const [employees,    setEmployees]    = useState<Employee[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // ── Add modal ──
  const [addOpen,       setAddOpen]       = useState(false);
  const [fName,         setFName]         = useState('');
  const [fLoginId,      setFLoginId]      = useState('');
  const [fPhone,        setFPhone]        = useState('');
  const [fRole,         setFRole]         = useState<EmployeeRole>('cashier');
  const [fPin,          setFPin]          = useState('');
  const [fPinConfirm,   setFPinConfirm]   = useState('');
  const [addErrors,     setAddErrors]     = useState<Record<string, string>>({});
  const [addSaving,     setAddSaving]     = useState(false);

  // ── PIN change modal ──
  const [pinTarget,    setPinTarget]    = useState<Employee | null>(null);
  const [newPin,       setNewPin]       = useState('');
  const [confirmPin,   setConfirmPin]   = useState('');
  const [pinError,     setPinError]     = useState('');
  const [pinSaving,    setPinSaving]    = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(() => {
    setLoading(true);
    const qs = showInactive ? '?includeInactive=true' : '';
    fetch(`/api/portal/employees${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push('/portal/login'); return; }
        if (res.ok) {
          const d = await res.json();
          setEmployees(d.employees ?? []);
        }
      })
      .catch(() => {/* handled */})
      .finally(() => setLoading(false));
  }, [showInactive, router]);

  useEffect(() => {
    void (async () => { fetchEmployees(); })();
  }, [fetchEmployees]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAddOpen(false); setPinTarget(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  function openAdd() {
    setFName(''); setFLoginId(''); setFPhone(''); setFRole('cashier'); setFPin(''); setFPinConfirm('');
    setAddErrors({});
    setAddOpen(true);
  }

  // Auto-generate loginId from name
  function onNameChange(v: string) {
    setFName(v);
    if (!fLoginId) {
      const slug = v.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 10);
      if (slug) setFLoginId(slug + Math.floor(Math.random() * 90 + 10));
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const errs: Record<string, string> = {};
    if (!fName.trim())             errs.name    = 'الاسم مطلوب';
    if (!fLoginId.trim())          errs.loginId = 'معرف الدخول مطلوب';
    if (!/^\d{4,6}$/.test(fPin))  errs.pin     = 'PIN يجب أن يكون 4–6 أرقام';
    else if (fPin !== fPinConfirm) errs.pinConfirm = 'رمزا PIN غير متطابقَين';
    if (Object.keys(errs).length) { setAddErrors(errs); return; }

    setAddSaving(true);
    try {
      const res = await fetch('/api/portal/employees', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fName.trim(), loginId: fLoginId.trim(), pin: fPin, role: fRole, phone: fPhone.trim() || undefined }),
      });
      const d = await res.json();
      if (res.status === 409) { setAddErrors({ loginId: 'معرف الدخول مستخدم بالفعل' }); return; }
      if (!res.ok)            { setAddErrors({ name: d.error ?? 'فشل الإضافة' }); return; }
      setAddOpen(false);
      showToast('تم إضافة الموظف ✓');
      fetchEmployees();
    } finally { setAddSaving(false); }
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`هل تريد حذف "${emp.name}"؟`)) return;
    const res = await fetch(`/api/portal/employees/${emp.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('تم حذف الموظف'); fetchEmployees(); }
    else showToast('فشل الحذف');
  }

  async function handleSavePin() {
    if (!pinTarget) return;
    if (!/^\d{4,6}$/.test(newPin))  { setPinError('PIN يجب أن يكون 4–6 أرقام'); return; }
    if (newPin !== confirmPin)        { setPinError('رموز PIN غير متطابقة'); return; }
    setPinSaving(true);
    try {
      const res = await fetch(`/api/portal/employees/${pinTarget.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin }),
      });
      if (!res.ok) { setPinError('فشل تحديث PIN'); return; }
      setPinTarget(null);
      showToast(`تم تحديث PIN لـ ${pinTarget.name} ✓`);
    } finally { setPinSaving(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1000px', color: '#111827' }}>
      <PortalBreadcrumb current="الموظفون" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>الموظفون</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            {loading ? 'جارٍ التحميل...' : `${employees.length} موظف`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            إظهار غير النشطين
          </label>
          <button onClick={openAdd} style={{ background: '#0F3D2A', color: '#FFFFFF', fontWeight: 600, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + إضافة موظف
          </button>
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {[0, 1].map(i => <div key={i} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', height: '280px' }} />)}
        </div>
      ) : employees.length === 0 ? (
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '60px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>لا يوجد موظفون بعد</h3>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 20px' }}>أضف أول موظف لتفعيل نظام تسجيل الدخول بـ PIN</p>
          <button onClick={openAdd} style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
            + إضافة موظف
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {employees.map(emp => {
            const colors = roleColors(emp.role);
            return (
              <div key={emp.id} style={{ background: '#FFFFFF', border: `1px solid ${emp.isActive ? '#E5E7EB' : '#FCA5A5'}`, borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: emp.isActive ? 1 : 0.65 }}>
                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#0F3D2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#F0B429', fontWeight: 700, fontSize: '16px' }}>{getInitials(emp.name)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '16px', margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: colors.bg, color: colors.text, borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>{roleLabel(emp.role)}</span>
                      {!emp.isActive && <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 500 }}>معطّل</span>}
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  <InfoRow label="معرف الدخول"         value={emp.loginId}         mono />
                  {emp.phone && <InfoRow label="الهاتف"              value={emp.phone} />}
                  <InfoRow label="إجمالي المبيعات"   value={fmt(emp.totalSales)}  bold />
                  <InfoRow label="عدد الفواتير"       value={String(emp.txCount)}  />
                  {emp.lastLoginAt && (
                    <InfoRow label="آخر دخول" value={new Date(emp.lastLoginAt).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })} />
                  )}
                </div>

                {/* PIN row */}
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 6px', fontWeight: 500 }}>رمز PIN</p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[0,1,2,3].map(d => <div key={d} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0F3D2A' }} />)}
                    </div>
                  </div>
                  <button onClick={() => { setPinTarget(emp); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                    style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit', fontWeight: 500 }}>
                    تغيير PIN
                  </button>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleDelete(emp)}
                    style={{ flex: 1, background: 'none', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '8px', fontSize: '13px', cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit', fontWeight: 500 }}>
                    {emp.isActive ? 'إلغاء التفعيل' : 'حذف نهائي'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add employee modal ── */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '520px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 51, direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827' }}>إضافة موظف جديد</h3>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>الاسم الكامل *</label>
                <input type="text" value={fName} onChange={e => onNameChange(e.target.value)}
                  placeholder="مثال: فاطمة الزهراء"
                  style={{ ...fieldStyle, borderColor: addErrors.name ? '#EF4444' : '#D1D5DB' }} />
                {addErrors.name && <p style={{ fontSize: '12px', color: '#EF4444', margin: '4px 0 0' }}>{addErrors.name}</p>}
              </div>
              <div>
                <label style={labelStyle}>معرف الدخول * <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(يُستخدم في شاشة PIN)</span></label>
                <input type="text" value={fLoginId} onChange={e => setFLoginId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="fatima01"
                  style={{ ...fieldStyle, direction: 'ltr', textAlign: 'right', borderColor: addErrors.loginId ? '#EF4444' : '#D1D5DB' }} />
                {addErrors.loginId && <p style={{ fontSize: '12px', color: '#EF4444', margin: '4px 0 0' }}>{addErrors.loginId}</p>}
              </div>
              <div>
                <label style={labelStyle}>رقم الهاتف</label>
                <input type="tel" value={fPhone} onChange={e => setFPhone(e.target.value)}
                  placeholder="0612345678" dir="ltr"
                  style={{ ...fieldStyle, textAlign: 'right' }} />
              </div>
              <div>
                <label style={labelStyle}>الدور الوظيفي *</label>
                <select value={fRole} onChange={e => setFRole(e.target.value as EmployeeRole)}
                  style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="cashier">كاشير</option>
                  <option value="manager">مدير</option>
                  <option value="owner">مالك</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>رمز PIN (4–6 أرقام) *</label>
                <input type="password" inputMode="numeric" maxLength={6} value={fPin}
                  onChange={e => { setFPin(e.target.value.replace(/\D/g, '')); setAddErrors(p => ({ ...p, pin: '' })); }}
                  placeholder="••••"
                  style={{ ...pinInputStyle, borderColor: addErrors.pin ? '#EF4444' : '#D1D5DB' }} />
                {addErrors.pin && <p style={{ fontSize: '12px', color: '#EF4444', margin: '4px 0 0', textAlign: 'center' }}>{addErrors.pin}</p>}
              </div>
              <div>
                <label style={labelStyle}>تأكيد رمز PIN *</label>
                <input type="password" inputMode="numeric" maxLength={6} value={fPinConfirm}
                  onChange={e => { setFPinConfirm(e.target.value.replace(/\D/g, '')); setAddErrors(p => ({ ...p, pinConfirm: '' })); }}
                  placeholder="••••"
                  style={{ ...pinInputStyle, borderColor: addErrors.pinConfirm ? '#EF4444' : '#D1D5DB' }} />
                {addErrors.pinConfirm && <p style={{ fontSize: '12px', color: '#EF4444', margin: '4px 0 0', textAlign: 'center' }}>{addErrors.pinConfirm}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleAdd} disabled={addSaving}
                style={{ background: addSaving ? '#1a5c3a' : '#0F3D2A', color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '11px 24px', cursor: addSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                {addSaving ? 'جارٍ الإضافة...' : 'إضافة الموظف'}
              </button>
              <button onClick={() => setAddOpen(false)} style={{ background: '#FFFFFF', color: '#374151', fontWeight: 500, border: '1px solid #E5E7EB', borderRadius: '8px', padding: '11px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </>
      )}

      {/* ── PIN change modal ── */}
      {pinTarget && (
        <>
          <div onClick={() => setPinTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 51, direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827', lineHeight: 1.3 }}>
                تغيير رمز PIN<br />
                <span style={{ fontSize: '14px', color: '#6B7280', fontWeight: 400 }}>{pinTarget.name}</span>
              </h3>
              <button onClick={() => setPinTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>رمز PIN الجديد (4–6 أرقام)</label>
                <input type="password" inputMode="numeric" maxLength={6} value={newPin}
                  onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder="••••" style={pinInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>تأكيد PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                  placeholder="••••" style={pinInputStyle} />
              </div>
            </div>
            {pinError && <p style={{ fontSize: '13px', color: '#DC2626', margin: '0 0 16px', textAlign: 'center' }}>{pinError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSavePin} disabled={pinSaving}
                style={{ background: '#0F3D2A', color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                {pinSaving ? '...' : 'حفظ PIN'}
              </button>
              <button onClick={() => setPinTarget(null)} style={{ background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', background: '#0F3D2A', color: '#FFFFFF', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 500, zIndex: 60, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────
function InfoRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: bold ? 600 : 500, color: '#111827', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}
