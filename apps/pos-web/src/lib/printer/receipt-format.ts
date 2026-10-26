// Pure helpers for the printed receipt: sale date/time and the receipt-number rule.
// No hardware, no DOM: safe to unit test.

export const DEFAULT_TIME_ZONE = 'Africa/Casablanca';

/** What the thermal receipt needs from the sale that was just recorded. */
export interface ReceiptPrintInfo {
  /** Server receipt number, or a LOCAL-xxxxxxxx provisional number (never both meanings). */
  receiptNumber: string;
  /** Sale time, ISO: the server's stored sold_at, or the local time for a provisional receipt. */
  soldAt: string;
  /** True when the server has not issued a number yet (queued offline sale). */
  provisional: boolean;
  /** Cash handed over and change due, integer piastres. Only set when the cashier entered an amount. */
  paidPiastres?: number;
  changePiastres?: number;
}

const PROVISIONAL_PREFIX = 'LOCAL-';

const warnedTimeZones = new Set<string>();

/** Provisional number for a sale that is queued locally. Same shape the on-screen receipt already uses. */
export function provisionalReceiptNumber(localId: string): string {
  return `${PROVISIONAL_PREFIX}${localId.slice(0, 8).toUpperCase()}`;
}

export function isProvisionalReceiptNumber(receiptNumber: string): boolean {
  return receiptNumber.startsWith(PROVISIONAL_PREFIX);
}

/**
 * The receipt-number rule. A receipt is official only when the server issued a number.
 * Otherwise it is provisional: a local temporary number and the local time, clearly marked,
 * and it never carries a number that could be mistaken for the official one.
 */
export function buildPrintInfo(input: {
  serverReceiptNumber?: string | null;
  /** The server's stored sold_at (preferred) or, failing that, its timestamp. */
  serverSoldAt?: string | null;
  /** Used for the provisional number when the server gave none. */
  localId: string;
  /** Local clock, ISO. Used only when the server gave no time. */
  nowIso: string;
  paidPiastres?: number;
  changePiastres?: number;
}): ReceiptPrintInfo {
  const official = typeof input.serverReceiptNumber === 'string'
    && input.serverReceiptNumber.length > 0
    && !isProvisionalReceiptNumber(input.serverReceiptNumber);
  const base: ReceiptPrintInfo = official
    ? { receiptNumber: input.serverReceiptNumber as string, soldAt: input.serverSoldAt || input.nowIso, provisional: false }
    : { receiptNumber: provisionalReceiptNumber(input.localId), soldAt: input.nowIso, provisional: true };
  if (input.paidPiastres !== undefined) base.paidPiastres = input.paidPiastres;
  if (input.changePiastres !== undefined) base.changePiastres = input.changePiastres;
  return base;
}

/**
 * "DD/MM/YYYY HH:mm:ss" in the given time zone, always Western digits and a 24 h clock
 * (so midnight prints 00:00:00, never 24:00:00). Returns '' for an invalid date.
 */
export function formatReceiptDateTime(iso: string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    } as Intl.DateTimeFormatOptions).formatToParts(d);
  } catch {
    // Unknown time zone name: fall back to the default rather than printing nothing.
    if (timeZone === DEFAULT_TIME_ZONE) return '';
    if (!warnedTimeZones.has(timeZone)) {
      warnedTimeZones.add(timeZone); // once per name, so a misconfigured tenant does not flood the log
      console.warn(`[receipt] unknown time zone "${timeZone}", using ${DEFAULT_TIME_ZONE}`);
    }
    return formatReceiptDateTime(iso, DEFAULT_TIME_ZONE);
  }
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}:${get('second')}`;
}
