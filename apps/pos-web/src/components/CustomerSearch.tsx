'use client';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

export interface Customer {
  customer_id:  string;
  name_ar:      string;
  name_fr:      string | null;
  phone:        string | null;
  balance:      number;
  credit_limit: number;
}

interface Props {
  token:    string;
  onSelect: (customer: Customer) => void;
  onClose:  () => void;
}

export function CustomerSearch({ token, onSelect, onClose }: Props) {
  const { t } = useLanguage();
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<Customer[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newPhone, setNewPhone] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!query.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/customers?q=${encodeURIComponent(query)}`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        setResults(res.ok ? await res.json() : []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, token]);

  async function createCustomer() {
    if (!newName.trim()) return;
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name_ar: newName.trim(),
        phone:   newPhone.trim() || null,
      }),
    });
    if (res.ok) {
      const c = await res.json() as Customer;
      onSelect(c);
    }
  }

  const balanceColor = (c: Customer) =>
    c.balance <= 0 ? '#10B981'
    : c.balance >= c.credit_limit ? '#EF4444'
    : '#F0B429';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#0F3D2A', borderRadius: '20px',
        padding: '1.5rem',
        width: '100%', maxWidth: '480px',
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        gap: '1rem',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#F0B429', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
            {t.credit.searchTitle}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.payment.close}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Search input */}
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.credit.searchPlaceholder}
          style={{
            width: '100%', padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px', color: '#fff',
            fontSize: '1rem', outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Results */}
        <div style={{
          overflowY: 'auto', flex: 1,
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          {loading && (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: '0.9rem' }}>
              {t.credit.searching}
            </p>
          )}

          {results.map(c => (
            <button key={c.customer_id} onClick={() => onSelect(c)} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '0.75rem 1rem',
              cursor: 'pointer', textAlign: 'start',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                  {c.name_ar}
                </div>
                {c.phone && (
                  <div dir="ltr" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' }}>
                    {c.phone}
                  </div>
                )}
              </div>
              <div style={{ color: balanceColor(c), fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                {c.balance > 0
                  ? `${Number(c.balance).toFixed(2)} ${t.credit.currencySuffix}`
                  : `✓ ${t.credit.balanceClear}`}
              </div>
            </button>
          ))}

          {/* Create new customer inline */}
          {!creating && query.trim() && !loading && results.length === 0 && (
            <button onClick={() => { setCreating(true); setNewName(query.trim()); }} style={{
              background: 'rgba(240,180,41,0.15)',
              border: '1px dashed #F0B429',
              borderRadius: '12px', padding: '0.75rem 1rem',
              color: '#F0B429', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem',
            }}>
              {t.credit.addNew.replace('{name}', query)}
            </button>
          )}

          {creating && (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px', padding: '1rem',
              display: 'flex', flexDirection: 'column', gap: '0.5rem',
            }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={t.credit.namePlaceholder}
                style={{
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', color: '#fff',
                  fontSize: '0.9rem', outline: 'none',
                }}
              />
              <input
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder={t.credit.phonePlaceholder}
                dir="ltr"
                style={{
                  padding: '0.6rem 0.8rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px', color: '#fff',
                  fontSize: '0.9rem', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={createCustomer} style={{
                  flex: 1, padding: '0.6rem',
                  background: '#F0B429', color: '#0A2318',
                  fontWeight: 700, border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
                }}>{t.credit.save}</button>
                <button onClick={() => setCreating(false)} style={{
                  padding: '0.6rem 1rem',
                  background: 'rgba(255,255,255,0.08)', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '0.9rem',
                }}>{t.payment.cancel}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
