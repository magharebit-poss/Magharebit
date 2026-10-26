'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  formatPrice,
  buildCartLine,
  recomputeLine,
  computeCartTotals,
  applyLineDiscount,
  findProductByCode,
  type Product,
  type CartLine,
  type Discount,
} from '../../lib/cart';
import CashPaymentModal from '../../components/CashPaymentModal';
import CardPaymentModal from '../../components/CardPaymentModal';
import CustomerLookupModal, { type CustomerProfile } from '../../components/CustomerLookupModal';
import PluModal from '../../components/PluModal';
import DiscountModal from '../../components/DiscountModal';
import ManagerPinModal, { type ManagerOverrideResult } from '../../components/ManagerPinModal';
import MarkdownLabel from '../../components/MarkdownLabel';
import ScaleWidget from '../../components/ScaleWidget';
import { CustomerSearch, type Customer } from '../../components/CustomerSearch';
import { CustomerTab } from '../../components/CustomerTab';
import { useLanguage } from '../../context/LanguageContext';
import { LANGS, type Translations } from '../../lib/i18n';
import { apiFetch, TOKEN_KEY } from '../../lib/api';
import { pickName } from '../../lib/names';
import { isTauri, isBackendReachable } from '../../lib/offline-queue';
import { startSyncDrain, stopSyncDrain } from '../../lib/sync-drain';
import { useTenantModules } from '../../hooks/useTenantModules';
import { printData, getStatus as getPrinterStatus } from '../../lib/printer/printer-manager';
import { buildReceipt } from '../../lib/printer/receipt-builder';
import { buildPrintInfo, DEFAULT_TIME_ZONE, type ReceiptPrintInfo } from '../../lib/printer/receipt-format';
import type { FloorTable } from '../../components/cafe/TableMap';
import type { SelectedModifier } from '../../components/cafe/ModifierPicker';

const OrdersPanel = dynamic(
  () => import('../../components/OrdersPanel').then((m) => ({ default: m.OrdersPanel })),
  { ssr: false },
);
const SplitPaymentModal = dynamic(
  () => import('../../components/SplitPaymentModal'),
  { ssr: false },
);
const ReturnModal = dynamic(
  () => import('../../components/ReturnModal'),
  { ssr: false },
);
const PrinterWidget = dynamic(
  () => import('../../components/PrinterWidget').then((m) => ({ default: m.PrinterWidget })),
  { ssr: false },
);
const TableMap = dynamic(
  () => import('../../components/cafe/TableMap').then((m) => ({ default: m.TableMap })),
  { ssr: false },
);
const ModifierPicker = dynamic(
  () => import('../../components/cafe/ModifierPicker').then((m) => ({ default: m.ModifierPicker })),
  { ssr: false },
);
const CoursePanel = dynamic(
  () => import('../../components/cafe/CoursePanel').then((m) => ({ default: m.CoursePanel })),
  { ssr: false },
);
// Manager-only, never needed for the first cashier paint.
const AlertBanner = dynamic(
  () => import('../../components/AlertBanner').then((m) => ({ default: m.AlertBanner })),
  { ssr: false },
);
// These three pull in html5-qrcode / qrcode and only open on demand.
const BarcodeScanner = dynamic(() => import('../../components/BarcodeScanner'), { ssr: false });
const LanaPaymentModal = dynamic(() => import('../../components/LanaPaymentModal'), { ssr: false });
const ProductQRCode = dynamic(() => import('../../components/ProductQRCode'), { ssr: false });
const VoiceButton = dynamic(
  () => import('../../components/VoiceButton').then((m) => ({ default: m.VoiceButton })),
  { ssr: false },
);

const BACKEND_URL =
  process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';
const TENANT_ID = process.env['NEXT_PUBLIC_TENANT_ID'] ?? '';

type CategoryKey = 'all' | 'beverages' | 'bakery' | 'produce' | 'juices' | 'prepared' | 'grocery' | 'snacks' | 'supplies' | 'general';

// Global low-stock threshold fallback (per-product threshold takes precedence
// when it is higher). Mirrors the backend RETURN_THRESHOLD env var pattern.
const GLOBAL_THRESHOLD = parseInt(
  process.env['NEXT_PUBLIC_LOW_STOCK_THRESHOLD'] ?? '5',
  10,
);

// ── KDS Send-to-Kitchen Modal ─────────────────────────────────────────────────

interface KdsSendModalProps {
  cart: CartLine[];
  lang: string;
  tableId: string | null;
  t: {
    table: string;
    sessionExpired: string;
    signInToContinue: string;
    sendToKitchen: string;
    sentToKitchen: string;
    fulfillmentSurPlace: string;
    fulfillmentEmporter: string;
    tableNumber: string;
    notesPlaceholder: string;
    send: string;
    cancel: string;
  };
  onClose: () => void;
  onSent: (msg: string, orderId: string) => void;
}

