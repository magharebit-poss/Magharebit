'use client';
import { useEffect, useState } from 'react';
import { type Customer } from './CustomerSearch';
import { useLanguage } from '../context/LanguageContext';

interface TxRow {
  tx_id:        string;
  type:         string;
  amount:       number;
  balance_after: number;
  note:         string | null;
  created_at:   string;
}

interface Props {
  customer:        Customer;
  token:           string;
  onClose:         () => void;
  onCharge:        (customerId: string, amount: number) => Promise<void>;
  onPayment:       (customerId: string, amount: number) => Promise<void>;
  onBalanceUpdate: (newBalance: number) => void;
}

export function CustomerTab({
  customer, token, onClose,
  onCharge, onPayment, onBalanceUpdate,
}: Props) {
  const { t, lang } = useLanguage();
  const [amount,  setAmount]  = useState('');
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [txs,     setTxs]     = useState<TxRow[]>([]);
  const [showTxs, setShowTxs] = useState(false);
  const [isRisk,  setIsRisk]  = useState(false);

  const dateLocale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';

  // Check credit risk segment on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/analytics/customer-segments?segment=credit_risk`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = await res.json() as { segments: Array<{ customerId: string }> };
        setIsRisk(
          (data.segments ?? []).some((s) => s.customerId === customer.customer_id),
        );
      } catch { /* best-effort */ }
    })();
  }, [customer.customer_id, token]);

  const balanceColor =
    customer.balance <= 0   ? '#10B981'
    : customer.balance >= customer.credit_limit ? '#EF4444'
    : '#F0B429';

  async function loadTxs() {
    const res = await fetch(
      `/api/customers/${customer.customer_id}/transactions`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (res.ok) setTxs(await res.json() as TxRow[]);
    setShowTxs(true);
  }

  async function handleAction(type: 'charge' | 'payment') {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError(t.credit.errorInvalidAmount); return; }
    setLoading(true); setError('');
    try {
      const url = `/api/customers/${customer.customer_id}/${type}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ amount: amt, note }),
      });
      const data = await res.json() as { balance?: number; error?: string; credit_limit?: number };
      if (!res.ok) {
        if (data.error === 'credit_limit_exceeded') {
          setError(t.credit.errorLimitExceeded.replace('{n}', String(data.credit_limit ?? '')));
        } else {
          setError(data.error ?? t.credit.errorGeneric);
        }
        return;
      }
      onBalanceUpdate(data.balance ?? customer.balance);
      setAmount('');
      setNote('');
      if (showTxs) loadTxs();
      // delegate to parent for any cart-level logic
      if (type === 'charge') await onCharge(customer.customer_id, amt);
      else await onPayment(customer.customer_id, amt);
    } finally {
      setLoading(false);
    }
  }

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
        width: '100%', maxWidth: '440px',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', gap: '1rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.2rem' }}>
              {customer.name_ar}
            </h2>
            {customer.phone && (
              <p dir="ltr" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', margin: 0 }}>
                {customer.phone}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '1.5rem', cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Balance display */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: '12px',
          padding: '1rem', textAlign: 'center',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: '0 0 0.25rem' }}>
            {t.credit.balanceLabel}
          </p>
          <p style={{
            color: balanceColor, fontSize: '2rem',
            fontWeight: 800, margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.abs(Number(customer.balance)).toFixed(2)}
            <span style={{ fontSize: '0.9rem', fontWeight: 400, marginInlineEnd: '0.35rem' }}>
              {t.credit.currencySuffix}
            </span>
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
            {t.credit.limitLabel.replace('{n}', String(customer.credit_limit))}
          </p>
        </div>

        {/* Credit risk banner */}
        {isRisk && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', padding: '0.5rem 1rem',
            color: '#FCA5A5', fontSize: '0.8rem',
            marginBottom: '0.5rem',
          }}>
            ⚠️ {t.credit.riskBanner}
          </div>
        )}

        {/* Amount input */}
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={t.credit.amountPlaceholder}
          min="0" step="0.5"
          dir="ltr"
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '12px', color: '#fff',
            fontSize: '1.1rem', outline: 'none',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t.credit.notePlaceholder}
          style={{
            padding: '0.6rem 1rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px', color: '#fff',
            fontSize: '0.9rem', outline: 'none',
          }}
        />

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px', padding: '0.6rem 1rem',
            color: '#FCA5A5', fontSize: '0.85rem',
          }}>{error}</div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleAction('charge')}
            disabled={loading}
            style={{
              flex: 1, padding: '0.85rem',
              background: '#EF4444', color: '#fff',
              fontWeight: 700, border: 'none',
              borderRadius: '12px', cursor: 'pointer',
              fontSize: '0.95rem', opacity: loading ? 0.6 : 1,
            }}>
            {t.credit.chargeBtn}
          </button>
          <button
            onClick={() => handleAction('payment')}
            disabled={loading}
            style={{
              flex: 1, padding: '0.85rem',
              background: '#10B981', color: '#fff',
              fontWeight: 700, border: 'none',
              borderRadius: '12px', cursor: 'pointer',
              fontSize: '0.95rem', opacity: loading ? 0.6 : 1,
            }}>
            {t.credit.payBtn}
          </button>
        </div>

        {/* Transaction history toggle */}
        <button
          onClick={showTxs ? () => setShowTxs(false) : loadTxs}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', padding: '0.5rem',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: '0.8rem',
          }}>
          {showTxs ? t.credit.hideHistory : t.credit.showHistory}
        </button>

        {showTxs && (
          <div style={{
            maxHeight: '160px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '0.35rem',
          }}>
            {txs.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center' }}>
                {t.credit.noTransactions}
              </p>
            )}
            {txs.map(tx => (
              <div key={tx.tx_id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '0.4rem 0.6rem',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '6px', fontSize: '0.78rem',
              }}>
                <span style={{ color: tx.type === 'payment' ? '#10B981' : '#EF4444' }}>
                  {tx.type === 'payment' ? `↩ ${t.credit.txPayment}` : `↪ ${t.credit.txCharge}`}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(tx.created_at).toLocaleDateString(dateLocale)}
                </span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  {Math.abs(Number(tx.amount)).toFixed(2)} {t.credit.currencySuffix}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
