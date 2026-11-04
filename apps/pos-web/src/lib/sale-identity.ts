// Sale identity: the id that turns a payment retry into a replay instead of a second sale.
// Pure helpers plus one fetch wrapper; the payment modals and the Tauri sync drain share them.

import { apiFetch } from './api';
import { getMachineId } from './license/machine-id';

export function newClientTxId(): string {
  return crypto.randomUUID();
}

// ── One id per sale ──────────────────────────────────────────────────────────

export interface SaleIdHolder {
  /** The current sale's id, created on first use and reused for every retry of that sale. */
  get(): string;
  /** The current id without creating one; null once the sale is finished or the cart was reset. */
  peek(): string | null;
  /** Forget the id: call after a successful sale or an explicit cart reset. */
  reset(): void;
}

export function createSaleIdHolder(generate: () => string = newClientTxId): SaleIdHolder {
  let id: string | null = null;
  return {
    get() {
      if (id === null) id = generate();
      return id;
    },
    peek: () => id,
    reset() {
      id = null;
    },
  };
}

// ── Print once ───────────────────────────────────────────────────────────────

const printedSales = new Set<string>();

/** True the first time a sale id asks to print, false afterwards (replay, double tap). */
export function claimReceiptPrint(clientTxId: string): boolean {
  if (printedSales.has(clientTxId)) return false;
  printedSales.add(clientTxId);
  return true;
}

/**
 * Finish a sale: print at most once for this sale id (a replayed success or a double tap must not
 * print a second receipt), then forget the id so the next cart starts a new sale.
 */
export function completeSale(holder: SaleIdHolder, print?: () => void): void {
  const id = holder.peek();
  if (print && id !== null && claimReceiptPrint(id)) print();
  holder.reset();
}

// ── Identity fields sent with the sale ───────────────────────────────────────

export interface SaleIdentityFields {
  clientTxId: string;
  deviceId?: string;
  /** The LOCAL- number printed on the provisional receipt of a queued offline sale. */
  localReceiptRef?: string;
}

const DEVICE_ID_MAX = 128; // the server rejects longer ids, which would block the sale

export async function buildSaleIdentity(
  clientTxId: string,
  opts: { localReceiptRef?: string; getDeviceId?: () => Promise<string> } = {},
): Promise<SaleIdentityFields> {
  const read = opts.getDeviceId ?? getMachineId;
  let deviceId: string | undefined;
  try {
    const id = await read();
    if (id.length >= 1 && id.length <= DEVICE_ID_MAX) deviceId = id;
  } catch {
    deviceId = undefined;
  }
  return {
    clientTxId,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(opts.localReceiptRef ? { localReceiptRef: opts.localReceiptRef } : {}),
  };
}

// ── Responses ────────────────────────────────────────────────────────────────

export type SaleStatusKind = 'ok' | 'conflict' | 'invalid' | 'failed';

/** 2xx (a replay is also 200) is success; 409 and 400 are final answers that a retry cannot change. */
export function classifySaleStatus(status: number): SaleStatusKind {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 409) return 'conflict';
  if (status === 400) return 'invalid';
  return 'failed';
}

export interface SaleResponse {
  error?: string;
  transactionId?: string;
  receiptNumber?: string;
  serverTimestamp?: string;
  soldAt?: string;
  totalPiastres?: number;
  paymentMethod?: 'cash' | 'card' | 'lana';
  replayed?: boolean;
}

export type SaleOutcome =
  | { kind: 'ok'; replayed: boolean; data: SaleResponse }
  | { kind: 'conflict' }
  | { kind: 'invalid' }
  | { kind: 'failed'; status: number; error?: string };

export type Send = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * POST a sale with its identity. One request, no automatic retry: a 409 or 400 is returned for the
 * cashier to see, and a network failure rejects so the caller can show it and let the cashier retry
 * with the same clientTxId.
 */
export async function postSale(
  body: Record<string, unknown>,
  identity: SaleIdentityFields,
  send: Send = apiFetch,
): Promise<SaleOutcome> {
  const res = await send('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, ...identity }),
  });
  const data = (await res.json().catch(() => ({}))) as SaleResponse;
  switch (classifySaleStatus(res.status)) {
    case 'ok':
      return { kind: 'ok', replayed: data.replayed === true, data };
    case 'conflict':
      return { kind: 'conflict' };
    case 'invalid':
      return { kind: 'invalid' };
    default:
      return { kind: 'failed', status: res.status, ...(data.error !== undefined ? { error: data.error } : {}) };
  }
}
