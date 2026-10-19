'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { BrandLockup } from '../../components/brand/BrandLockup';
import { pickName } from '../../lib/names';
import { formatMoney } from '../../lib/format';

type Tab = 'overview' | 'stock' | 'transfers';

interface BranchOverview {
  store_id:          string;
  name_ar:           string;
  name_fr:           string;
  is_active:         boolean;
  today_revenue_mad: string | number;
  today_tx:          number;
  open_shifts:       number;
  staff_count:       number;
}

interface StockStore { store_id: string; name_ar: string; name_fr: string; stock: string | number; low: boolean }
interface StockRow {
  product_id: string;
  name_ar:    string;
  name_fr:    string;
  uom:        string;
  stores:     StockStore[];
}

interface Transfer {
  transfer_id:     string;
  quantity:        string | number;
  unit:            string;
  status:          'pending' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  from_name_ar:    string;
  from_name_fr:    string;
  to_name_ar:      string;
  to_name_fr:      string;
  product_name_ar: string;
  product_name_fr: string;
  requested_at:    string;
}

const ALLOWED_ROLES = ['SUPERVISOR', 'OWNER'];

const STATUS_COLOR: Record<Transfer['status'], string> = {
  pending:    'rgba(245,158,11,0.9)',
  approved:   'rgba(59,130,246,0.9)',
  in_transit: 'rgba(168,85,247,0.9)',
  received:   'rgba(16,185,129,0.9)',
  cancelled:  'rgba(107,114,128,0.9)',
};

const card = {
  background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '1rem 1.25rem',
} as const;

const inputStyle = {
  padding: '0.55rem 0.7rem', background: '#0A2318', border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '10px', color: '#fff', fontSize: '0.88rem', outline: 'none',
} as const;

