'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { formatPrice } from '../lib/cart';

export interface CustomerProfile {
  customerId: string;
  phone: string;
  name: string | null;
  notes: string | null;
  totalVisits: number;
  totalSpentPiastres: number;
  loyalty: {
    enabled: boolean;
    stampsRequired: number;
    currentStamps: number;
    stampsUntilReward: number;
    rewardReady: boolean;
    rewardDescription: string | null;
  };
}

interface HistoryEntry {
  transactionId: string;
  receiptNumber: string | null;
  createdAt: string;
  totalPiastres: number;
  paymentMethod: string;
}

type ModalState = 'IDLE' | 'SEARCHING' | 'FOUND' | 'NOT_FOUND' | 'CREATING' | 'CREATED';

interface Props {
  tenantId: string;
  onCustomerSelected: (c: CustomerProfile) => void;
  onClose: () => void;
}

function PunchCard({ current, total }: { current: number; total: number }) {
  const capped = Math.min(total, 20);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: capped }).map((_, i) => (
        <span
          key={i}
          className={`text-lg leading-none ${i < current ? 'text-[#2E8B57]' : 'text-[#CBD5E1]'}`}
        >
          {i < current ? '●' : '○'}
        </span>
      ))}
    </div>
  );
}

export default function CustomerLookupModal({ tenantId, onCustomerSelected, onClose }: Props) {
  const { t, lang, dir } = useLanguage();
  const tc = t.customer;
  const [state, setState] = useState<ModalState>('IDLE');
  const [phone, setPhone] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  const handlePhoneInput = (raw: string) => {
    // Accept digits and leading zeros only
    setPhone(raw.replace(/[^\d]/g, ''));
  };

  const handleSearch = async () => {
    if (phone.length < 8) return;
    setState('SEARCHING');
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
      if (res.status === 404) {
        setState('NOT_FOUND');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CustomerProfile;
      setCustomer(data);
      // Fetch history (last 3 for preview)
      try {
        const hRes = await apiFetch(`/api/customers/${data.customerId}/history`);
        if (hRes.ok) {
          const h = (await hRes.json()) as HistoryEntry[];
          setHistory(h.slice(0, 3));
        }
      } catch {
        setHistory([]);
      }
      setState('FOUND');
    } catch {
      setErrorMsg(tc.notFound);
      setState('IDLE');
    }
  };

  const handleCreate = async () => {
    setState('CREATING');
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: nameInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CustomerProfile;
      setCustomer(data);
      setHistory([]);
      // Auto-select immediately — "Create and select" is one step.
      // Transition to CREATED for brief visual confirmation then close.
      onCustomerSelected(data);
      setState('CREATED');
    } catch {
      setErrorMsg(tc.notFound);
      setState('NOT_FOUND');
    }
  };

  const handleConfirm = () => {
    if (customer) onCustomerSelected(customer);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative" dir={dir}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
          <h2 className="text-base font-bold text-[#0F172A] font-cairo">{tc.title}</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Phone input — always visible */}
          {(state === 'IDLE' || state === 'NOT_FOUND') && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5 font-cairo">{tc.phone}</label>
                <div className="flex gap-2">
                  <input
                    ref={phoneRef}
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => handlePhoneInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={lang === 'ar' ? '06XXXXXXXX / 07XXXXXXXX' : '06XXXXXXXX / 07XXXXXXXX'}
                    className="flex-1 h-11 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] font-mono text-sm"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={phone.length < 8}
                    className="px-4 py-2 rounded-xl bg-[#2E8B57] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1A5C3A] transition-colors"
                  >
                    {tc.lookup}
                  </button>
                </div>
                {errorMsg && <p className="text-xs text-red-600 mt-1">{errorMsg}</p>}
              </div>

              {state === 'NOT_FOUND' && (
                <>
                  <div className="border-t border-[#F1F5F9] pt-4">
                    <p className="text-sm text-[#64748B] mb-3 font-cairo">{tc.notFound} — {tc.add}</p>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder={tc.name}
                        className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
                      />
                      <input
                        type="text"
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder={tc.notes}
                        className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E8B57]"
                      />
                      <button
                        onClick={handleCreate}
                        className="w-full py-2.5 rounded-xl bg-[#2E8B57] text-white text-sm font-semibold hover:bg-[#1A5C3A] transition-colors"
                      >
                        {tc.createAndSelect}
                      </button>
                    </div>
                  </div>
                  <button onClick={onClose} className="w-full text-sm text-[#64748B] hover:text-[#0F172A] py-1">
                    {tc.skip}
                  </button>
                </>
              )}

              {state === 'IDLE' && (
                <button onClick={onClose} className="w-full text-sm text-[#64748B] hover:text-[#0F172A] py-1">
                  {tc.withoutCustomer} / {tc.skip}
                </button>
              )}
            </>
          )}

          {state === 'SEARCHING' || state === 'CREATING' ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 border-2 border-[#2E8B57] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#64748B] font-cairo">
                {state === 'CREATING' ? tc.add : tc.lookup}…
              </p>
            </div>
          ) : null}

          {(state === 'FOUND' || state === 'CREATED') && customer && (
            <>
              {state === 'CREATED' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-cairo">
                  ✓ {tc.added}
                </div>
              )}

              {/* Customer card */}
              <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-[#0F172A] font-cairo">
                      {customer.name ?? customer.phone}
                    </p>
                    {customer.name && (
                      <p className="text-xs text-[#64748B] font-mono">{customer.phone}</p>
                    )}
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold text-[#2E8B57]">{customer.totalVisits} {tc.visits}</p>
                    <p className="text-xs text-[#94A3B8]">{formatPrice(customer.totalSpentPiastres)} {tc.spent}</p>
                  </div>
                </div>

                {/* Loyalty — always show punch-card; gate reward banner on enabled */}
                <div className="space-y-2">
                  {customer.loyalty.enabled && customer.loyalty.rewardReady ? (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                      <p className="text-sm font-bold text-amber-700 font-cairo">{tc.loyalty.rewardReady}</p>
                      {customer.loyalty.rewardDescription && (
                        <p className="text-xs text-amber-600 font-cairo">{customer.loyalty.rewardDescription}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className={`text-xs font-medium font-cairo ${customer.loyalty.enabled ? 'text-[#64748B]' : 'text-[#CBD5E1]'}`}>
                          {tc.loyalty.title}{!customer.loyalty.enabled && ` (${tc.loyalty.noProgram})`}
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          {customer.loyalty.currentStamps}/{customer.loyalty.stampsRequired} {tc.loyalty.stamps}
                        </p>
                      </div>
                      <PunchCard
                        current={customer.loyalty.currentStamps}
                        total={customer.loyalty.stampsRequired}
                      />
                      {customer.loyalty.enabled && (
                        <p className="text-xs text-[#94A3B8] mt-1 font-cairo">
                          {customer.loyalty.stampsUntilReward} {tc.loyalty.stampsUntil}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* History preview */}
                {history.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#64748B] mb-1.5 font-cairo">{tc.history}</p>
                    <div className="space-y-1">
                      {history.map((h) => (
                        <div key={h.transactionId} className="flex justify-between text-xs text-[#94A3B8]">
                          <span>{new Date(h.createdAt).toLocaleDateString(
                            lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB',
                            { day: 'numeric', month: 'short' }
                          )}</span>
                          <span className="font-mono text-[#64748B]">{formatPrice(h.totalPiastres)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {history.length === 0 && state === 'FOUND' && (
                  <p className="text-xs text-[#94A3B8] font-cairo">{tc.noHistory}</p>
                )}
              </div>

              {/* Action buttons */}
              {state === 'CREATED' ? (
                // Customer was auto-selected on creation — just close.
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-[#2E8B57] text-white text-sm font-semibold hover:bg-[#1A5C3A] transition-colors"
                >
                  {tc.done}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F8FAFC]"
                  >
                    {tc.cancel}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-2.5 rounded-xl bg-[#2E8B57] text-white text-sm font-semibold hover:bg-[#1A5C3A] transition-colors"
                  >
                    {tc.confirm}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