function KdsSendModal({ cart, lang, tableId, t, onClose, onSent }: KdsSendModalProps) {
  const [fulfillmentType, setFulfillmentType] = useState<'table' | 'takeaway'>('takeaway');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      // The KDS screen reads cafe_orders / cafe_order_lines, so the order goes there.
      const orderNote = [
        fulfillmentType === 'table' && tableNumber ? `${t.table} ${tableNumber}` : null,
        notes || null,
      ].filter(Boolean).join(' — ');
      const orderRes = await apiFetch('/api/cafe/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: fulfillmentType === 'table' && tableId ? tableId : undefined,
          covers: 1,
          note: orderNote || undefined,
        }),
      });
      if (orderRes.status === 401) {
        // Expired token: nothing was sent and the cart is untouched.
        setError(`${t.sessionExpired} — ${t.signInToContinue}`);
        return;
      }
      if (!orderRes.ok) {
        const d = (await orderRes.json()) as { error?: string };
        setError(d.error ?? 'Error');
        return;
      }
      const { order_id } = (await orderRes.json()) as { order_id: string };

      for (const line of cart) {
        const lineRes = await apiFetch(`/api/cafe/orders/${order_id}/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: line.product.product_id,
            name_ar: line.product.name_ar,
            name_fr: line.product.name_fr || undefined,
            quantity: Math.max(1, Math.round(line.quantity)),
            unit_price: line.unitPricePiastres / 100,
            modifiers: [],
          }),
        });
        if (lineRes.status === 401) {
          setError(`${t.sessionExpired} — ${t.signInToContinue}`);
          return;
        }
        if (!lineRes.ok) {
          const d = (await lineRes.json()) as { error?: string };
          setError(d.error ?? 'Error');
          return;
        }
      }
      onSent(t.sentToKitchen, order_id);
    } catch {
      setError('Network error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-md mx-0 sm:mx-4">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0F172A]">🍳 {t.sendToKitchen}</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order summary */}
          <div className="bg-[#F8FAFC] rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
            {cart.map((line) => (
              <div key={line.lineId} className="flex justify-between text-sm">
                <span className="text-[#0F172A] font-medium">
                  {line.quantity} × {pickName(lang, line.product.name_ar, line.product.name_fr)}
                </span>
              </div>
            ))}
          </div>

          {/* Fulfillment type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setFulfillmentType('table')}
              className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                fulfillmentType === 'table'
                  ? 'border-[#2E8B57] bg-[#F0FDF4] text-[#2E8B57]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {t.fulfillmentSurPlace}
            </button>
            <button
              onClick={() => setFulfillmentType('takeaway')}
              className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                fulfillmentType === 'takeaway'
                  ? 'border-[#2E8B57] bg-[#F0FDF4] text-[#2E8B57]'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {t.fulfillmentEmporter}
            </button>
          </div>

          {/* Table number (when table selected) */}
          {fulfillmentType === 'table' && (
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder={t.tableNumber}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
            />
          )}

          {/* Notes */}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="flex-1 py-3 border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={sending}
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {sending ? '…' : `🍳 ${t.send}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Memoized list items ───────────────────────────────────────────────────────
// Handlers passed in must be stable so unrelated page state (search typing,
// toasts, order polling) does not re-render every tile and cart row.

interface ProductTileProps {
  p: Product;
  lang: string;
  t: Translations;
  isLastScanned: boolean;
  onAdd: (p: Product) => void;
  onShowQr: (p: Product) => void;
  onShowMarkdown: (p: Product) => void;
}

const ProductTile = memo(function ProductTile({
  p, lang, t, isLastScanned, onAdd, onShowQr, onShowMarkdown,
}: ProductTileProps) {
  const name = pickName(lang, p.name_ar, p.name_fr);
  return (
    <button
      onClick={() => onAdd(p)}
      className={`bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-[#2E8B57] cursor-pointer transition-all text-center group relative ${
        isLastScanned ? 'ring-2 ring-[#2E8B57] ring-offset-1' : ''
      } ${p.track_stock && p.stock_quantity === 0 ? 'opacity-60' : ''}`}
    >
      {/* QR button (hover) */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onShowQr(p); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onShowQr(p); } }}
        className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 p-1 rounded-md bg-white/90 text-[10px] font-bold text-[#94A3B8] hover:text-[#2E8B57] border border-[#E2E8F0] leading-none z-10 cursor-pointer"
      >
        QR
      </span>

      {/* Stock badge — top-start corner, only when track_stock */}
      {p.track_stock && (() => {
        const effectiveThreshold = Math.max(p.low_stock_threshold, GLOBAL_THRESHOLD);
        const qty = p.stock_quantity;
        const qtyLabel = p.is_weighted
          ? `${(qty / 1000).toFixed(1)} ${t.stock.kg}`
          : `${qty}`;
        if (qty === 0) {
          return (
            <span className="absolute top-2 start-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 leading-none z-10 pointer-events-none">
              {t.stock.outOfStock}
            </span>
          );
        }
        if (qty <= effectiveThreshold) {
          return (
            <span className="absolute top-2 start-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 leading-none z-10 pointer-events-none">
              ⚠ {qtyLabel}
            </span>
          );
        }
        return (
          <span className="absolute top-2 start-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 leading-none z-10 pointer-events-none">
            {qtyLabel}
          </span>
        );
      })()}

      {/* Fixed image area — consistent height for all cards */}
      <div className="w-full h-20 rounded-xl overflow-hidden bg-[#F0FDF4] mb-3 flex items-center justify-center">
        {p.thumb_url ? (
          <img
            src={p.thumb_url}
            alt={name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <span className="text-2xl font-bold text-[#2E8B57]">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="font-semibold text-sm text-[#0F172A] mb-1 line-clamp-2 min-h-[2.5rem]">
        {name}
      </div>
      <div className="relative">
        {p.current_markdown_percent != null && (
          <span className="absolute -top-3 end-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            −{p.current_markdown_percent}%
          </span>
        )}
        <div className="text-[#2E8B57] font-bold">
          {formatPrice(p.effective_price_cents)}
        </div>
        {p.current_markdown_percent != null && (
          <div className="text-[#94A3B8] text-[10px] line-through leading-none">
            {formatPrice(p.price_cents)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        {p.is_bom && (
          <span className="inline-block w-2 h-2 rounded-full bg-orange-400" title="BOM" />
        )}
        {p.is_perishable && p.current_markdown_percent != null && (
          <span
            role="button"
            tabIndex={0}
            title={t.markdown.labelButton}
            aria-label={t.markdown.labelButton}
            onClick={(e) => { e.stopPropagation(); onShowMarkdown(p); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onShowMarkdown(p); } }}
            className="text-sm cursor-pointer hover:scale-110 transition-transform leading-none"
          >
            🏷️
          </span>
        )}
      </div>
    </button>
  );
});

interface CartLineRowProps {
  line: CartLine;
  lang: string;
  t: Translations;
  onRemoveDiscount: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onQty: (lineId: string, delta: number) => void;
  onDiscount: (lineId: string) => void;
}

const CartLineRow = memo(function CartLineRow({
  line, lang, t, onRemoveDiscount, onRemove, onQty, onDiscount,
}: CartLineRowProps) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[#0F172A] truncate">{pickName(lang, line.product.name_ar, line.product.name_fr)}</p>
          <p className="text-xs text-[#94A3B8]">
            {formatPrice(line.unitPricePiastres)} × {line.quantity}
          </p>
          {line.discount && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#2E8B57] bg-[#F0FDF4] px-2 py-0.5 rounded-full">
              {line.discount.type === 'percentage'
                ? `−${line.discount.value}%`
                : `−${formatPrice(line.discount.value)}`}
              {line.discount.managerApprovedBy ? ' 👔' : ''}
              <button
                onClick={() => onRemoveDiscount(line.lineId)}
                className="text-[#94A3B8] hover:text-red-600 leading-none"
                aria-label={t.discount.remove}
              >
                ×
              </button>
            </span>
          )}
          {line.product.is_bom && (
            <p className="text-[10px] text-[#94A3B8] mt-0.5">{t.pos.bomNotice}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(line.lineId)}
          className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
          aria-label={t.pos.delete}
        >
          ×
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQty(line.lineId, -1)}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold"
          >
            −
          </button>
          <span className="text-sm font-semibold text-[#0F172A] min-w-[2ch] text-center">
            {line.quantity}
          </span>
          <button
            onClick={() => onQty(line.lineId, 1)}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold"
          >
            +
          </button>
          <button
            onClick={() => onDiscount(line.lineId)}
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F0FDF4] hover:border-[#2E8B57] text-xs font-bold"
            title={t.discount.addLine}
            aria-label={t.discount.addLine}
          >
            %
          </button>
        </div>
        <span className="text-sm font-bold text-[#2E8B57]">
          {formatPrice(line.lineTotalPiastres)}
        </span>
      </div>
    </div>
  );
});

export default function POSPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState<Discount | undefined>(undefined);
  // Which discount editor is open: a specific line, or the whole cart.
  const [discountTarget, setDiscountTarget] = useState<
    { kind: 'line'; lineId: string } | { kind: 'cart' } | null
  >(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showLanaModal, setShowLanaModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStockAlert, setShowStockAlert] = useState(false);
  const [wasteRiskMap, setWasteRiskMap] = useState<Record<string, { riskLevel: string; recommendedMarkdownPct: number | null } | null>>({});
  const [showScanner, setShowScanner] = useState(false);
  const [showPluModal, setShowPluModal] = useState(false);
  const [showScaleSetup, setShowScaleSetup] = useState(false);
  const [selectedWeightedId, setSelectedWeightedId] = useState<string | null>(null);
  const [scaleToast, setScaleToast] = useState<string | null>(null);
  const [showQrFor, setShowQrFor] = useState<Product | null>(null);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [cashierId, setCashierId] = useState<string>('');
  const [cashierName, setCashierName] = useState<string>('');
  const [cashierRole, setCashierRole] = useState<string>('');
  const [shiftStartTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [showCustomerLookup, setShowCustomerLookup] = useState(false);
  const [markdownLabelProduct, setMarkdownLabelProduct] = useState<Product | null>(null);
  const [showOrdersPanel, setShowOrdersPanel] = useState(false);
  const [showCreditSearch, setShowCreditSearch] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [showCreditTab, setShowCreditTab] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const ordersPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showKdsSendModal, setShowKdsSendModal] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [kdsToast, setKdsToast] = useState<string | null>(null);
  const kdsEnabled = process.env['NEXT_PUBLIC_KDS_ENABLED'] === 'true';
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [showTableMap, setShowTableMap] = useState(false);
  const [activeTable, setActiveTable] = useState<FloorTable | null>(null);
  const [showModifierPicker, setShowModifierPicker] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const { modules } = useTenantModules();

  // Pending discount held while waiting for a manager PIN (discount > 20%).
  const [pendingDiscount, setPendingDiscount] = useState<Discount | null>(null);

  // Orders polling — 30-second interval, paused when panel is open.
  const pollOrders = useCallback(async () => {
    try {
      const res = await apiFetch('/api/orders?status=new&limit=50');
      if (res.ok) {
        const data = (await res.json()) as { orders: { order_id: string }[] };
        setNewOrderCount(data.orders.length);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    // Only start polling after the shift guard has confirmed a valid session.
    if (!shiftId) return;
    if (showOrdersPanel) {
      if (ordersPollRef.current) {
        clearInterval(ordersPollRef.current);
        ordersPollRef.current = null;
      }
      return;
    }
    void pollOrders();
    ordersPollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void pollOrders();
    }, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void pollOrders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (ordersPollRef.current) {
        clearInterval(ordersPollRef.current);
        ordersPollRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [shiftId, showOrdersPanel, pollOrders]);

  // Online/offline polling + sync drain — only meaningful inside Tauri.
  useEffect(() => {
    if (!isTauri()) return; // browser dev mode: no offline concerns
    let cancelled = false;
    const check = async () => {
      const reachable = await isBackendReachable(BACKEND_URL);
      if (!cancelled) setIsOnline(reachable);
    };
    void check();
    const pollTimer = setInterval(() => { void check(); }, 15_000);
    startSyncDrain(TENANT_ID, BACKEND_URL, (count) => {
      if (!cancelled) setPendingCount(count);
    });
    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      stopSyncDrain();
    };
  }, []);

  useEffect(() => {
    const sid = sessionStorage.getItem('greengo_shift_id');
    const token = sessionStorage.getItem(TOKEN_KEY);
    const name = sessionStorage.getItem('greengo_cashier_name');
    if (!sid || !token) {
      router.push('/');
      return;
    }
    setShiftId(sid);
    setCashierId(sessionStorage.getItem('greengo_cashier_id') ?? '');
    setCashierName(name ?? '');
    setCashierRole(sessionStorage.getItem('greengo_cashier_role') ?? '');

    apiFetch('/api/products')
      .then(async (r) => {
        if (r.status === 401) { router.replace('/'); return null; }
        if (!r.ok) throw new Error('products fetch failed');
        return r.json() as Promise<Product[]>;
      })
      .then((data) => { if (data) setProducts(data); })
      .catch(() => setError(t.pos.errorProducts))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(),
    [products],
  );

  const displayedProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Search is always global — overrides category navigation entirely
    if (term) {
      return products.filter(
        (p) =>
          p.name_ar.toLowerCase().includes(term) ||
          p.name_fr.toLowerCase().includes(term) ||
          (p.barcode ?? '').includes(term) ||
          (p.plu_code ?? '').toLowerCase().includes(term),
      );
    }
    // '__all__' sentinel → Level 2 with no category filter
    if (activeCategory === '__all__') return products;
    // Specific category selected → Level 2 filtered
    if (activeCategory !== null) return products.filter((p) => p.category === activeCategory);
    // null → Level 1 (category grid), no product list needed
    return [];
  }, [products, search, activeCategory]);

  // Products that need a stock alert: track_stock=true AND quantity ≤ threshold.
  // Zero-stock items appear first, then ascending by stock_quantity.
  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (!p.track_stock) return false;
        const threshold = Math.max(p.low_stock_threshold, GLOBAL_THRESHOLD);
        return p.stock_quantity <= threshold;
      })
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }, [products]);

  const totals = useMemo(() => computeCartTotals(cart, cartDiscount), [cart, cartDiscount]);

  // Base amount the open discount editor applies to (line HT, or cart subtotal
  // after line discounts).
  const discountBase = useMemo(() => {
    if (!discountTarget) return 0;
    if (discountTarget.kind === 'cart') {
      return cart.reduce((s, l) => s + l.lineTotalPiastres, 0);
    }
    const line = cart.find((l) => l.lineId === discountTarget.lineId);
    return line ? line.unitPricePiastres * line.quantity : 0;
  }, [discountTarget, cart]);

  const existingDiscount: Discount | undefined = useMemo(() => {
    if (!discountTarget) return undefined;
    if (discountTarget.kind === 'cart') return cartDiscount;
    return cart.find((l) => l.lineId === discountTarget.lineId)?.discount;
  }, [discountTarget, cart, cartDiscount]);

  const DISCOUNT_LIMIT_PCT = 20;

  const commitDiscount = (discount: Discount, approvedBy?: string) => {
    if (!discountTarget) return;
    const finalDiscount: Discount =
      approvedBy ? { ...discount, managerApprovedBy: approvedBy } : discount;
    if (discountTarget.kind === 'cart') {
      setCartDiscount(finalDiscount);
    } else {
      const lineId = discountTarget.lineId;
      setCart((current) =>
        current.map((l) => (l.lineId === lineId ? applyLineDiscount(l, finalDiscount) : l)),
      );
    }
    setDiscountTarget(null);
  };

  const applyDiscount = (discount: Discount) => {
    if (!discountTarget) return;
    const isCashier = cashierRole === 'CASHIER' || cashierRole === 'SENIOR_CASHIER';
    const isOverLimit =
      discount.type === 'percentage' && discount.value > DISCOUNT_LIMIT_PCT;
    if (isCashier && isOverLimit) {
      // Gate: store the discount and show the manager PIN modal.
      setPendingDiscount(discount);
      return;
    }
    commitDiscount(discount);
  };

  const removeLineDiscount = useCallback((lineId: string) => {
    setCart((current) =>
      current.map((l) => (l.lineId === lineId ? applyLineDiscount(l, undefined) : l)),
    );
  }, []);

  const openLineDiscount = useCallback((lineId: string) => {
    setDiscountTarget({ kind: 'line', lineId });
  }, []);

  const scaleModuleOn = modules.scale;
  const addToCart = useCallback((product: Product) => {
    // With a connected scale, tapping a weighted product selects it for weighing
    // (added to cart only after the ⚖ read) instead of adding a unit quantity.
    if (scaleModuleOn && product.is_weighted) {
      setSelectedWeightedId(product.product_id);
      setShowScaleSetup(true);
      return;
    }
    setCart((current) => {
      const existing = current.find((l) => l.product.product_id === product.product_id);
      if (existing) {
        return current.map((l) =>
          l.lineId === existing.lineId ? recomputeLine(l, l.quantity + 1) : l,
        );
      }
      return [...current, buildCartLine(product, 1)];
    });
  }, [scaleModuleOn]);

  const showScaleToast = (msg: string) => {
    setScaleToast(msg);
    setTimeout(() => setScaleToast(null), 3000);
  };

  const handleWeighClick = () => { setShowScaleSetup(true); };

  const updateQty = useCallback((lineId: string, delta: number) => {
    setCart((current) =>
      current
        .map((l) => (l.lineId === lineId ? recomputeLine(l, Math.max(0, l.quantity + delta)) : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCart((current) => current.filter((l) => l.lineId !== lineId));
  }, []);

  // ── Voice commands ──────────────────────────────────────────────────────────
  const handleVoiceProduct = useCallback(async (query: string, qty: number) => {
    const res = await apiFetch(`/api/products?q=${encodeURIComponent(query)}`);
    if (!res.ok) return;
    const matches = (await res.json()) as Product[];
    const match = matches[0];
    if (!match) return;
    for (let i = 0; i < qty; i++) addToCart(match);
  }, [addToCart]);

  const handleVoiceTable = useCallback(async (n: number) => {
    const res = await apiFetch('/api/tables');
    if (!res.ok) return;
    const tables = (await res.json()) as FloorTable[];
    const match = tables.find((tb) => tb.label === `T${n}` || tb.label === String(n));
    if (match) setActiveTable(match);
  }, []);

  const handleCloseShift = () => {
    const sid = sessionStorage.getItem('greengo_shift_id');
    if (!sid) {
      router.push('/');
      return;
    }
    router.push(`/shift-close?id=${encodeURIComponent(sid)}`);
  };

  const handleBarcodeScanned = (code: string) => {
    const product = findProductByCode(code, products);
    if (product) {
      addToCart(product);
      setLastScannedId(product.product_id);
      setTimeout(() => setLastScannedId(null), 1500);
    } else {
      setSearch(code);
    }
  };

  const handlePaymentSuccess = (info?: ReceiptPrintInfo) => {
    void printReceipt('cash', info);
    setCart([]);
    setActiveOrderId(null);
    setCartDiscount(undefined);
    setShowPayment(false);
  };

  const handleCardPaymentSuccess = (info?: ReceiptPrintInfo) => {
    void printReceipt('card', info);
    setCart([]);
    setActiveOrderId(null);
    setCartDiscount(undefined);
    setShowCardModal(false);
  };

  const handleLanaPaymentSuccess = (info?: ReceiptPrintInfo) => {
    void printReceipt('lana', info);
    setCart([]);
    setActiveOrderId(null);
    setCartDiscount(undefined);
    setShowLanaModal(false);
  };

  const handleSplitPaymentSuccess = () => {
    setCart([]);
    setActiveOrderId(null);
    setCartDiscount(undefined);
    setShowSplitModal(false);
  };

  function printReceipt(method: 'cash' | 'card' | 'lana', info?: ReceiptPrintInfo) {
    if (getPrinterStatus() !== 'connected') return;
    // The payment modal hands over the server's receipt number and sold_at. Without them
    // (should not happen) the receipt is printed as provisional, never with an official-looking number.
    const p = info ?? buildPrintInfo({ localId: crypto.randomUUID(), nowIso: new Date().toISOString() });
    const data = buildReceipt({
      receiptNumber: p.receiptNumber,
      soldAt: p.soldAt,
      provisional: p.provisional,
      timeZone: process.env.NEXT_PUBLIC_TENANT_TIMEZONE || DEFAULT_TIME_ZONE,
      shiftId: shiftId ?? '',
      cashierName,
      cartLines: cart,
      cartDiscount,
      totalPiastres: totals.totalPiastres,
      taxPiastres: totals.taxPiastres,
      paymentMethod: method,
      ...(p.paidPiastres !== undefined ? { paidPiastres: p.paidPiastres } : {}),
      ...(p.changePiastres !== undefined ? { changePiastres: p.changePiastres } : {}),
    });
    printData(data).catch(() => { /* silent — printer may be disconnected */ });
  }

  const categoryLabel = (c: string): string => {
    const key = c as CategoryKey;
    return t.pos.category[key] ?? c;
  };

  const localeForFormat = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB';

  const CATEGORY_PALETTE = [
    'bg-emerald-100', 'bg-blue-100', 'bg-amber-100', 'bg-rose-100',
    'bg-purple-100', 'bg-orange-100', 'bg-teal-100', 'bg-cyan-100',
  ] as const;

  const categoryColor = (name: string): string =>
    CATEGORY_PALETTE[name.length % CATEGORY_PALETTE.length] ?? 'bg-emerald-100';

  const categoryProductCount = (cat: string): number =>
    cat === '__all__' ? products.length : products.filter((p) => p.category === cat).length;

  const categoryInitial = (c: string): string =>
    (categoryLabel(c) || c).charAt(0).toUpperCase();

  const activeCategoryColor =
    activeCategory != null ? categoryColor(activeCategory) : 'bg-emerald-100';

  return (
    <main className="h-screen w-screen flex bg-[#F8FAFC] overflow-hidden">
      {/* Margin Guardian — manager-only real-time alert banner */}
      {(cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR' || cashierRole === 'OWNER') && (
        <AlertBanner
          token={
            (typeof window !== 'undefined'
              ? sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY)
              : null) ?? ''
          }
        />
      )}

      {/* LEFT PANEL — 60% */}
      <div className="w-3/5 flex flex-col">
        {/* Top bar with search + language toggle */}
        <div className="p-4 bg-white border-b border-[#E2E8F0] flex gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.pos.searchPlaceholder}
            className="flex-1 h-12 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent text-base"
          />
          {modules.barcode && (
            <button
              onClick={() => setShowScanner(true)}
              className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-colors flex-shrink-0"
              title={t.pos.scanBarcode}
            >
              📷
            </button>
          )}
          <button
            onClick={() => setShowPluModal(true)}
            className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-colors flex-shrink-0 text-lg font-bold text-[#0F172A] w-[46px]"
            title={t.pos.manualPlu}
          >
            #
          </button>
          {/* Scale weight button — opens ScaleWidget for Web Serial connection */}
          {modules.scale && (
            <button
              onClick={handleWeighClick}
              className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-colors flex-shrink-0 text-lg w-[46px]"
              title={t.scale.connect}
            >
              ⚖
            </button>
          )}
          {/* Language toggle */}
          <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-[#E2E8F0] flex-shrink-0">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  lang === l.code ? 'bg-white text-[#2E8B57] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Product area — three rendering modes:
            1. Loading / error
            2. Level 1: category grid (activeCategory === null, no search)
            3. Level 2 / search results: product grid */}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-center text-[#94A3B8] mt-8 p-4">{t.pos.loading}</p>}
          {error && <p className="text-center text-red-500 mt-8 p-4">{error}</p>}

          {!loading && !error && activeCategory === null && !search.trim() && (
            /* ── LEVEL 1: Category grid ─────────────────────────────────── */
            <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {/* "All" tile — always first */}
              <button
                onClick={() => setActiveCategory('__all__')}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] hover:shadow-md hover:border-[#2E8B57] transition-all text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-200 flex items-center justify-center text-3xl font-bold text-[#2E8B57]">
                  ✦
                </div>
                <span className="font-semibold text-sm text-[#0F172A]">{t.pos.allCategories}</span>
                <span className="text-xs text-[#64748B]">
                  {t.pos.productsCount.replace('{n}', String(products.length))}
                </span>
              </button>

              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={`${categoryColor(c)} rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] hover:shadow-md transition-all text-center border border-white/60`}
                >
                  <div className={`w-16 h-16 rounded-full bg-white/60 flex items-center justify-center text-3xl font-bold text-[#0F172A]`}>
                    {categoryInitial(c)}
                  </div>
                  <span className="font-semibold text-sm text-[#0F172A]">{categoryLabel(c)}</span>
                  <span className="text-xs text-[#64748B]">
                    {t.pos.productsCount.replace('{n}', String(categoryProductCount(c)))}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && (activeCategory !== null || search.trim() !== '') && (
            /* ── LEVEL 2 / Search results: product grid ─────────────────── */
            <>
              {/* Level-2 header (not shown during search) */}
              {activeCategory !== null && !search.trim() && (
                <div className={`${activeCategoryColor} px-4 py-3 flex items-center gap-3 border-b border-white/40`}>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="p-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors flex-shrink-0"
                    title={t.pos.backToCategories}
                  >
                    {lang === 'ar' ? '→' : '←'}
                  </button>
                  <span className="font-bold text-[#0F172A] text-sm">
                    {activeCategory === '__all__' ? t.pos.allCategories : categoryLabel(activeCategory)}
                  </span>
                  <span className="text-xs text-[#64748B]">
                    {t.pos.productsCount.replace('{n}', String(displayedProducts.length))}
                  </span>
                </div>
              )}

              <div className="p-4 grid grid-cols-3 gap-3">
                {displayedProducts.map((p) => (
                  <ProductTile
                    key={p.product_id}
                    p={p}
                    lang={lang}
                    t={t}
                    isLastScanned={lastScannedId === p.product_id}
                    onAdd={addToCart}
                    onShowQr={setShowQrFor}
                    onShowMarkdown={setMarkdownLabelProduct}
                  />
                ))}
                {displayedProducts.length === 0 && (
                  <p className="col-span-3 text-center text-[#94A3B8] mt-8">{t.pos.noProducts}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom bar */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-[#64748B]">{t.pos.cashierLabel}</p>
              <p className="text-sm font-semibold text-[#0F172A]">{cashierName}</p>
              <p className="text-[10px] text-[#94A3B8] font-mono" suppressHydrationWarning>
                {t.pos.shiftStarted}: {shiftStartTime.toLocaleTimeString(localeForFormat, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {/* Online/offline indicator — only shown inside Tauri */}
            {isTauri() && (
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  !isOnline             ? 'bg-red-500' :
                  pendingCount > 0      ? 'bg-amber-400' :
                                          'bg-green-500'
                }`} />
                <span className="text-[10px] text-[#94A3B8]">
                  {!isOnline
                    ? t.sync.offline
                    : pendingCount > 0
                      ? t.sync.pending.replace('{n}', String(pendingCount))
                      : t.sync.online}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR') && (
              <button
                onClick={() => router.push('/analytics')}
                className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors flex items-center gap-2"
              >
                📊 {t.analytics.posButtonLabel}
              </button>
            )}
            {(cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR') && (
              <button
                onClick={() => router.push('/suppliers')}
                className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors flex items-center gap-2"
              >
                🚚 {t.suppliers.title}
              </button>
            )}
            {(cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR' || cashierRole === 'OWNER') && (
              <button
                onClick={() => router.push('/staff')}
                title={t.pos.staffManagement}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.75rem',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                }}
              >👥</button>
            )}
            {(cashierRole === 'INVENTORY' || cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR' || cashierRole === 'OWNER') && (
              <button
                onClick={() => router.push('/products')}
                title={t.pos.productManagement}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.75rem',
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                }}
              >🛒</button>
            )}
            {(cashierRole === 'MANAGER' || cashierRole === 'SUPERVISOR') && lowStockProducts.length > 0 && (
              <button
                onClick={() => {
                  setShowStockAlert(true);
                  // Fetch waste risk for perishable products
                  for (const p of lowStockProducts) {
                    if (!p.is_perishable) continue;
                    void apiFetch(`/api/ml/waste-risk/by-product/${p.product_id}`)
                      .then(async (res) => {
                        if (!res.ok) return;
                        const data = (await res.json()) as { riskLevel: string; recommendedMarkdownPct: number | null };
                        setWasteRiskMap((prev) => ({ ...prev, [p.product_id]: data }));
                      })
                      .catch(() => { /* non-critical */ });
                  }
                }}
                className="relative border border-amber-300 text-amber-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-50 transition-colors flex items-center gap-1.5"
              >
                <span>⚠</span>
                <span className="font-bold">{lowStockProducts.length}</span>
              </button>
            )}
            <button
              onClick={() => setShowPrinterSetup(true)}
              className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#F1F5F9] transition-colors flex items-center gap-2"
              title={t.pos.printerSetup}
            >
              🖨️
            </button>
            <VoiceButton
              lang={lang}
              onProductQuery={handleVoiceProduct}
              onTableSelect={(n) => { void handleVoiceTable(n); }}
              onClear={() => { setCart([]); setCartDiscount(undefined); }}
              onPay={() => { if (cart.length > 0) setShowPayment(true); }}
            />
            {(cashierRole === 'SUPERVISOR' || cashierRole === 'OWNER') && (
              <button
                onClick={() => router.push('/branches')}
                title={t.nav.branches}
                className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#F1F5F9] transition-colors flex items-center gap-2"
              >
                🏪
              </button>
            )}
            {(cashierRole === 'SUPERVISOR' || cashierRole === 'OWNER') && (
              <button
                onClick={() => router.push('/settings')}
                title={t.nav.settings}
                aria-label={t.nav.settings}
                className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#F1F5F9] transition-colors flex items-center gap-2"
              >
                ⚙️
              </button>
            )}
            {modules.tables && (
              <button
                onClick={() => setShowTableMap(true)}
                title={t.pos.tableMap}
                className={`border text-sm font-medium px-3 py-2 rounded-xl transition-colors flex items-center gap-1 ${
                  activeTable
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]'
                }`}
              >
                🪑{activeTable ? ` ${activeTable.label}` : ''}
              </button>
            )}
            {modules.waste_tracking && (
            <button
              onClick={() => router.push('/waste')}
              disabled={!shiftId}
              className="border border-[#E2E8F0] text-[#64748B] text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              🗑️ {t.waste.posButtonLabel}
            </button>
            )}
            {newOrderCount > 0 && (
              <button
                onClick={() => setShowOrdersPanel(true)}
                className="relative border border-green-300 text-green-700 text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-50 transition-colors flex items-center gap-1.5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="font-bold">{newOrderCount}</span>
              </button>
            )}
            <button
              onClick={handleCloseShift}
              className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              {t.pos.closeShift}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — 40% */}
      <div className="w-2/5 bg-white flex flex-col border-l border-[#E2E8F0]">
        {/* Cart header */}
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">{t.pos.cart}</h2>
          {cart.length > 0 && (
            <span className="bg-[#2E8B57] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {cart.length}
            </span>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] p-8">
              <div className="text-4xl mb-2">🛒</div>
              <p>{t.pos.cartEmpty}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {cart.map((line) => (
                <CartLineRow
                  key={line.lineId}
                  line={line}
                  lang={lang}
                  t={t}
                  onRemoveDiscount={removeLineDiscount}
                  onRemove={removeLine}
                  onQty={updateQty}
                  onDiscount={openLineDiscount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Totals + Payment */}
        <div className="border-t border-[#E2E8F0]">
          <div className="p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-[#64748B]">
              <span>{t.pos.subtotal}</span>
              <span className="font-mono">{formatPrice(totals.subtotalPiastres)}</span>
            </div>
            {totals.totalDiscountPiastres > 0 && (
              <div className="flex justify-between text-sm text-[#2E8B57]">
                <span>{t.discount.label}</span>
                <span className="font-mono">− {formatPrice(totals.totalDiscountPiastres)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-[#64748B]">
              <span>{t.pos.tax}</span>
              <span className="font-mono">{formatPrice(totals.taxPiastres)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#F1F5F9]">
              <span className="font-bold text-[#0F172A]">{t.pos.total}</span>
              <span className="font-bold text-xl text-[#0F172A] font-mono">{formatPrice(totals.totalPiastres)}</span>
            </div>
            {/* Per-cart discount control */}
            <div className="pt-1">
              {cartDiscount ? (
                <button
                  onClick={() => setCartDiscount(undefined)}
                  className="w-full text-xs font-medium text-[#2E8B57] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg py-1.5 px-2 flex items-center justify-center gap-1 hover:bg-[#DCFCE7]"
                >
                  {t.discount.label}:{' '}
                  {cartDiscount.type === 'percentage'
                    ? `−${cartDiscount.value}%`
                    : `−${formatPrice(cartDiscount.value)}`}
                  {cartDiscount.managerApprovedBy ? ' 👔' : ''} ✕
                </button>
              ) : (
                <button
                  onClick={() => setDiscountTarget({ kind: 'cart' })}
                  disabled={cart.length === 0}
                  className="w-full text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg py-1.5 px-2 hover:bg-[#F0FDF4] hover:border-[#2E8B57] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {t.discount.addCart}
                </button>
              )}
            </div>
          </div>

          {/* Customer banner */}
          {customer ? (
            <div className="mx-4 mb-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-800 font-cairo truncate">
                  {customer.loyalty.rewardReady ? '🎉 ' : ''}{customer.name ?? customer.phone}
                </p>
                <p className="text-[10px] text-emerald-600 font-cairo mt-0.5">
                  {customer.loyalty.enabled && customer.loyalty.rewardReady
                    ? t.customer.loyalty.rewardReady
                    : `${customer.loyalty.currentStamps}/${customer.loyalty.stampsRequired} ${t.customer.loyalty.stamps}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!customer.loyalty.rewardReady && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(customer.loyalty.stampsRequired, 10) }).map((_, i) => (
                      <span
                        key={i}
                        className={`text-[10px] leading-none ${
                          i < Math.min(customer.loyalty.currentStamps, 10)
                            ? 'text-emerald-600'
                            : customer.loyalty.enabled ? 'text-emerald-200' : 'text-[#CBD5E1]'
                        }`}
                      >
                        {i < Math.min(customer.loyalty.currentStamps, 10) ? '●' : '○'}
                      </span>
                    ))}
                    {customer.loyalty.stampsRequired > 10 && (
                      <span className="text-[9px] text-emerald-500 ml-0.5">+{customer.loyalty.stampsRequired - 10}</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setCustomer(null)}
                  className="text-emerald-400 hover:text-emerald-700 text-sm leading-none ml-1"
                  aria-label="clear customer"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          {modules.kds && activeOrderId && (
            <div className="mx-4 mb-2">
              <CoursePanel
                orderId={activeOrderId}
                token={sessionStorage.getItem(TOKEN_KEY) ?? ''}
                lang={lang}
                onCoursesFired={() => {
                  setKdsToast(t.course.fired);
                  setTimeout(() => setKdsToast(null), 3500);
                }}
              />
            </div>
          )}

          <div className="p-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="bg-[#2E8B57] hover:bg-[#1A5C3A] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold text-base transition-colors"
            >
              {t.pos.cash}
            </button>
            <button
              onClick={() => setShowCardModal(true)}
              disabled={cart.length === 0}
              className="bg-[#1A5276] hover:bg-[#154360] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold text-base transition-colors"
            >
              {t.pos.card}
            </button>
            <button
              onClick={() => setShowLanaModal(true)}
              disabled={cart.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold text-base transition-colors"
            >
              {t.lana.posButtonLabel}
            </button>
          </div>

          {/* Split payment button */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowSplitModal(true)}
              disabled={cart.length === 0}
              className="w-full border border-[#FF9800] text-[#FF9800] hover:bg-[#FF9800]/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-2.5 font-semibold text-sm transition-colors"
            >
              {t.zReport.splitPayment}
            </button>
          </div>

          {/* Credit ledger (كريدي) button */}
          <div className="px-4 pb-2 flex flex-col gap-1">
            <button
              onClick={() => setShowCreditSearch(true)}
              className={`w-full py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                creditCustomer
                  ? 'border-red-400 bg-red-900/20 text-red-300 hover:bg-red-900/30'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {creditCustomer
                ? t.credit.buttonWithName.replace('{name}', creditCustomer.name_ar)
                : t.credit.buttonEmpty}
            </button>
            {creditCustomer && (
              <button
                onClick={() => setShowCreditTab(true)}
                className="w-full py-1.5 rounded-xl border border-red-400/30 text-red-300 text-xs font-semibold hover:bg-red-900/10 transition-colors"
              >
                {t.credit.viewBalance.replace('{name}', creditCustomer.name_ar)} {lang === 'ar' ? '←' : '→'}
              </button>
            )}
          </div>

          {kdsEnabled && cart.length > 0 && (
            <div className="px-4 pb-2">
              <button
                onClick={() => setShowKdsSendModal(true)}
                className="w-full py-2.5 rounded-xl border-2 border-orange-300 bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 transition-colors"
              >
                🍳 {t.kds.sendToKitchen}
              </button>
            </div>
          )}

          {kdsToast && (
            <div className="mx-4 mb-2 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium text-center">
              {kdsToast}
            </div>
          )}

          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={() => setShowCustomerLookup(true)}
              disabled={!shiftId}
              className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                customer
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              👤 {t.customer.title}
            </button>
            <button
              onClick={() => setShowReturnModal(true)}
              disabled={!shiftId}
              className="flex-1 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ↩ {t.returns.buttonLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Discount editor (per-line or per-cart) */}
      {discountTarget && (
        <DiscountModal
          baseAmountPiastres={discountBase}
          scope={discountTarget.kind}
          existing={existingDiscount}
          onApply={applyDiscount}
          onCancel={() => setDiscountTarget(null)}
        />
      )}

      {/* Manager PIN modal — shown when a cashier tries a discount > 20% */}
      {pendingDiscount && (
        <ManagerPinModal
          action="discount_over_limit"
          note={pendingDiscount.type === 'percentage'
            ? t.pos.discountNotePct.replace('{n}', String(pendingDiscount.value))
            : t.pos.discountNoteFixed.replace('{n}', String(pendingDiscount.value))}
          onAuthorized={(result: ManagerOverrideResult) => {
            commitDiscount(pendingDiscount, result.manager_id);
            setPendingDiscount(null);
          }}
          onCancel={() => {
            setPendingDiscount(null);
            setDiscountTarget(null);
          }}
        />
      )}

      {/* Customer lookup modal */}
      {showCustomerLookup && shiftId && (
        <CustomerLookupModal
          tenantId={TENANT_ID}
          onCustomerSelected={(c) => { setCustomer(c); setShowCustomerLookup(false); }}
          onClose={() => setShowCustomerLookup(false)}
        />
      )}

      {/* Cash payment modal */}
      {showPayment && shiftId && (
        <CashPaymentModal
          totalPiastres={totals.totalPiastres}
          cartLines={cart}
          cartDiscount={cartDiscount}
          shiftId={shiftId}
          customer={customer}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          onStampComplete={(loyalty) => setCustomer((prev) => prev ? { ...prev, loyalty } : null)}
        />
      )}

      {/* Card payment modal */}
      {showCardModal && shiftId && (
        <CardPaymentModal
          totalPiastres={totals.totalPiastres}
          cartLines={cart}
          cartDiscount={cartDiscount}
          shiftId={shiftId}
          customer={customer}
          onClose={() => setShowCardModal(false)}
          onSuccess={handleCardPaymentSuccess}
          onStampComplete={(loyalty) => setCustomer((prev) => prev ? { ...prev, loyalty } : null)}
        />
      )}

      {/* Lana Cash payment modal */}
      {showLanaModal && shiftId && (
        <LanaPaymentModal
          totalPiastres={totals.totalPiastres}
          cartLines={cart}
          cartDiscount={cartDiscount}
          shiftId={shiftId}
          customer={customer}
          onClose={() => setShowLanaModal(false)}
          onSuccess={handleLanaPaymentSuccess}
          onStampComplete={(loyalty) => setCustomer((prev) => prev ? { ...prev, loyalty } : null)}
        />
      )}

      {/* Split payment modal */}
      {showSplitModal && shiftId && (
        <SplitPaymentModal
          totalPiastres={totals.totalPiastres}
          cartLines={cart}
          cartDiscount={cartDiscount}
          shiftId={shiftId}
          onClose={() => setShowSplitModal(false)}
          onSuccess={handleSplitPaymentSuccess}
        />
      )}

      {/* Return / refund modal */}
      {showReturnModal && shiftId && (
        <ReturnModal
          cashierId={cashierId}
          shiftId={shiftId}
          onDone={() => setShowReturnModal(false)}
        />
      )}

      {modules.barcode && showScanner && (
        <BarcodeScanner
          title={t.pos.scanProduct}
          onDetected={(code) => {
            setShowScanner(false);
            handleBarcodeScanned(code);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showPluModal && (
        <PluModal
          products={products}
          onProductFound={(product) => {
            addToCart(product);
            setShowPluModal(false);
          }}
          onClose={() => setShowPluModal(false)}
        />
      )}

      {showQrFor && (
        <ProductQRCode
          product={showQrFor}
          onClose={() => setShowQrFor(null)}
        />
      )}

      {/* Scale widget — Web Serial DIBAL/Brecknell connection */}
      {modules.scale && showScaleSetup && (
        <ScaleWidget
          onWeightConfirmed={(weightKg) => {
            const product = products.find((p) => p.product_id === selectedWeightedId);
            if (product) {
              setCart((current) => [...current, buildCartLine(product, weightKg)]);
              setSelectedWeightedId(null);
            }
            setShowScaleSetup(false);
          }}
          onClose={() => setShowScaleSetup(false)}
        />
      )}

      {/* Scale toast */}
      {scaleToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1E293B] text-white text-sm px-5 py-3 rounded-xl shadow-lg">
          {scaleToast}
        </div>
      )}

      {/* Markdown label print modal */}
      {markdownLabelProduct && (
        <MarkdownLabel
          product={markdownLabelProduct}
          onClose={() => setMarkdownLabelProduct(null)}
        />
      )}

      {showOrdersPanel && (
        <OrdersPanel onClose={() => { setShowOrdersPanel(false); void pollOrders(); }} />
      )}

      {/* KDS send-to-kitchen modal */}
      {showKdsSendModal && (
        <KdsSendModal
          cart={cart}
          lang={lang}
          tableId={activeTable?.table_id ?? null}
          t={t.kds}
          onClose={() => setShowKdsSendModal(false)}
          onSent={(msg, orderId) => {
            setShowKdsSendModal(false);
            setActiveOrderId(orderId);
            setKdsToast(msg);
            setTimeout(() => setKdsToast(null), 3500);
            // Cart is NOT cleared — payment still needed separately.
          }}
        />
      )}

      {/* ── Low-stock alert panel (MANAGER / SUPERVISOR only) ─────────────── */}
      {showStockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-lg font-bold text-[#0F172A]">⚠ {t.stock.alertTitle}</h2>
              <button
                onClick={() => setShowStockAlert(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none"
                aria-label={t.stock.close}
              >
                ×
              </button>
            </div>

            {/* Product list */}
            <div className="overflow-y-auto max-h-80 p-4">
              {lowStockProducts.length === 0 ? (
                <p className="text-center text-[#94A3B8] py-4">{t.stock.alertEmpty}</p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((p) => {
                    const isZero = p.stock_quantity === 0;
                    const effectiveThreshold = Math.max(p.low_stock_threshold, GLOBAL_THRESHOLD);
                    const qtyLabel = isZero
                      ? t.stock.outOfStock
                      : p.is_weighted
                        ? `${(p.stock_quantity / 1000).toFixed(1)} ${t.stock.kg}`
                        : `${p.stock_quantity} ${t.stock.units}`;
                    return (
                      <div
                        key={p.product_id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          isZero
                            ? 'bg-red-50 border-red-200'
                            : 'bg-amber-50 border-amber-200'
                        }`}
                      >
                        <div className="text-start flex-1 min-w-0">
                          <p className="font-semibold text-sm text-[#0F172A]">
                            {pickName(lang, p.name_ar, p.name_fr)}
                          </p>
                          <p className="text-xs text-[#64748B]">
                            {t.stock.threshold}: {effectiveThreshold}
                          </p>
                          {/* Waste risk badge — only for perishables with a scored lot */}
                          {p.is_perishable && wasteRiskMap[p.product_id] && (() => {
                            const risk = wasteRiskMap[p.product_id]!;
                            const badge = risk.riskLevel === 'high' ? '🔴' : risk.riskLevel === 'medium' ? '🟡' : '🟢';
                            return (
                              <div className="mt-1 flex flex-wrap gap-1 items-center">
                                <span className="text-xs">{badge}</span>
                                {risk.recommendedMarkdownPct != null && (
                                  <span className="text-xs text-[#64748B]">
                                    {t.pos.markdownSuggestion.replace('{n}', String(risk.recommendedMarkdownPct))}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ms-3 ${
                          isZero ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {qtyLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setShowStockAlert(false)}
                className="w-full bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] font-medium py-2.5 rounded-xl transition-colors border border-[#E2E8F0]"
              >
                {t.stock.close}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Credit customer search */}
      {showCreditSearch && (
        <CustomerSearch
          token={sessionStorage.getItem(TOKEN_KEY) ?? ''}
          onSelect={(c) => {
            setCreditCustomer(c);
            setShowCreditSearch(false);
          }}
          onClose={() => setShowCreditSearch(false)}
        />
      )}

      {/* Credit customer tab (balance + charge/payment) */}
      {showCreditTab && creditCustomer && (
        <CustomerTab
          customer={creditCustomer}
          token={sessionStorage.getItem(TOKEN_KEY) ?? ''}
          onClose={() => setShowCreditTab(false)}
          onCharge={async (_id, _amt) => {}}
          onPayment={async (_id, _amt) => {}}
          onBalanceUpdate={(bal) => {
            setCreditCustomer(prev => prev ? { ...prev, balance: bal } : null);
          }}
        />
      )}

      {/* Printer setup modal */}
      {showPrinterSetup && (
        <PrinterWidget onClose={() => setShowPrinterSetup(false)} />
      )}

      {/* Table map modal */}
      {showTableMap && (
        <TableMap
          token={sessionStorage.getItem(TOKEN_KEY) ?? ''}
          onSelect={(t) => { setActiveTable(t); setShowTableMap(false); }}
          onClose={() => setShowTableMap(false)}
        />
      )}

      {/* Modifier picker modal */}
      {showModifierPicker && pendingProduct && (
        <ModifierPicker
          token={sessionStorage.getItem(TOKEN_KEY) ?? ''}
          productId={pendingProduct.product_id}
          productNameAr={pendingProduct.name_ar}
          basePrice={pendingProduct.effective_price_cents / 100}
          onConfirm={(_mods: SelectedModifier[], _finalPrice: number) => {
            setShowModifierPicker(false);
            setPendingProduct(null);
          }}
          onClose={() => { setShowModifierPicker(false); setPendingProduct(null); }}
        />
      )}
    </main>
  );
}
