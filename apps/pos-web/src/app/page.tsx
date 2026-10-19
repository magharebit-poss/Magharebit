'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Staff } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import { LANGS } from '../lib/i18n';
import { apiFetch, setToken } from '../lib/api';
import { getMerchantBranding } from '../lib/branding';
import { pickName } from '../lib/names';
import { BrandEmblem } from '../components/brand/BrandEmblem';
import { ZelligeBackdrop } from '../components/brand/ZelligeBackdrop';

export default function ShiftOpenPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  // Merchant name resolved from the license response (cached in sessionStorage).
  // Initialised from cache so it shows immediately on revisits; updated after the
  // boot() license fetch so first-load shows the correct name once it arrives.
  // 'Magharebit' is the SSR-safe initial value (matches what getMerchantBranding()
  // returns on the server where sessionStorage is unavailable).  The useEffect
  // below immediately hydrates from the sessionStorage cache on the client so
  // returning users see their store name without waiting for the license fetch.
  // Using getMerchantBranding() directly in the lazy initializer caused a
  // hydration mismatch: server → 'Magharebit', client → 'Dev Store'.
  const [merchantName, setMerchantName] = useState<string>('Magharebit');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [pin, setPin] = useState<string>('');
  const [openingFloat, setOpeningFloat] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [pinReady, setPinReady] = useState(false);
  // Non-null = license invalid/expired → block login UI entirely.
  const [licenseBlockedStatus, setLicenseBlockedStatus] = useState<string | null>(null);
  const [devRole, setDevRole] = useState('');

  useEffect(() => {
    // Immediately hydrate from sessionStorage cache on mount (client-only).
    // This fires before the async license fetch so returning users see their
    // store name right away without a visible 'Magharebit' → real-name flash.
    setMerchantName(getMerchantBranding().name);

    let cancelled = false;
    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';

    async function boot() {
      // 1) License gate. The backend is the real enforcement point; here we
      //    only read status to show a clear message. Fail OPEN on any error.
      try {
        const lr = await apiFetch('/api/license/status', {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        if (lr.ok) {
          const ls = (await lr.json()) as { valid?: boolean; status?: string; merchantName?: string };
          // Cache for merchant branding (receipts) on later screens.
          try {
            sessionStorage.setItem('greengo_license_status', JSON.stringify(ls));
            // Refresh the displayed merchant name from the now-populated cache.
            setMerchantName(getMerchantBranding().name);
          } catch {}
          if (!cancelled && ls.valid === false) {
            setLicenseBlockedStatus(ls.status ?? 'invalid');
            setLoading(false);
            return; // do not load the cashier list, do not allow login
          }
        }
      } catch {
        // network/backend error → fail open, proceed to login
      }

      // 2) Tenant-scoped cashier bootstrap list.
      try {
        const r = await apiFetch(
          `/api/staff/login-options?tenantId=${encodeURIComponent(tenantId)}`,
          { skipAuth: true },
        );
        if (!r.ok) throw new Error('staff fetch failed');
        const data = (await r.json()) as Staff[];
        if (!cancelled) setStaff(data);
      } catch {
        if (!cancelled) setStaff([{ staff_id: 'cccc0001-0001-0001-0001-000000000001', name_ar: 'كاشير اختبار', name_fr: 'Caissier Test', role: 'CASHIER' }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
    // intentionally no t in deps — error message captured at fetch time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKey = (key: string) => {
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) setPinReady(true);
  };

  const handleStartShift = async () => {
    if (!selectedStaff || pin.length !== 4) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaff.staff_id,
          pin,
          openingFloat: openingFloat ? Math.round(Number(openingFloat) * 100) : 0,
        }),
        skipAuth: true,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t.shift.errorOpen);
      }
      const data = (await res.json()) as { shiftId: string; tenantId?: string; token: string };
      // Store the JWT first so all subsequent /api/* calls are authenticated.
      setToken(data.token);
      sessionStorage.setItem('greengo_shift_id', data.shiftId);
      sessionStorage.setItem('greengo_cashier_name', selectedStaff.name_ar);
      sessionStorage.setItem('greengo_cashier_id', selectedStaff.staff_id);
      const roleToStore = (process.env.NODE_ENV !== 'production' && devRole) ? devRole : selectedStaff.role;
      sessionStorage.setItem('greengo_cashier_role', roleToStore);
      if (data.tenantId) sessionStorage.setItem('greengo_tenant_id', data.tenantId);
      router.push('/pos');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.shift.errorUnknown);
      setPin('');
      setPinReady(false);
    } finally {
      setSubmitting(false);
    }
  };

  const cashierName = (s: Staff): string => pickName(lang, s.name_ar, s.name_fr);

  // ── License gate: block the whole login screen when the backend reports
  //    the logiciel is not activated / expired / revoked. ────────────────
  if (licenseBlockedStatus !== null) {
    const supportContact = process.env.NEXT_PUBLIC_SUPPORT_CONTACT ?? 'support@example.com';
    return (
      <main className="relative overflow-hidden min-h-screen flex items-center justify-center p-6 bg-brand-950">
        <ZelligeBackdrop />
        <div className="relative z-10 w-full max-w-md bg-brand-900 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] border border-white/10 p-8 text-center">
          <div className="flex justify-center mb-4">
            <BrandEmblem variant="onDark" height={64} alt={t.brand.logoAlt} />
          </div>
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">
            {t.shift.licenseTitle}
          </h1>
          <p className="text-sm text-white/60 mb-4">
            {t.shift.licenseBody}
          </p>
          <div className="text-xs text-white/40 font-mono border-t border-white/10 pt-3">
            <p>{t.shift.licenseSupport}: {supportContact}</p>
            <p className="mt-1">({licenseBlockedStatus})</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden min-h-screen flex items-center justify-center p-6 bg-brand-950">
      <ZelligeBackdrop />
      <div className="relative z-10 w-full max-w-2xl bg-brand-900 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.5)] border border-white/10 p-8">
        {/* Language toggle */}
        <div className="absolute top-4 start-4 flex gap-1 bg-brand-950/60 p-1 rounded-lg border border-white/15">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                lang === l.code ? 'bg-gold-400 text-brand-950' : 'text-white/70 hover:text-white'
              }`}
            >
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex justify-center mb-4">
          <BrandEmblem variant="onDark" height={84} glow alt={t.brand.logoAlt} />
        </div>
        <h1 className="text-3xl font-bold text-center mb-1 text-white">{merchantName}</h1>
        <p className="text-sm text-white/60 text-center mb-8">{t.shift.subtitle}</p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-400/30 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        {loading && <p className="text-center text-white/50">{t.shift.loading}</p>}

        {!loading && !selectedStaff && (
          <>
            <p className="text-sm font-semibold text-white mb-3">{t.shift.selectCashier}</p>
            <div className="grid grid-cols-2 gap-3">
              {staff.map((s) => (
                <button
                  key={s.staff_id}
                  onClick={() => setSelectedStaff(s)}
                  className="bg-brand-950/60 border border-white/10 rounded-xl p-4 text-start hover:border-gold-400 hover:shadow-md transition-all"
                >
                  <div className="font-semibold text-white">{cashierName(s)}</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    {lang === 'ar' ? s.name_fr : s.name_ar}
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-medium bg-gold-400/15 text-gold-400 px-2 py-0.5 rounded-full">
                    {t.shift.role[s.role as 'CASHIER' | 'MANAGER' | 'SUPERVISOR'] ?? s.role}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && selectedStaff && !pinReady && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-white/60">{t.shift.cashierLabel}</p>
                <p className="font-semibold text-white">{cashierName(selectedStaff)}</p>
              </div>
              <button
                onClick={() => { setSelectedStaff(null); setPin(''); }}
                className="text-xs text-white/60 hover:text-white underline"
              >
                {t.shift.changeCashier}
              </button>
            </div>

            <p className="text-sm font-semibold text-white text-center mb-4">{t.shift.enterPin}</p>

            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-gold-400' : 'bg-white/20'}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {['1','2','3','4','5','6','7','8','9'].map((k) => (
                <button
                  key={k}
                  onClick={() => handleKey(k)}
                  className="w-16 h-16 rounded-xl bg-brand-950/60 border border-white/15 text-xl font-bold text-white hover:bg-white/10 hover:border-gold-400 transition-all duration-150 mx-auto"
                >
                  {k}
                </button>
              ))}
              <button
                onClick={() => handleKey('del')}
                className="w-16 h-16 rounded-xl bg-brand-950/60 border border-white/15 text-xl font-bold text-white/70 hover:bg-red-500/20 transition-all duration-150 mx-auto"
              >
                ⌫
              </button>
              <button
                onClick={() => handleKey('0')}
                className="w-16 h-16 rounded-xl bg-brand-950/60 border border-white/15 text-xl font-bold text-white hover:bg-white/10 hover:border-gold-400 transition-all duration-150 mx-auto"
              >
                0
              </button>
              <button
                onClick={() => setPin('')}
                className="w-16 h-16 rounded-xl bg-brand-950/60 border border-white/15 text-sm font-medium text-white/70 hover:bg-red-500/20 transition-all duration-150 mx-auto"
              >
                {t.shift.clear}
              </button>
            </div>
          </>
        )}

        {!loading && selectedStaff && pinReady && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-white/60">{t.shift.cashierLabel}</p>
                <p className="font-semibold text-white">{cashierName(selectedStaff)}</p>
              </div>
              <button
                onClick={() => { setPin(''); setPinReady(false); }}
                className="text-xs text-white/60 hover:text-white underline"
              >
                {t.shift.editPin}
              </button>
            </div>

            <label className="block text-sm font-semibold text-white mb-2">{t.shift.openingFloat}</label>
            <div className="relative mb-6">
              <input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 px-4 rounded-xl bg-brand-950/60 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent text-lg font-mono"
              />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-white/60 pointer-events-none">MAD</span>
            </div>

            <button
              onClick={handleStartShift}
              disabled={submitting}
              className="w-full bg-gold-400 hover:bg-gold-500 text-brand-950 font-bold py-3.5 rounded-xl text-lg transition-colors duration-150 disabled:opacity-50"
            >
              {submitting ? t.shift.starting : t.shift.startShift}
            </button>

            {process.env.NODE_ENV !== 'production' && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <select
                  value={devRole}
                  onChange={(e) => setDevRole(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#1A1A1A',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="">Role from database</option>
                  <option value="CASHIER">CASHIER</option>
                  <option value="SENIOR_CASHIER">SENIOR_CASHIER</option>
                  <option value="INVENTORY">INVENTORY</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="OWNER">OWNER</option>
                </select>
                <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '0.68rem', marginTop: '0.3rem' }}>
                  Dev mode only
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

