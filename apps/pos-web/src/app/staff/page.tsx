'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';

const ROLES = ['CASHIER', 'SENIOR_CASHIER', 'INVENTORY', 'MANAGER', 'SUPERVISOR'] as const;
type RoleKey = (typeof ROLES)[number];

const ROLE_COLOR: Record<string, string> = {
  CASHIER:        'rgba(107,114,128,0.9)',
  SENIOR_CASHIER: 'rgba(59,130,246,0.9)',
  INVENTORY:      'rgba(16,185,129,0.9)',
  MANAGER:        'rgba(240,180,41,0.9)',
  SUPERVISOR:     'rgba(239,68,68,0.9)',
  OWNER:          'rgba(168,85,247,0.9)',
};

interface StaffMember {
  staff_id:  string;
  name_ar:   string;
  name_fr:   string | null;
  role:      string;
  is_active: boolean;
}

type Mode = 'list' | 'add' | 'edit';

export default function StaffPage() {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const ts = t.staff;

  const [token,   setToken]   = useState('');
  const [staff,   setStaff]   = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode,    setMode]    = useState<Mode>('list');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const [nameAr,  setNameAr]  = useState('');
  const [nameFr,  setNameFr]  = useState('');
  const [role,    setRole]    = useState<RoleKey>('CASHIER');
  const [pin,     setPin]     = useState('');
  const [pinConf, setPinConf] = useState('');

  useEffect(() => {
    const t = sessionStorage.getItem('greengo_token') ?? localStorage.getItem('greengo_token') ?? '';
    const r = sessionStorage.getItem('greengo_cashier_role') ?? '';
    if (!t) { router.replace('/'); return; }
    if (!['MANAGER', 'SUPERVISOR', 'OWNER'].includes(r)) { router.replace('/pos'); return; }
    setToken(t);
  }, [router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/staff/manage', { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) setStaff((await res.json()) as StaffMember[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setNameAr(''); setNameFr(''); setRole('CASHIER'); setPin(''); setPinConf('');
    setError(''); setSuccess('');
    setMode('add');
  }

  function openEdit(s: StaffMember) {
    setEditing(s);
    setNameAr(s.name_ar); setNameFr(s.name_fr ?? ''); setRole((ROLES.includes(s.role as RoleKey) ? s.role : 'CASHIER') as RoleKey);
    setPin(''); setPinConf('');
    setError(''); setSuccess('');
    setMode('edit');
  }

  async function handleSave() {
    setError(''); setSuccess('');
    if (!nameAr.trim()) { setError(ts.errorNameRequired); return; }
    if (mode === 'add') {
      if (pin.length < 4) { setError(ts.errorPinLength); return; }
      if (pin !== pinConf) { setError(ts.errorPinMismatch); return; }
    }
    if (mode === 'edit' && pin && pin !== pinConf) { setError(ts.errorPinMismatch); return; }

    try {
      const body: Record<string, unknown> = { name_ar: nameAr.trim(), name_fr: nameFr.trim() || null, role };
      if (pin) body.pin = pin;

      const url    = mode === 'add' ? '/api/staff/manage' : `/api/staff/manage/${editing!.staff_id}`;
      const method = mode === 'add' ? 'POST' : 'PATCH';

      const res  = await fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? ts.errorSave); return; }

      setSuccess(mode === 'add' ? ts.successAdd : ts.successEdit);
      await load();
      setTimeout(() => { setMode('list'); setSuccess(''); }, 1200);
    } catch {
      setError(ts.errorConnection);
    }
  }

  async function toggleActive(s: StaffMember) {
    await fetch(`/api/staff/manage/${s.staff_id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    await load();
  }

  const roleLabel = (r: string) => (ts.roles as Record<string, string>)[r] ?? r;

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0A2318', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        background: '#0F3D2A', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 2rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.push('/pos')}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.6)', padding: '0.4rem 0.8rem',
              cursor: 'pointer', fontSize: '0.82rem',
            }}
          >← POS</button>
          <h1 style={{ color: '#F0B429', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
            👥 {ts.title}
          </h1>
        </div>
        {mode === 'list' && (
          <button
            onClick={openAdd}
            style={{
              background: '#F0B429', color: '#0A2318', fontWeight: 700, border: 'none',
              borderRadius: '10px', padding: '0.5rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >{ts.addNew}</button>
        )}
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {mode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {loading && <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{ts.loading}</p>}
            {!loading && staff.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{ts.noStaff}</p>
            )}
            {staff.map((s) => (
              <div key={s.staff_id} style={{
                background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', opacity: s.is_active ? 1 : 0.5,
              }}>
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{s.name_ar}</p>
                  {s.name_fr && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: '0.15rem 0 0' }}>{s.name_fr}</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    background: ROLE_COLOR[s.role] ?? 'rgba(107,114,128,0.9)', color: '#fff',
                    borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700,
                  }}>{roleLabel(s.role)}</span>
                  <button
                    onClick={() => openEdit(s)}
                    style={{
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px', color: '#fff', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
                    }}
                  >{ts.editButton}</button>
                  <button
                    onClick={() => void toggleActive(s)}
                    style={{
                      background: s.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                      border: `1px solid ${s.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      borderRadius: '8px', color: s.is_active ? '#FCA5A5' : '#6EE7B7',
                      padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
                    }}
                  >{s.is_active ? ts.deactivate : ts.activate}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(mode === 'add' || mode === 'edit') && (
          <div style={{
            background: '#0F3D2A', borderRadius: '20px', padding: '1.75rem',
            border: '1px solid rgba(255,255,255,0.08)', maxWidth: '480px', margin: '0 auto',
          }}>
            <h2 style={{ color: '#F0B429', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
              {mode === 'add' ? ts.addTitle : `${ts.editPrefix}${editing?.name_ar}`}
            </h2>

            {([
              { label: ts.nameArLabel, value: nameAr, set: setNameAr, dir: 'rtl' as const },
              { label: ts.nameFrLabel, value: nameFr, set: setNameFr, dir: 'ltr' as const },
            ]).map((f) => (
              <div key={f.label} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  {f.label}
                </label>
                <input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  dir={f.dir}
                  style={{
                    width: '100%', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                    color: '#fff', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                {ts.roleLabel}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: role === r ? (ROLE_COLOR[r] ?? 'rgba(107,114,128,0.9)') : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${role === r ? (ROLE_COLOR[r] ?? 'rgba(107,114,128,0.9)') : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: '999px', color: '#fff', cursor: 'pointer',
                      fontSize: '0.82rem', fontWeight: role === r ? 700 : 400,
                    }}
                  >{ts.roles[r]}</button>
                ))}
              </div>
            </div>

            {[
              { label: mode === 'edit' ? ts.pinNew : ts.pinLabel, value: pin, set: setPin, extra: {} },
              {
                label: ts.pinConfirm, value: pinConf, set: setPinConf,
                extra: { border: `1px solid ${pinConf && pin !== pinConf ? '#EF4444' : 'rgba(255,255,255,0.15)'}` },
              },
            ].map((f) => (
              <div key={f.label} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  {f.label}
                </label>
                <input
                  type="password"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  dir="ltr"
                  style={{
                    width: '100%', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.07)',
                    borderRadius: '10px', color: '#fff', fontSize: '1.2rem', outline: 'none',
                    letterSpacing: '0.3em', textAlign: 'center', boxSizing: 'border-box',
                    border: '1px solid rgba(255,255,255,0.15)',
                    ...f.extra,
                  }}
                />
              </div>
            ))}

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '0.6rem 1rem', color: '#FCA5A5',
                fontSize: '0.85rem', marginBottom: '1rem',
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '8px', padding: '0.6rem 1rem', color: '#6EE7B7',
                fontSize: '0.85rem', marginBottom: '1rem',
              }}>{success}</div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => void handleSave()}
                style={{
                  flex: 1, padding: '0.85rem', background: '#F0B429', color: '#0A2318',
                  fontWeight: 700, border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem',
                }}
              >{mode === 'add' ? ts.addButton : ts.saveButton}</button>
              <button
                onClick={() => setMode('list')}
                style={{
                  padding: '0.85rem 1.25rem', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem',
                }}
              >{ts.cancelButton}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
