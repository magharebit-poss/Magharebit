'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

type OrderStatus =
  | 'new'
  | 'reviewing'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

type FulfillmentType = 'pickup' | 'delivery';
type PaymentMethod = 'cash_on_delivery' | 'virement' | 'tpe';

interface WhatsAppOrder {
  order_id: string;
  customer_phone: string;
  customer_name: string | null;
  raw_message: string;
  received_at: string;
  fulfillment_type: FulfillmentType;
  delivery_address: string | null;
  delivery_notes: string | null;
  scheduled_at: string | null;
  payment_method: PaymentMethod;
  payment_received: boolean;
  status: OrderStatus;
  notes: string | null;
  store_name: string | null;
  assignee_name: string | null;
  transaction_id: string | null;
}

type FilterTab = 'all' | 'new' | 'in_progress' | 'done';

const ACTIVE_STATUSES: OrderStatus[] = ['new', 'reviewing', 'confirmed', 'preparing', 'ready'];
const DONE_STATUSES: OrderStatus[] = ['completed', 'cancelled'];

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  reviewing: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ['reviewing', 'confirmed', 'cancelled'],
  reviewing: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface OrderCardProps {
  order: WhatsAppOrder;
  t: Record<string, string>;
  onClick: () => void;
}

function OrderCard({ order, t, onClick }: OrderCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#94A3B8] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">
              {order.customer_name ?? order.customer_phone}
            </span>
            <span className="text-xs text-[#64748B] shrink-0">{relativeTime(order.received_at)}</span>
          </div>
          <p className="text-xs text-[#64748B] truncate mt-0.5">{order.raw_message}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
              {t[order.status] ?? order.status}
            </span>
            <span className="text-xs text-[#94A3B8]">
              {order.fulfillment_type === 'delivery' ? '🚚' : '🏪'}
            </span>
            {order.payment_received && (
              <span className="text-xs text-green-600">✓</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface OrderDetailProps {
  order: WhatsAppOrder;
  t: Record<string, string>;
  onBack: () => void;
  onUpdated: (updated: WhatsAppOrder) => void;
}

const KDS_ENABLED = process.env['NEXT_PUBLIC_KDS_ENABLED'] === 'true';

function OrderDetail({ order, t, onBack, onUpdated }: OrderDetailProps) {
  const [notes, setNotes] = useState(order.notes ?? '');
  const [address, setAddress] = useState(order.delivery_address ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [kdsState, setKdsState] = useState<'idle' | 'sending' | 'sent' | 'existing' | 'error'>('idle');
  const [kdsError, setKdsError] = useState('');

  const patch = useCallback(
    async (fields: Partial<WhatsAppOrder>) => {
      try {
        const res = await apiFetch(`/api/orders/${order.order_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        if (res.ok) {
          const data = (await res.json()) as WhatsAppOrder;
          onUpdated(data);
        }
      } catch {
        // silent — UI stays optimistic
      }
    },
    [order.order_id, onUpdated],
  );

  const canTransition = STATUS_TRANSITIONS[order.status];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-[#E2E8F0]">
        <button onClick={onBack} className="text-[#3B82F6] text-sm font-medium">
          ← {t.backToList}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Header */}
        <div>
          <p className="font-semibold">{order.customer_name ?? order.customer_phone}</p>
          <p className="text-xs text-[#64748B]">{order.customer_phone}</p>
        </div>

        {/* Raw message */}
        <div>
          <p className="text-xs font-medium text-[#64748B] mb-1">{t.customerMessage}</p>
          <p className="text-sm bg-[#F8FAFC] rounded-lg p-2 border border-[#E2E8F0] whitespace-pre-wrap">
            {order.raw_message}
          </p>
        </div>

        {/* Status */}
        <div>
          <p className="text-xs font-medium text-[#64748B] mb-1">{t.statusLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {canTransition.map((s) => (
              <button
                key={s}
                onClick={() => patch({ status: s })}
                className="text-xs px-2 py-1 rounded-full border border-[#E2E8F0] hover:bg-[#F1F5F9]"
              >
                → {t[s] ?? s}
              </button>
            ))}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status]}`}>
              {t[order.status] ?? order.status}
            </span>
          </div>
        </div>

        {/* Fulfillment */}
        <div>
          <p className="text-xs font-medium text-[#64748B] mb-1">{t.fulfillmentLabel}</p>
          <div className="flex gap-2">
            {(['pickup', 'delivery'] as FulfillmentType[]).map((f) => (
              <button
                key={f}
                onClick={() => patch({ fulfillment_type: f })}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  order.fulfillment_type === f
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white border-[#E2E8F0]'
                }`}
              >
                {f === 'pickup' ? '🏪' : '🚚'} {t[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {order.fulfillment_type === 'delivery' && (
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1">{t.deliveryAddress}</p>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => patch({ delivery_address: address })}
              rows={2}
              className="w-full text-sm border border-[#E2E8F0] rounded-lg p-2 resize-none focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        )}

        {/* Payment */}
        <div>
          <p className="text-xs font-medium text-[#64748B] mb-1">{t.paymentLabel}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(['cash_on_delivery', 'virement', 'tpe'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => patch({ payment_method: m })}
                className={`text-xs px-2 py-1 rounded-lg border ${
                  order.payment_method === m
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white border-[#E2E8F0]'
                }`}
              >
                {t[m === 'cash_on_delivery' ? 'cashOnDelivery' : m]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={order.payment_received}
              onChange={(e) => patch({ payment_received: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">{t.paymentReceived}</span>
          </label>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs font-medium text-[#64748B] mb-1">{t.notes}</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => patch({ notes })}
            rows={2}
            className="w-full text-sm border border-[#E2E8F0] rounded-lg p-2 resize-none focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-[#E2E8F0] space-y-2">
        {/* Send to KDS — only shown when KDS is enabled and order is actionable */}
        {KDS_ENABLED &&
          (order.status === 'confirmed' || order.status === 'preparing') &&
          kdsState !== 'sent' &&
          kdsState !== 'existing' && (
            <button
              disabled={kdsState === 'sending'}
              onClick={async () => {
                setKdsState('sending');
                setKdsError('');
                try {
                  const res = await apiFetch(
                    `/api/kds/orders/from-whatsapp/${order.order_id}`,
                    { method: 'POST' },
                  );
                  if (!res.ok) {
                    const d = (await res.json()) as { error?: string };
                    setKdsError(d.error ?? 'Error');
                    setKdsState('error');
                    return;
                  }
                  const data = (await res.json()) as { already_exists?: boolean };
                  setKdsState(data.already_exists ? 'existing' : 'sent');
                } catch {
                  setKdsError('Network error');
                  setKdsState('error');
                }
              }}
              className="w-full py-2 text-sm font-medium border border-orange-300 bg-orange-50 text-orange-700 rounded-xl hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              {kdsState === 'sending' ? '…' : t.sendToKds}
            </button>
          )}
        {(kdsState === 'sent') && (
          <p className="text-center text-sm text-green-600 font-medium py-1">
            {t.kdsSent}
          </p>
        )}
        {(kdsState === 'existing') && (
          <p className="text-center text-sm text-blue-600 font-medium py-1">
            {t.kdsExisting}
          </p>
        )}
        {kdsState === 'error' && kdsError && (
          <p className="text-center text-xs text-red-500 py-1">{kdsError}</p>
        )}

        {order.status !== 'cancelled' && order.status !== 'completed' && (
          <>
            {confirmCancel ? (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setConfirmCancel(false);
                    patch({ status: 'cancelled' });
                  }}
                  className="flex-1 py-2 text-sm bg-red-500 text-white rounded-xl"
                >
                  {t.confirmCancel}
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2 text-sm border border-[#E2E8F0] rounded-xl"
                >
                  {t.close}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="w-full py-2 text-sm text-red-500 border border-red-200 rounded-xl"
              >
                {t.cancelOrder}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface OrdersPanelProps {
  onClose: () => void;
}

export function OrdersPanel({ onClose }: OrdersPanelProps) {
  const { t } = useLanguage();
  const ot = t.orders as Record<string, string>;

  const [orders, setOrders] = useState<WhatsAppOrder[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selected, setSelected] = useState<WhatsAppOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiFetch('/api/orders?limit=50');
      if (res.ok) {
        const data = (await res.json()) as { orders: WhatsAppOrder[] };
        setOrders(data.orders);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (filter === 'new') return o.status === 'new';
    if (filter === 'in_progress') return ACTIVE_STATUSES.slice(1).includes(o.status);
    if (filter === 'done') return DONE_STATUSES.includes(o.status);
    return true;
  });

  const handleUpdated = useCallback((updated: WhatsAppOrder) => {
    setOrders((prev) => prev.map((o) => (o.order_id === updated.order_id ? updated : o)));
    setSelected(updated);
  }, []);

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: ot.filterAll },
    { key: 'new', label: ot.filterNew },
    { key: 'in_progress', label: ot.filterInProgress },
    { key: 'done', label: ot.filterDone },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-[#F8FAFC] flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-[#E2E8F0]">
          <h2 className="font-bold text-lg">{ot.title}</h2>
          <button onClick={onClose} className="text-[#64748B] text-xl leading-none">
            ×
          </button>
        </div>

        {!selected ? (
          <>
            {/* Filter tabs */}
            <div className="flex gap-1 p-2 bg-white border-b border-[#E2E8F0]">
              {FILTER_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    filter === key
                      ? 'bg-[#3B82F6] text-white'
                      : 'text-[#64748B] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Order list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <p className="text-center text-[#94A3B8] text-sm mt-8">…</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-[#94A3B8] text-sm mt-8">{ot.noOrders}</p>
              ) : (
                filtered.map((o) => (
                  <OrderCard
                    key={o.order_id}
                    order={o}
                    t={ot}
                    onClick={() => setSelected(o)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <OrderDetail
              order={selected}
              t={ot}
              onBack={() => setSelected(null)}
              onUpdated={handleUpdated}
            />
          </div>
        )}
      </div>
    </div>
  );
}
