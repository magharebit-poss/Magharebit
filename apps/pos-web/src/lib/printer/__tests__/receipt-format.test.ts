import { describe, expect, it, vi } from 'vitest';
import {
  buildPrintInfo,
  DEFAULT_TIME_ZONE,
  formatReceiptDateTime,
  isProvisionalReceiptNumber,
  provisionalReceiptNumber,
} from '../receipt-format';

const SHAPE = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

describe('formatReceiptDateTime', () => {
  it('prints DD/MM/YYYY HH:mm:ss with seconds, in Africa/Casablanca by default', () => {
    // October: Morocco is on UTC+1.
    expect(formatReceiptDateTime('2026-10-25T17:20:05Z')).toBe('25/10/2026 18:20:05');
    expect(DEFAULT_TIME_ZONE).toBe('Africa/Casablanca');
  });
  it('keeps leading zeros on every field', () => {
    expect(formatReceiptDateTime('2026-01-02T02:03:04Z')).toBe('02/01/2026 03:03:04');
  });
  it('follows the Ramadan clock change (UTC+0) from the time zone database', () => {
    expect(formatReceiptDateTime('2026-03-01T12:00:00Z')).toBe('01/03/2026 12:00:00');
  });
  it('Africa/Casablanca, named explicitly: UTC+1 before Ramadan, UTC+0 during it, UTC+1 again after', () => {
    const tz = 'Africa/Casablanca';
    // Same UTC wall time (12:00:00Z) on three dates around Ramadan 2026.
    expect(formatReceiptDateTime('2026-02-01T12:00:00Z', tz)).toBe('01/02/2026 13:00:00'); // before
    expect(formatReceiptDateTime('2026-03-01T12:00:00Z', tz)).toBe('01/03/2026 12:00:00'); // during
    expect(formatReceiptDateTime('2026-04-15T12:00:00Z', tz)).toBe('15/04/2026 13:00:00'); // after
  });
  it('the default time zone gives the same answer as naming Africa/Casablanca', () => {
    for (const iso of ['2026-02-01T12:00:00Z', '2026-03-01T12:00:00Z', '2026-04-15T12:00:00Z', '2026-10-25T23:00:00Z']) {
      expect(formatReceiptDateTime(iso)).toBe(formatReceiptDateTime(iso, 'Africa/Casablanca'));
    }
  });
  it('midnight edge: the hour after 23:59:59 local is 00:00:00 on the next date, never 24:00:00', () => {
    expect(formatReceiptDateTime('2026-10-25T22:59:59Z')).toBe('25/10/2026 23:59:59');
    expect(formatReceiptDateTime('2026-10-25T23:00:00Z')).toBe('26/10/2026 00:00:00');
    expect(formatReceiptDateTime('2026-10-25T23:00:01Z')).toBe('26/10/2026 00:00:01');
  });
  it('year edge across midnight', () => {
    expect(formatReceiptDateTime('2026-12-31T23:30:00Z')).toBe('01/01/2027 00:30:00');
  });
  it('honours another time zone', () => {
    expect(formatReceiptDateTime('2026-10-25T17:20:05Z', 'UTC')).toBe('25/10/2026 17:20:05');
    // Tokyo has no daylight saving: UTC+9, and the date rolls over.
    expect(formatReceiptDateTime('2026-10-25T17:20:05Z', 'Asia/Tokyo')).toBe('26/10/2026 02:20:05');
    // Paris left summer time at 01:00 UTC that day, so it is UTC+1 here.
    expect(formatReceiptDateTime('2026-10-25T17:20:05Z', 'Europe/Paris')).toBe('25/10/2026 18:20:05');
  });
  it('always Western digits in a fixed shape', () => {
    for (const iso of ['2026-10-25T17:20:05Z', '2026-03-01T00:00:00Z', '2027-02-28T23:59:59Z']) {
      expect(formatReceiptDateTime(iso)).toMatch(SHAPE);
    }
  });
  it('an unknown time zone falls back to Africa/Casablanca instead of printing nothing, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(formatReceiptDateTime('2026-10-25T17:20:05Z', 'Not/AZone')).toBe('25/10/2026 18:20:05');
    expect(formatReceiptDateTime('2026-10-26T10:00:00Z', 'Not/AZone')).toBe('26/10/2026 11:00:00');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Not/AZone');
    expect(String(warn.mock.calls[0]?.[0])).toContain('Africa/Casablanca');
    warn.mockRestore();
  });
  it('an invalid date returns an empty string', () => {
    expect(formatReceiptDateTime('not a date')).toBe('');
    expect(formatReceiptDateTime('')).toBe('');
  });
});

describe('provisional receipt number rule', () => {
  const NOW = '2026-10-25T17:20:05.000Z';
  const LOCAL_ID = 'abcd1234-0000-4000-8000-000000000000';

  it('a server number makes the receipt official and uses the server sold_at', () => {
    const p = buildPrintInfo({ serverReceiptNumber: 'R-000042', serverSoldAt: '2026-10-25T17:19:00.000Z', localId: LOCAL_ID, nowIso: NOW });
    expect(p).toEqual({ receiptNumber: 'R-000042', soldAt: '2026-10-25T17:19:00.000Z', provisional: false });
  });
  it('an official receipt without a server time falls back to the local time, still official', () => {
    const p = buildPrintInfo({ serverReceiptNumber: 'R-000042', localId: LOCAL_ID, nowIso: NOW });
    expect(p.provisional).toBe(false);
    expect(p.soldAt).toBe(NOW);
  });
  it('no server number -> provisional: LOCAL- number and the local time', () => {
    const p = buildPrintInfo({ localId: LOCAL_ID, nowIso: NOW });
    expect(p.provisional).toBe(true);
    expect(p.receiptNumber).toBe('LOCAL-ABCD1234');
    expect(p.soldAt).toBe(NOW);
  });
  it.each([[null], [undefined], ['']])('server number %j -> provisional', (n) => {
    expect(buildPrintInfo({ serverReceiptNumber: n, localId: LOCAL_ID, nowIso: NOW }).provisional).toBe(true);
  });
  it('a LOCAL- number is never accepted as an official number, even if it arrives from the server field', () => {
    const p = buildPrintInfo({ serverReceiptNumber: 'LOCAL-DEADBEEF', serverSoldAt: '2020-01-01T00:00:00Z', localId: LOCAL_ID, nowIso: NOW });
    expect(p.provisional).toBe(true);
    expect(p.receiptNumber).toBe('LOCAL-ABCD1234');
    expect(p.soldAt).toBe(NOW);
  });
  it('a provisional receipt ignores any server time (there is no server record)', () => {
    expect(buildPrintInfo({ serverSoldAt: '2020-01-01T00:00:00Z', localId: LOCAL_ID, nowIso: NOW }).soldAt).toBe(NOW);
  });
  it('cash and change pass through as integer piastres, only when given', () => {
    const withCash = buildPrintInfo({ serverReceiptNumber: 'R-000001', localId: LOCAL_ID, nowIso: NOW, paidPiastres: 10000, changePiastres: 250 });
    expect(withCash.paidPiastres).toBe(10000);
    expect(withCash.changePiastres).toBe(250);
    const without = buildPrintInfo({ serverReceiptNumber: 'R-000001', localId: LOCAL_ID, nowIso: NOW });
    expect('paidPiastres' in without).toBe(false);
    expect('changePiastres' in without).toBe(false);
  });
  it('helpers agree', () => {
    expect(isProvisionalReceiptNumber(provisionalReceiptNumber(LOCAL_ID))).toBe(true);
    expect(isProvisionalReceiptNumber('R-000042')).toBe(false);
  });
});
