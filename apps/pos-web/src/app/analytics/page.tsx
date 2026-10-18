'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '../../lib/cart';
import { useLanguage } from '../../context/LanguageContext';
import type { Translations } from '../../lib/i18n';
import { pickName } from '../../lib/names';
import { formatMoney } from '../../lib/format';
import { apiFetch, TOKEN_KEY } from '../../lib/api';
import { ForecastWidget } from '../../components/analytics/ForecastWidget';
import { CashFlowWidget } from '../../components/analytics/CashFlowWidget';
import { CustomerInsightPanel } from '../../components/analytics/CustomerInsightPanel';
import { AnalyticsAssistant } from '../../components/analytics/AnalyticsAssistant';

// recharts v2 components are not yet typed for React 19.2 JSX. Cast them to a
// compatible type until recharts ships updated type declarations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RC = {
  XAxis: XAxis as any,
  YAxis: YAxis as any,
  Tooltip: Tooltip as any,
  Area: Area as any,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashierIntegrity {
  staffId: string;
  nameAr: string;
  nameFr: string;
  role: string;
  totalTransactions: number;
  voidedCount: number;
  voidRate: number;
  largeDiscounts: number;
  discountRate: number;
  cashCount: number;
  cashShare: number;
  largeReturns: number;
  returnRate: number;
  avgTxSeconds: number | null;
  avgCashDiscrepancy: number | null;
  anomalyCount: number;
}
interface IntegrityThresholds {
  voidRateMax: number; discountRateMax: number; returnRateMax: number;
  txSecondsMin: number; cashShareMax: number; cashDiscrepancyMax: number;
}
interface IntegrityData { cashiers: CashierIntegrity[]; thresholds: IntegrityThresholds }

interface Summary {
  totalTransactions: number;
  totalSalesPiastres: number;
  cashSalesPiastres: number;
  cardSalesPiastres: number;
  totalShifts: number;
  activeDays: number;
}
interface DayData { date: string; txCount: number; salesPiastres: number }
interface TopProduct { productId: string; nameAr: string; qty: number; revenuePiastres: number }
interface WasteReason { reasonCode: string; count: number; grams: number }
interface WasteSummary { totalRecords: number; totalGrams: number; byReason: WasteReason[] }
interface ShiftData { shiftId: string; cashierNameAr: string | null; openedAt: string; closedAt: string | null; salesPiastres: number; txCount: number }
interface AnalyticsData {
  summary: Summary;
  salesByDay: DayData[];
  topProducts: TopProduct[];
  wasteSummary: WasteSummary;
  shifts: ShiftData[];
}