export default function BranchesPage() {
  const router = useRouter();
  const { t, lang, dir } = useLanguage();
  const tb = t.branches;

  const [token, setToken]         = useState('');
  const [tab, setTab]             = useState<Tab>('overview');
  const [overview, setOverview]   = useState<BranchOverview[]>([]);
  const [stock, setStock]         = useState<StockRow[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError]         = useState('');
  const [busy, setBusy]           = useState(false);

  const [formFor, setFormFor]     = useState<string | null>(null);
  const [fromStore, setFromStore] = useState('');
  const [toStore, setToStore]     = useState('');
  const [qty, setQty]             = useState('');

  useEffect(() => {
    const tk = sessionStorage.getItem('greengo_token') ?? localStorage.getItem('greengo_token') ?? '';
    const role = sessionStorage.getItem('greengo_cashier_role') ?? '';
    if (!tk) { router.replace('/'); return; }
    if (!ALLOWED_ROLES.includes(role)) { router.replace('/pos'); return; }
    setToken(tk);
  }, [router]);

  const get = useCallback(async <T,>(path: string): Promise<T | null> => {
    try {
      const res = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  }, [token]);

  const loadOverview = useCallback(async () => {
    const data = await get<BranchOverview[]>('/api/branches/overview');
    if (data) { setOverview(data); setError(''); } else setError(tb.errorLoad);
  }, [get, tb.errorLoad]);

  const loadStock = useCallback(async () => {
    const data = await get<StockRow[]>('/api/branches/stock-comparison');
    if (data) { setStock(data); setError(''); } else setError(tb.errorLoad);
  }, [get, tb.errorLoad]);

  const loadTransfers = useCallback(async () => {
    const data = await get<Transfer[]>('/api/branches/transfers');
    if (data) { setTransfers(data); setError(''); } else setError(tb.errorLoad);
  }, [get, tb.errorLoad]);

  useEffect(() => {
    if (!token) return;
    if (tab === 'overview') {
      void loadOverview();
      const interval = setInterval(() => void loadOverview(), 60_000);
      return () => clearInterval(interval);
    }
    if (tab === 'stock') { void loadStock(); void loadOverview(); }
    if (tab === 'transfers') void loadTransfers();
  }, [token, tab, loadOverview, loadStock, loadTransfers]);

  const activeStores = overview.filter((b) => b.is_active);
  const totalRevenue = overview.reduce((s, b) => s + Number(b.today_revenue_mad), 0);
  const totalShifts  = overview.reduce((s, b) => s + b.open_shifts, 0);

  async function submitTransfer(productId: string) {
    setError('');
    if (!fromStore || !toStore || fromStore === toStore) { setError(tb.errorSameStore); return; }
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) { setError(tb.errorSave); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/branches/transfers', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from_store_id: fromStore, to_store_id: toStore, product_id: productId, quantity: n }),
      });
      if (!res.ok) { setError(tb.errorSave); return; }
      setFormFor(null); setQty('');
      setTab('transfers');
    } catch {
      setError(tb.errorSave);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: 'approved' | 'received' | 'cancelled') {
    setBusy(true);
    try {
      const res = await fetch(`/api/branches/transfers/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await loadTransfers();
      if (!res.ok) setError(tb.errorSave);
    } catch {
      setError(tb.errorSave);
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'overview',  label: tb.tabOverview },
    { key: 'stock',     label: tb.tabStock },
    { key: 'transfers', label: tb.tabTransfers },
  ];

  const stockColor = (s: StockStore) =>
    Number(s.stock) <= 0 ? '#FCA5A5' : s.low ? '#FCD34D' : '#fff';

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0A2318', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        background: '#0F3D2A', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
          <BrandLockup height={32} alt={t.brand.logoAlt} />
          <h1 style={{ color: '#F0B429', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>🏪 {tb.title}</h1>
        </div>
        <button
          onClick={() => {
            if (tab === 'overview') void loadOverview();
            else if (tab === 'stock') void loadStock();
            else void loadTransfers();
          }}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', color: '#fff', padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.82rem',
          }}
        >↻ {tb.refresh}</button>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); }}
              style={{
                padding: '0.55rem 1.1rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                background: tab === key ? '#F0B429' : 'rgba(255,255,255,0.06)',
                color: tab === key ? '#0A2318' : 'rgba(255,255,255,0.7)',
                border: tab === key ? '1px solid #F0B429' : '1px solid rgba(255,255,255,0.15)',
              }}
            >{label}</button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
            padding: '0.6rem 1rem', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: '1rem',
          }}>{error}</div>
        )}

        {tab === 'overview' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ ...card, flex: 1, minWidth: '220px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', margin: 0 }}>{tb.totalRevenue}</p>
                <p style={{ color: '#F0B429', fontWeight: 800, fontSize: '1.5rem', margin: '0.25rem 0 0' }}>
                  {formatMoney(totalRevenue, lang)}
                </p>
              </div>
              <div style={{ ...card, flex: 1, minWidth: '160px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', margin: 0 }}>{tb.activeShifts}</p>
                <p style={{ color: '#6EE7B7', fontWeight: 800, fontSize: '1.5rem', margin: '0.25rem 0 0' }}>{totalShifts}</p>
              </div>
            </div>

            {overview.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{tb.noBranches}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {overview.map((b) => (
                  <div key={b.store_id} style={{ ...card, opacity: b.is_active ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{pickName(lang, b.name_ar, b.name_fr)}</span>
                      {!b.is_active && (
                        <span style={{ color: '#FCA5A5', fontSize: '0.7rem' }}>{tb.inactiveBranch}</span>
                      )}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', margin: 0 }}>{tb.todayRevenue}</p>
                    <p style={{ color: '#F0B429', fontWeight: 800, fontSize: '1.25rem', margin: '0.1rem 0 0.6rem' }}>
                      {formatMoney(Number(b.today_revenue_mad), lang)}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{tb.transactions}: <b style={{ color: '#fff' }}>{b.today_tx}</b></span>
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>{tb.staff}: <b style={{ color: '#fff' }}>{b.staff_count}</b></span>
                      <span style={{
                        borderRadius: '999px', padding: '0.05rem 0.55rem', fontWeight: 700,
                        background: b.open_shifts > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                        color: b.open_shifts > 0 ? '#6EE7B7' : 'rgba(255,255,255,0.5)',
                      }}>{tb.activeShifts}: {b.open_shifts}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'stock' && (
          <>
            <p style={{ color: '#FCD34D', fontSize: '0.78rem', marginTop: 0 }}>ℹ️ {tb.stockNotice}</p>
            {stock.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{tb.noProducts}</p>
            ) : (
              <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'start' }}>
                      <th style={{ padding: '0.7rem 1rem', textAlign: 'start' }}>{tb.product}</th>
                      {(stock[0]?.stores ?? []).map((s) => (
                        <th key={s.store_id} style={{ padding: '0.7rem 0.75rem', textAlign: 'end' }}>
                          {pickName(lang, s.name_ar, s.name_fr)}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((p) => (
                      <Fragment key={p.product_id}>
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '0.6rem 1rem', color: '#fff', fontWeight: 600 }}>
                            {pickName(lang, p.name_ar, p.name_fr)}
                          </td>
                          {p.stores.map((s) => (
                            <td key={s.store_id} style={{ padding: '0.6rem 0.75rem', textAlign: 'end', color: stockColor(s), fontWeight: 700 }}>
                              {Number(s.stock)} <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>{p.uom}</span>
                            </td>
                          ))}
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'end' }}>
                            <button
                              onClick={() => {
                                setFormFor(formFor === p.product_id ? null : p.product_id);
                                setFromStore(''); setToStore(''); setQty(''); setError('');
                              }}
                              style={{
                                background: 'rgba(240,180,41,0.15)', border: '1px solid rgba(240,180,41,0.4)',
                                color: '#F0B429', borderRadius: '8px', padding: '0.35rem 0.7rem', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap',
                              }}
                            >{tb.transfer}</button>
                          </td>
                        </tr>
                        {formFor === p.product_id && (
                          <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <td colSpan={p.stores.length + 2} style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <select value={fromStore} onChange={(e) => setFromStore(e.target.value)} style={inputStyle} aria-label={tb.fromStore}>
                                  <option value="">{tb.fromStore}</option>
                                  {activeStores.map((b) => (
                                    <option key={b.store_id} value={b.store_id}>{pickName(lang, b.name_ar, b.name_fr)}</option>
                                  ))}
                                </select>
                                <select value={toStore} onChange={(e) => setToStore(e.target.value)} style={inputStyle} aria-label={tb.toStore}>
                                  <option value="">{tb.toStore}</option>
                                  {activeStores.map((b) => (
                                    <option key={b.store_id} value={b.store_id}>{pickName(lang, b.name_ar, b.name_fr)}</option>
                                  ))}
                                </select>
                                <input
                                  type="number" min="0" step="0.001" dir="ltr"
                                  value={qty} onChange={(e) => setQty(e.target.value)}
                                  placeholder={tb.quantity} style={{ ...inputStyle, width: '110px' }}
                                />
                                <button
                                  onClick={() => void submitTransfer(p.product_id)}
                                  disabled={busy}
                                  style={{
                                    background: '#F0B429', color: '#0A2318', fontWeight: 800, border: 'none',
                                    borderRadius: '10px', padding: '0.55rem 1.1rem', cursor: 'pointer',
                                  }}
                                >{tb.submit}</button>
                                <button
                                  onClick={() => setFormFor(null)}
                                  style={{
                                    background: 'transparent', color: 'rgba(255,255,255,0.6)',
                                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px',
                                    padding: '0.55rem 1rem', cursor: 'pointer',
                                  }}
                                >{tb.cancel}</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'transfers' && (
          transfers.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{tb.noTransfers}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {transfers.map((tr) => {
                const open = tr.status === 'pending' || tr.status === 'approved' || tr.status === 'in_transit';
                return (
                  <div key={tr.transfer_id} style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>
                        {pickName(lang, tr.product_name_ar, tr.product_name_fr)} · {Number(tr.quantity)} {tr.unit}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                        {pickName(lang, tr.from_name_ar, tr.from_name_fr)} {dir === 'rtl' ? '←' : '→'} {pickName(lang, tr.to_name_ar, tr.to_name_fr)}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{
                        background: STATUS_COLOR[tr.status], color: '#fff', borderRadius: '999px',
                        padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700,
                      }}>{tb.status[tr.status]}</span>
                      {tr.status === 'pending' && (
                        <button disabled={busy} onClick={() => void changeStatus(tr.transfer_id, 'approved')}
                          style={{ background: '#F0B429', color: '#0A2318', fontWeight: 800, border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
                          {tb.approve}
                        </button>
                      )}
                      {(tr.status === 'approved' || tr.status === 'in_transit') && (
                        <button disabled={busy} onClick={() => void changeStatus(tr.transfer_id, 'received')}
                          style={{ background: '#10B981', color: '#fff', fontWeight: 800, border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
                          {tb.markReceived}
                        </button>
                      )}
                      {open && (
                        <button disabled={busy} onClick={() => void changeStatus(tr.transfer_id, 'cancelled')}
                          style={{ background: 'transparent', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
                          {tb.cancelTransfer}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}
