// Pure logic for the manager "stock variances" page and the Tauri-only "rejected sales" list.
// No React, no network, no storage: everything here is unit-tested.

import { formatReceiptDateTime } from './printer/receipt-format';

// ── Who may see it ───────────────────────────────────────────────────────────

export const VARIANCE_VIEW_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;

/** MANAGER and above. This only decides what the UI shows; the server enforces the same rule. */
export function canViewVariances(role: string | null | undefined): boolean {
  return typeof role === 'string' && (VARIANCE_VIEW_ROLES as readonly string[]).includes(role);
}

// ── Server data ──────────────────────────────────────────────────────────────

export interface StockVariance {
  variance_id: string;
  product_id: string;
  product_name_ar: string | null;
  product_name_fr: string | null;
  uom: string | null;
  is_weighted: boolean;
  expected_qty: number;
  actual_qty: number;
  variance_qty: number;
  missing_qty: number;
  reason: string;
  register_id: string | null;
  register_name: string | null;
  transaction_id: string | null;
  detected_at: string;
  acknowledged_by: string | null;
  acknowledged_by_name_ar: string | null;
  acknowledged_by_name_fr: string | null;
  acknowledged_at: string | null;
}

export interface VarianceListResponse {
  items: StockVariance[];
  total: number;
  limit: number;
  offset: number;
}

export type StatusFilter = 'open' | 'acknowledged' | 'all';
export const PAGE_SIZE = 50;

export interface VarianceFilters {
  status: StatusFilter;
  limit?: number;
  offset?: number;
}

/** The query string for GET /stock-variances. Only what is set is sent; "all" sends no status filter. */
export function buildVarianceQuery(f: VarianceFilters): string {
  const p = new URLSearchParams();
  if (f.status === 'open') p.set('acknowledged', 'false');
  if (f.status === 'acknowledged') p.set('acknowledged', 'true');
  p.set('limit', String(f.limit ?? PAGE_SIZE));
  p.set('offset', String(f.offset ?? 0));
  return `?${p.toString()}`;
}

export interface PageInfo {
  from: number;
  to: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function pageInfo(total: number, offset: number, shown: number, limit: number = PAGE_SIZE): PageInfo {
  const from = shown === 0 ? 0 : offset + 1;
  const to = offset + shown;
  return { from, to, total, hasPrev: offset > 0, hasNext: offset + limit < total };
}

// ── Reasons ──────────────────────────────────────────────────────────────────

export type ReasonKey = 'oversell_offline' | 'late_sync' | 'oversell_online' | 'unknown';
const KNOWN_REASONS: readonly string[] = ['oversell_offline', 'late_sync', 'oversell_online'];

/** The server stores a short code; anything this build does not know is shown as "other", never raw. */
export function reasonKey(reason: string): ReasonKey {
  return KNOWN_REASONS.includes(reason) ? (reason as ReasonKey) : 'unknown';
}

export function reasonLabel(reason: string, labels: Record<ReasonKey, string>): string {
  return labels[reasonKey(reason)];
}

// ── Quantities and time ──────────────────────────────────────────────────────

/** Western digits, at most 3 decimals (the column precision), no thousands separator, no float noise. */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 });
}

/** The unit label for a product (UNIT, KG...), looked up regardless of case; '' when unknown. */
export function unitLabel(uom: string | null | undefined, labels: Record<string, string>): string {
  if (!uom) return '';
  return labels[uom.toUpperCase()] ?? '';
}

export function quantityWithUnit(n: number, uom: string | null | undefined, labels: Record<string, string>): string {
  const unit = unitLabel(uom, labels);
  return unit ? `${formatQuantity(n)} ${unit}` : formatQuantity(n);
}

/** How much was missing: what the sale needed minus what was on hand. Rounded to the column precision. */
export function missingQuantity(expected: number, actual: number): number {
  return Math.round((expected - actual) * 1000) / 1000;
}

/** "DD/MM/YYYY HH:mm:ss" in the tenant's time zone, Western digits. */
export function formatVarianceTime(iso: string, timeZone: string): string {
  return formatReceiptDateTime(iso, timeZone);
}

// ── Acknowledging ────────────────────────────────────────────────────────────

/**
 * After a successful acknowledge: in the "open" view the row leaves the list (and the total drops);
 * in the other views it is marked acknowledged in place.
 */
export function applyAcknowledged(
  items: StockVariance[],
  total: number,
  id: string,
  ack: { acknowledged_by: string | null; acknowledged_at: string | null },
  status: StatusFilter,
): { items: StockVariance[]; total: number } {
  if (status === 'open') {
    const next = items.filter((v) => v.variance_id !== id);
    return { items: next, total: Math.max(0, total - (items.length - next.length)) };
  }
  return {
    items: items.map((v) => (v.variance_id === id ? { ...v, ...ack } : v)),
    total,
  };
}