// Cross-store comparison (Stores tab — SUPERVISOR only)
interface StoreSummary {
  storeId: string;
  storeNameAr: string;
  storeNameFr: string;
  transactionCount: number;
  totalSalesPiastres: number;
  totalDiscountPiastres: number;
  totalWasteGrams: number;
  wasteRecordCount: number;
}
interface StoresReport { dateFrom: string; dateTo: string; stores: StoreSummary[] }
interface StoreDetail {
  storeId: string;
  storeNameAr: string;
  storeNameFr: string;
  summary: Summary;
  salesByDay: DayData[];
  topProducts: TopProduct[];
  wasteSummary: WasteSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_COLORS: Record<string, { bar: string; badge: string }> = {
  SPOILED: { bar: 'bg-red-400', badge: 'bg-red-50 text-red-700' },
  EXPIRED: { bar: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700' },
  PREP_DAMAGE: { bar: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700' },
  OTHER: { bar: 'bg-gray-300', badge: 'bg-gray-50 text-gray-600' },
};

function buildFullSeries(salesByDay: DayData[], rangeDays: number): { date: string; sales: number }[] {
  const map = new Map<string, number>();
  for (const d of salesByDay) map.set(d.date, d.salesPiastres);
  const result: { date: string; sales: number }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().split('T')[0];
    result.push({ date: key, sales: Math.round((map.get(key) ?? 0) / 100) });
  }
  return result;
}

function formatDateTime(iso: string | null, lang: string): string {
  if (!iso) return '—';
  const loc = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  return new Date(iso).toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateRange(daysAgo: number, lang: string): string {
  const loc = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  const from = new Date(Date.now() - daysAgo * 86_400_000);
  const to = new Date();
  const fmt = (d: Date) => d.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
  return `${fmt(from)} — ${fmt(to)}`;
}

function shiftDuration(openedAt: string, closedAt: string | null): string {
  if (!closedAt) return '—';
  const mins = Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  const [role, setRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'integrity' | 'stores'>('overview');
  const [integrityData, setIntegrityData] = useState<IntegrityData | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityError, setIntegrityError] = useState<string | null>(null);
  const [selectedCashier, setSelectedCashier] = useState<CashierIntegrity | null>(null);
  // Stores tab (SUPERVISOR only)
  const [storesData, setStoresData] = useState<StoresReport | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeDetail, setStoreDetail] = useState<StoreDetail | null>(null);
  const [storeDetailLoading, setStoreDetailLoading] = useState(false);
  const [storeDetailError, setStoreDetailError] = useState<string | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    setRole(sessionStorage.getItem('greengo_cashier_role'));
    setTenantId(sessionStorage.getItem('greengo_tenant_id'));
    setToken(sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY) ?? '');
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const to = new Date().toISOString();
    apiFetch(`/api/analytics?tenantId=${encodeURIComponent(tenantId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<AnalyticsData>; })
      .then(setData)
      .catch(() => setError(t.analytics.noData))
      .finally(() => setLoading(false));
  }, [tenantId, days, t.analytics.noData]);

  useEffect(() => {
    if (!tenantId || activeTab !== 'integrity') return;
    setIntegrityLoading(true);
    setIntegrityError(null);
    setSelectedCashier(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const to   = new Date().toISOString();
    apiFetch(`/api/analytics/integrity?tenantId=${encodeURIComponent(tenantId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<IntegrityData>; })
      .then(setIntegrityData)
      .catch(() => setIntegrityError(t.integrity.noData))
      .finally(() => setIntegrityLoading(false));
  }, [tenantId, days, activeTab, t.integrity.noData]);

  // Stores comparison — tenantId from JWT (backend), date window from `days`.
  useEffect(() => {
    if (activeTab !== 'stores' || (role !== 'MANAGER' && role !== 'SUPERVISOR')) return;
    setStoresLoading(true);
    setStoresError(null);
    setSelectedStoreId(null);
    setStoreDetail(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const to   = new Date().toISOString();
    apiFetch(`/api/analytics/stores?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<StoresReport>; })
      .then(setStoresData)
      .catch(() => setStoresError(t.stores.noStores))
      .finally(() => setStoresLoading(false));
  }, [activeTab, role, days, t.stores.noStores]);

  // Store drilldown — fetched when a store row is selected.
  useEffect(() => {
    if (!selectedStoreId || (role !== 'MANAGER' && role !== 'SUPERVISOR')) { setStoreDetail(null); return; }
    setStoreDetailLoading(true);
    setStoreDetailError(null);
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const to   = new Date().toISOString();
    apiFetch(`/api/analytics/stores/${encodeURIComponent(selectedStoreId)}/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<StoreDetail>; })
      .then(setStoreDetail)
      .catch(() => setStoreDetailError(t.analytics.noData))
      .finally(() => setStoreDetailLoading(false));
  }, [selectedStoreId, role, days, t.analytics.noData]);

  const cashPct = useMemo(() => {
    if (!data || data.summary.totalSalesPiastres === 0) return 0;
    return Math.round((data.summary.cashSalesPiastres / data.summary.totalSalesPiastres) * 100);
  }, [data]);

  const fullSeries = useMemo(() => data ? buildFullSeries(data.salesByDay, days) : [], [data, days]);

  // Access denied
  if (role !== null && role !== 'MANAGER' && role !== 'SUPERVISOR') {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md text-center shadow-sm">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-lg font-bold text-[#0F172A]">{t.analytics.accessDenied}</p>
          <button onClick={() => router.push('/pos')} className="mt-6 px-6 py-2 rounded-xl bg-[#2E8B57] text-white font-medium hover:bg-[#1A5C3A] transition-colors">
            ← {t.analytics.backToPos}
          </button>
        </div>
      </main>
    );
  }

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <button onClick={() => router.push('/pos')} className="text-sm text-[#64748B] hover:text-[#0F172A] mb-3 block">
            ← {t.analytics.backToPos}
          </button>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight font-cairo">
                {t.analytics.title}
              </h1>
              <p className="text-sm text-[#64748B] mt-1">
                {formatDateRange(days, lang)} · {s?.totalShifts ?? 0} {t.analytics.shifts.toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E2E8F0] p-1 shadow-sm">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    days === d ? 'bg-[#2E8B57] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {t.analytics.daysLabel.replace('{days}', String(d))}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── TAB BAR ────────────────────────────────────────────────── */}
        {/* Stores tab: MANAGER+SUPERVISOR (MANAGER is the highest live POS role). */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-[#E2E8F0] p-1 shadow-sm w-fit">
          {(['overview', 'integrity', ...((role === 'MANAGER' || role === 'SUPERVISOR') ? ['stores'] as const : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 font-cairo ${
                activeTab === tab ? 'bg-[#2E8B57] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              {tab === 'overview'
                ? t.analytics.overviewTab
                : tab === 'integrity'
                  ? t.integrity.tabLabel
                  : t.stores.tabLabel}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">{error}</div>}

        {activeTab === 'integrity' && (
          <IntegrityTab
            data={integrityData}
            loading={integrityLoading}
            error={integrityError}
            selected={selectedCashier}
            onSelect={setSelectedCashier}
            lang={lang}
            t={t.integrity}
          />
        )}

        {activeTab === 'stores' && (
          (role !== 'MANAGER' && role !== 'SUPERVISOR') ? (
            <p className="text-sm text-[#94A3B8] text-center py-12 font-cairo">{t.stores.accessDenied}</p>
          ) : (
            <StoresTab
              report={storesData}
              loading={storesLoading}
              error={storesError}
              selectedStoreId={selectedStoreId}
              onSelectStore={setSelectedStoreId}
              detail={storeDetail}
              detailLoading={storeDetailLoading}
              detailError={storeDetailError}
              days={days}
              lang={lang}
              t={t.stores}
              tA={t.analytics}
              tWaste={t.waste}
              noData={t.analytics.noData}
            />
          )
        )}

        {activeTab !== 'overview' ? null : (<>

        {/* ── STAT CARDS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading || !s ? (
            <>{[1,2,3,4].map(i => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-2xl h-36" />)}</>
          ) : (
            <>
              <EnhancedStatCard
                icon="💰" iconBg="bg-emerald-50"
                label={t.analytics.totalSales}
                value={formatMoney(s.totalSalesPiastres / 100, lang)}
                subtext={`${(s.cashSalesPiastres / 100).toFixed(0)} MAD ${t.analytics.cashPayments} · ${(s.cardSalesPiastres / 100).toFixed(0)} MAD ${t.analytics.cardPayments}`}
              />
              <EnhancedStatCard
                icon="🧾" iconBg="bg-blue-50"
                label={t.analytics.transactions}
                value={String(s.totalTransactions)}
                subtext={s.totalTransactions > 0 ? `${(s.totalSalesPiastres / 100 / s.totalTransactions).toFixed(2)} MAD / tx` : '—'}
              />
              <EnhancedStatCard
                icon="📋" iconBg="bg-violet-50"
                label={t.analytics.shifts}
                value={String(s.totalShifts)}
                subtext={t.analytics.activeDays.replace('{n}', String(s.activeDays))}
              />
              <EnhancedStatCard
                icon="🗑️" iconBg="bg-amber-50"
                label={t.analytics.wasteRecorded}
                value={`${(data.wasteSummary.totalGrams / 1000).toFixed(2)} ${t.analytics.kg}`}
                subtext={t.analytics.wasteRecordsCount.replace('{n}', String(data.wasteSummary.totalRecords))}
              />
            </>
          )}
        </div>

        {/* ── CASH FLOW WIDGET ───────────────────────────────────────── */}
        <div className="mb-6">
          <CashFlowWidget token={token} />
        </div>

        {/* ── FORECAST WIDGET ────────────────────────────────────────── */}
        <div className="mb-6">
          <ForecastWidget token={token} />
        </div>

        {/* ── CUSTOMER INSIGHT PANEL ─────────────────────────────────── */}
        <div className="mb-6">
          <CustomerInsightPanel token={token} />
        </div>

        {/* ── ANALYTICS ASSISTANT ────────────────────────────────────── */}
        <div className="mb-6">
          <AnalyticsAssistant token={token} />
        </div>

        {/* ── CHARTS ROW ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Sales trend — 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-[#0F172A] font-cairo">
                {t.analytics.salesTrend.replace('{days}', String(days))}
              </h3>
              {s && (
                <span className="text-2xl font-bold text-[#2E8B57] tracking-tight">
                  {formatMoney(s.totalSalesPiastres / 100, lang)}
                </span>
              )}
            </div>
            {loading || !data ? (
              <div className="animate-pulse bg-[#E2E8F0] rounded-xl h-[220px]" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={fullSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E8B57" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2E8B57" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <RC.XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false} tickLine={false}
                  />
                  <RC.YAxis
                    tickFormatter={(v: number) => String(v)}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false} tickLine={false} width={40}
                  />
                  <RC.Tooltip
                    formatter={(v: number) => [formatMoney(v, lang), t.analytics.salesLabel]}
                    labelFormatter={(l: string) => new Date(l).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '13px' }}
                  />
                  <RC.Area type="monotone" dataKey="sales" stroke="#2E8B57" strokeWidth={2} fill="url(#salesGrad)" dot={{ r: 3, fill: '#2E8B57', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#2E8B57' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment split — 1 col */}
          <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-cairo">{t.analytics.paymentSplit}</h3>
            {loading || !s ? (
              <div className="animate-pulse bg-[#E2E8F0] rounded-full w-36 h-36 mx-auto" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative w-36 h-36 mb-4">
                  <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#2E8B57 0% ${cashPct}%, #1A5276 ${cashPct}% 100%)` }} />
                  <div className="absolute inset-4 rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#0F172A]">{s.totalTransactions}</span>
                    <span className="text-[10px] text-[#94A3B8] font-cairo">{t.analytics.txShort}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-emerald-700">{formatMoney(s.cashSalesPiastres / 100, lang, 0)}</div>
                    <div className="text-xs text-emerald-600 mt-0.5 font-cairo">{t.analytics.cashPayments} ({cashPct}%)</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-blue-700">{formatMoney(s.cardSalesPiastres / 100, lang, 0)}</div>
                    <div className="text-xs text-blue-600 mt-0.5 font-cairo">{t.analytics.cardPayments} ({100 - cashPct}%)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── PRODUCTS + WASTE ROW ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top products — ranked list with revenue bars */}
          <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#0F172A] font-cairo">{t.analytics.topProducts}</h3>
              {data && data.topProducts.length > 0 && (
                <span className="text-xs font-semibold text-[#2E8B57] bg-emerald-50 px-2.5 py-0.5 rounded-full">{data.topProducts.length}</span>
              )}
            </div>
            {loading || !data ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-lg h-12" />)}</div>
            ) : data.topProducts.length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center py-8">{t.analytics.noData}</p>
            ) : (
              <div>
                {data.topProducts.map((p, i) => {
                  const maxRev = data.topProducts[0]?.revenuePiastres ?? 1;
                  const pct = Math.round((p.revenuePiastres / maxRev) * 100);
                  const rankClass = i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-[#F8FAFC] text-[#94A3B8]';
                  return (
                    <div key={p.productId} className="flex items-center gap-3 py-3 border-b border-[#F8FAFC] last:border-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankClass}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[#0F172A] font-cairo truncate" dir="rtl">{p.nameAr}</span>
                          <span className="text-sm font-semibold text-[#2E8B57] flex-shrink-0 ms-2">{formatMoney(p.revenuePiastres / 100, lang, 0)}</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2E8B57] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-[#94A3B8] flex-shrink-0">{p.qty}x</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Waste analysis — insight card */}
          <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-[#0F172A] font-cairo">{t.analytics.wasteAnalysis}</h3>
              {data && (
                <div className="text-end">
                  <div className="text-2xl font-bold text-amber-600">{(data.wasteSummary.totalGrams / 1000).toFixed(2)} {t.analytics.kg}</div>
                  <div className="text-xs text-[#94A3B8] font-cairo">{t.analytics.totalWaste}</div>
                </div>
              )}
            </div>
            {loading || !data ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-lg h-10" />)}</div>
            ) : data.wasteSummary.byReason.length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center py-4 font-cairo">{t.analytics.noWasteRecords}</p>
            ) : (
              <div className="space-y-3">
                {data.wasteSummary.byReason.map((r) => {
                  const colors = WASTE_COLORS[r.reasonCode] ?? WASTE_COLORS['OTHER'];
                  const pct = data.wasteSummary.totalRecords > 0 ? Math.round((r.count / data.wasteSummary.totalRecords) * 100) : 0;
                  return (
                    <div key={r.reasonCode} className="mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full font-cairo ${colors.badge}`}>
                          {t.waste.reason[r.reasonCode as keyof typeof t.waste.reason] ?? r.reasonCode}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{r.count} {t.analytics.recordsShort} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── SHIFTS TABLE ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-cairo">{t.analytics.shiftsPerformance}</h3>
          {loading || !data ? (
            <div className="animate-pulse bg-[#E2E8F0] rounded-xl h-40" />
          ) : data.shifts.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8 font-cairo">{t.analytics.noShifts}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFAFA] text-[10px] uppercase tracking-widest text-[#94A3B8] font-semibold border-b border-[#F1F5F9]">
                    <th className="text-start px-4 py-3">{t.analytics.colCashier}</th>
                    <th className="text-start px-4 py-3">{t.analytics.colOpened}</th>
                    <th className="text-start px-4 py-3">{t.analytics.colClosed}</th>
                    <th className="text-start px-4 py-3">{t.analytics.duration}</th>
                    <th className="text-end px-4 py-3">{t.analytics.colSales}</th>
                    <th className="text-end px-4 py-3">{t.analytics.colTx}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shifts.map((sh) => (
                    <tr key={sh.shiftId} className="hover:bg-[#FAFAFA] border-b border-[#F8FAFC] last:border-0 text-sm">
                      <td className="px-4 py-3 text-[#0F172A] font-medium font-cairo">{sh.cashierNameAr ?? '—'}</td>
                      <td className="px-4 py-3 text-[#64748B] text-xs">{formatDateTime(sh.openedAt, lang)}</td>
                      <td className="px-4 py-3 text-[#64748B] text-xs">{formatDateTime(sh.closedAt, lang)}</td>
                      <td className="px-4 py-3 text-[#64748B] text-xs font-mono">{shiftDuration(sh.openedAt, sh.closedAt)}</td>
                      <td className="px-4 py-3 text-end text-[#2E8B57] font-mono text-xs font-semibold">{formatPrice(sh.salesPiastres)}</td>
                      <td className="px-4 py-3 text-end text-[#64748B] font-mono text-xs">{sh.txCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        </>)}
      </div>
    </div>
  );
}

// ─── Enhanced Stat Card ───────────────────────────────────────────────────────

function EnhancedStatCard({ icon, iconBg, label, value, subtext }: {
  icon: string; iconBg: string; label: string; value: string; subtext: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[#64748B] font-cairo">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${iconBg}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-[#0F172A] tracking-tight mb-1">{value}</div>
      <div className="text-xs text-[#94A3B8] font-cairo">{subtext}</div>
    </div>
  );
}

// ─── Integrity Tab ────────────────────────────────────────────────────────────

type IntegrityTranslations = {
  tabLabel: string; title: string; loading: string; noData: string;
  colCashier: string; colTotalTx: string; colVoidRate: string; colDiscountRate: string;
  colReturnRate: string; colCashShare: string; colAvgTxTime: string;
  colCashDiscrepancy: string; colAnomalies: string; anomalyBadge: string;
  drilldownTitle: string; drilldownVoids: string; drilldownDiscounts: string;
  drilldownReturns: string; drilldownCashShare: string; drilldownAvgTime: string;
  drilldownDiscrepancy: string; disclaimer: string;
};

function IntegrityTab({ data, loading, error, selected, onSelect, lang, t }: {
  data: IntegrityData | null;
  loading: boolean;
  error: string | null;
  selected: CashierIntegrity | null;
  onSelect: (c: CashierIntegrity | null) => void;
  lang: string;
  t: IntegrityTranslations;
}) {
  if (loading) {
    return (
      <div className="space-y-3 mb-6">
        {[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-2xl h-14" />)}
      </div>
    );
  }
  if (error) {
    return <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">{error}</div>;
  }
  if (!data || data.cashiers.length === 0) {
    return <p className="text-sm text-[#94A3B8] text-center py-12 font-cairo">{t.noData}</p>;
  }

  const cashierName = (c: CashierIntegrity) => pickName(lang, c.nameAr, c.nameFr);

  return (
    <div className="mb-6 space-y-4">
      {/* disclaimer */}
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-cairo">
        ⚠️ {t.disclaimer}
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#FAFAFA] text-[10px] uppercase tracking-widest text-[#94A3B8] font-semibold border-b border-[#F1F5F9]">
              <th className="text-start px-4 py-3">{t.colCashier}</th>
              <th className="text-end px-4 py-3">{t.colTotalTx}</th>
              <th className="text-end px-4 py-3">{t.colVoidRate}</th>
              <th className="text-end px-4 py-3">{t.colDiscountRate}</th>
              <th className="text-end px-4 py-3">{t.colReturnRate}</th>
              <th className="text-end px-4 py-3">{t.colCashShare}</th>
              <th className="text-end px-4 py-3">{t.colAvgTxTime}</th>
              <th className="text-end px-4 py-3">{t.colCashDiscrepancy}</th>
              <th className="text-end px-4 py-3">{t.colAnomalies}</th>
            </tr>
          </thead>
          <tbody>
            {data.cashiers.map((c) => {
              const isSelected = selected?.staffId === c.staffId;
              const hasFlags = c.anomalyCount > 0;
              const thr = data.thresholds;
              return (
                <tr
                  key={c.staffId}
                  onClick={() => onSelect(isSelected ? null : c)}
                  className={`border-b border-[#F8FAFC] last:border-0 text-sm cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#F0FDF4]' : hasFlags ? 'hover:bg-red-50' : 'hover:bg-[#FAFAFA]'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-[#0F172A] font-cairo">{cashierName(c)}</td>
                  <td className="px-4 py-3 text-end text-[#64748B] font-mono text-xs">{c.totalTransactions}</td>
                  <FlagCell val={c.voidRate} threshold={thr.voidRateMax} fmt={(v) => `${v}%`} />
                  <FlagCell val={c.discountRate} threshold={thr.discountRateMax} fmt={(v) => `${v}%`} />
                  <FlagCell val={c.returnRate} threshold={thr.returnRateMax} fmt={(v) => `${v}%`} />
                  <FlagCell val={c.cashShare} threshold={thr.cashShareMax} fmt={(v) => `${v}%`} />
                  <td className={`px-4 py-3 text-end font-mono text-xs ${
                    c.avgTxSeconds != null && c.avgTxSeconds < thr.txSecondsMin ? 'text-red-600 font-semibold' : 'text-[#64748B]'
                  }`}>
                    {c.avgTxSeconds != null ? `${c.avgTxSeconds}s` : '—'}
                  </td>
                  <td className={`px-4 py-3 text-end font-mono text-xs ${
                    c.avgCashDiscrepancy != null && Math.abs(c.avgCashDiscrepancy) > thr.cashDiscrepancyMax
                      ? 'text-red-600 font-semibold' : 'text-[#64748B]'
                  }`}>
                    {c.avgCashDiscrepancy != null ? `${(c.avgCashDiscrepancy / 100).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {c.anomalyCount > 0
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold">{c.anomalyCount} {t.anomalyBadge}</span>
                      : <span className="text-xs text-[#94A3B8]">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* drilldown panel */}
      {selected && (
        <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#0F172A] font-cairo">{t.drilldownTitle} — {cashierName(selected)}</h3>
            <button onClick={() => onSelect(null)} className="text-xs text-[#64748B] hover:text-[#0F172A]">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <DrillCell label={t.drilldownVoids} value={`${selected.voidedCount} (${selected.voidRate}%)`} flagged={selected.voidRate > (data.thresholds.voidRateMax)} />
            <DrillCell label={t.drilldownDiscounts} value={`${selected.largeDiscounts} (${selected.discountRate}%)`} flagged={selected.discountRate > data.thresholds.discountRateMax} />
            <DrillCell label={t.drilldownReturns} value={`${selected.largeReturns} (${selected.returnRate}%)`} flagged={selected.returnRate > data.thresholds.returnRateMax} />
            <DrillCell label={t.drilldownCashShare} value={`${selected.cashShare}%`} flagged={selected.cashShare > data.thresholds.cashShareMax} />
            <DrillCell label={t.drilldownAvgTime} value={selected.avgTxSeconds != null ? `${selected.avgTxSeconds}s` : '—'} flagged={selected.avgTxSeconds != null && selected.avgTxSeconds < data.thresholds.txSecondsMin} />
            <DrillCell label={t.drilldownDiscrepancy} value={selected.avgCashDiscrepancy != null ? `MAD ${(selected.avgCashDiscrepancy / 100).toFixed(2)}` : '—'} flagged={selected.avgCashDiscrepancy != null && Math.abs(selected.avgCashDiscrepancy) > data.thresholds.cashDiscrepancyMax} />
          </div>
        </div>
      )}
    </div>
  );
}

function FlagCell({ val, threshold, fmt }: { val: number; threshold: number; fmt: (v: number) => string }) {
  const flagged = val > threshold;
  return (
    <td className={`px-4 py-3 text-end font-mono text-xs ${flagged ? 'text-red-600 font-semibold' : 'text-[#64748B]'}`}>
      {fmt(val)}
    </td>
  );
}

function DrillCell({ label, value, flagged }: { label: string; value: string; flagged: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${flagged ? 'bg-red-50 border border-red-200' : 'bg-[#F8FAFC]'}`}>
      <div className="text-[10px] uppercase tracking-wide text-[#94A3B8] mb-1 font-cairo">{label}</div>
      <div className={`text-sm font-semibold font-mono ${flagged ? 'text-red-700' : 'text-[#0F172A]'}`}>{value}</div>
    </div>
  );
}

// ─── Stores Tab (SUPERVISOR only) ─────────────────────────────────────────────

type StoresTranslations = {
  tabLabel: string; title: string; store: string; sales: string;
  transactions: string; waste: string; discounts: string; viewDetail: string;
  backToStores: string; noStores: string; accessDenied: string;
};
type WasteTranslations = { reason: Record<string, string> };

function StoresTab({
  report, loading, error, selectedStoreId, onSelectStore,
  detail, detailLoading, detailError, days, lang, t, tA, tWaste, noData,
}: {
  report: StoresReport | null;
  loading: boolean;
  error: string | null;
  selectedStoreId: string | null;
  onSelectStore: (id: string | null) => void;
  detail: StoreDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  days: number;
  lang: string;
  t: StoresTranslations;
  tA: Translations['analytics'];
  tWaste: WasteTranslations;
  noData: string;
}) {
  const storeName = (nameAr: string, nameFr: string) => pickName(lang, nameAr, nameFr);
  const wasteKg = tA.kg;

  // ── DRILLDOWN VIEW ──────────────────────────────────────────────────────
  if (selectedStoreId) {
    return (
      <div className="mb-6 space-y-4">
        <button
          onClick={() => onSelectStore(null)}
          className="text-sm text-[#64748B] hover:text-[#0F172A] flex items-center gap-1"
        >
          ← {t.backToStores}
        </button>

        {detailLoading || !detail ? (
          detailError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">{detailError}</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-2xl h-36" />)}
            </div>
          )
        ) : (
          <>
            <h2 className="text-xl font-bold text-[#0F172A] font-cairo">
              {storeName(detail.storeNameAr, detail.storeNameFr)}
            </h2>

            {/* Summary cards — reuse the Overview stat-card layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <EnhancedStatCard
                icon="💰" iconBg="bg-emerald-50"
                label={t.sales}
                value={`MAD ${(detail.summary.totalSalesPiastres / 100).toFixed(2)}`}
                subtext={`${(detail.summary.cashSalesPiastres / 100).toFixed(0)} MAD · ${(detail.summary.cardSalesPiastres / 100).toFixed(0)} MAD`}
              />
              <EnhancedStatCard
                icon="🧾" iconBg="bg-blue-50"
                label={t.transactions}
                value={String(detail.summary.totalTransactions)}
                subtext={detail.summary.totalTransactions > 0 ? `${(detail.summary.totalSalesPiastres / 100 / detail.summary.totalTransactions).toFixed(2)} MAD / tx` : '—'}
              />
              <EnhancedStatCard
                icon="📋" iconBg="bg-violet-50"
                label={tA.shiftsShort}
                value={String(detail.summary.totalShifts)}
                subtext={tA.activeDays.replace('{n}', String(detail.summary.activeDays))}
              />
              <EnhancedStatCard
                icon="🗑️" iconBg="bg-amber-50"
                label={t.waste}
                value={`${(detail.wasteSummary.totalGrams / 1000).toFixed(2)} ${wasteKg}`}
                subtext={`${detail.wasteSummary.totalRecords} ${tA.recordsShort}`}
              />
            </div>

            {/* Top products list */}
            <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-cairo">
                {tA.topProductsShort}
              </h3>
              {detail.topProducts.length === 0 ? (
                <p className="text-sm text-[#94A3B8] text-center py-8">{noData}</p>
              ) : (
                <div>
                  {detail.topProducts.map((p, i) => {
                    const maxRev = detail.topProducts[0]?.revenuePiastres ?? 1;
                    const pct = Math.round((p.revenuePiastres / maxRev) * 100);
                    const rankClass = i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-[#F8FAFC] text-[#94A3B8]';
                    return (
                      <div key={p.productId} className="flex items-center gap-3 py-3 border-b border-[#F8FAFC] last:border-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${rankClass}`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[#0F172A] font-cairo truncate" dir="rtl">{p.nameAr}</span>
                            <span className="text-sm font-semibold text-[#2E8B57] flex-shrink-0 ms-2">MAD {(p.revenuePiastres / 100).toFixed(0)}</span>
                          </div>
                          <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full bg-[#2E8B57] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-[#94A3B8] flex-shrink-0">{p.qty}x</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Waste by reason */}
            {detail.wasteSummary.byReason.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-4 font-cairo">{t.waste}</h3>
                <div className="space-y-3">
                  {detail.wasteSummary.byReason.map((r) => {
                    const colors = WASTE_COLORS[r.reasonCode] ?? WASTE_COLORS['OTHER'];
                    const pct = detail.wasteSummary.totalRecords > 0 ? Math.round((r.count / detail.wasteSummary.totalRecords) * 100) : 0;
                    return (
                      <div key={r.reasonCode}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full font-cairo ${colors.badge}`}>
                            {tWaste.reason[r.reasonCode] ?? r.reasonCode}
                          </span>
                          <span className="text-xs text-[#94A3B8]">{(r.grams / 1000).toFixed(2)} {wasteKg} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── COMPARISON VIEW (default) ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 mb-6">
        {[1, 2, 3].map((i) => <div key={i} className="animate-pulse bg-[#E2E8F0] rounded-2xl h-14" />)}
      </div>
    );
  }
  if (error) {
    return <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">{error}</div>;
  }
  if (!report || report.stores.length === 0) {
    return <p className="text-sm text-[#94A3B8] text-center py-12 font-cairo">{t.noStores}</p>;
  }

  return (
    <div className="mb-6 space-y-4">
      <p className="text-sm text-[#64748B] font-cairo">
        {t.title} · {formatDateRange(days, lang)}
      </p>
      <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#FAFAFA] text-[10px] uppercase tracking-widest text-[#94A3B8] font-semibold border-b border-[#F1F5F9]">
              <th className="text-start px-4 py-3">{t.store}</th>
              <th className="text-end px-4 py-3">{t.sales}</th>
              <th className="text-end px-4 py-3">{t.transactions}</th>
              <th className="text-end px-4 py-3">{t.discounts}</th>
              <th className="text-end px-4 py-3">{t.waste}</th>
              <th className="text-end px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {report.stores.map((st) => (
              <tr
                key={st.storeId}
                onClick={() => onSelectStore(st.storeId)}
                className="border-b border-[#F8FAFC] last:border-0 text-sm cursor-pointer hover:bg-[#FAFAFA] transition-colors"
              >
                <td className="px-4 py-3 font-medium text-[#0F172A] font-cairo">{storeName(st.storeNameAr, st.storeNameFr)}</td>
                <td className="px-4 py-3 text-end text-[#2E8B57] font-mono text-xs font-semibold">{formatPrice(st.totalSalesPiastres)}</td>
                <td className="px-4 py-3 text-end text-[#64748B] font-mono text-xs">{st.transactionCount}</td>
                <td className="px-4 py-3 text-end text-[#64748B] font-mono text-xs">{formatPrice(st.totalDiscountPiastres)}</td>
                <td className="px-4 py-3 text-end text-amber-600 font-mono text-xs">{(st.totalWasteGrams / 1000).toFixed(2)} {wasteKg}</td>
                <td className="px-4 py-3 text-end">
                  <span className="text-xs text-[#2E8B57] font-medium whitespace-nowrap">{t.viewDetail} →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
