import { describe, expect, test } from 'vitest';
import {
  chooseVarianceReason,
  LATE_SYNC_SECONDS,
  parseSaleIdentity,
  saleSignature,
} from '../record-sale';

const SOLD = new Date('2026-11-03T10:00:00Z');
const at = (s: number): Date => new Date(SOLD.getTime() + s * 1000);

describe('chooseVarianceReason (fixed vocabulary)', () => {
  test('a sale carrying a provisional LOCAL- reference is oversell_offline', () => {
    expect(chooseVarianceReason({ localReceiptRef: 'LOCAL-ABCD1234', soldAt: SOLD, receivedAt: at(5) })).toBe('oversell_offline');
  });
  test('offline marker wins even when the sale is also late', () => {
    expect(chooseVarianceReason({ localReceiptRef: 'LOCAL-ABCD1234', soldAt: SOLD, receivedAt: at(7200) })).toBe('oversell_offline');
  });
  test('no marker, arrives later than the threshold -> late_sync', () => {
    expect(chooseVarianceReason({ soldAt: SOLD, receivedAt: at(LATE_SYNC_SECONDS + 1) })).toBe('late_sync');
  });
  test('exactly at the threshold is still on time -> oversell_online', () => {
    expect(chooseVarianceReason({ soldAt: SOLD, receivedAt: at(LATE_SYNC_SECONDS) })).toBe('oversell_online');
  });
  test('on-time online sale that found less stock -> oversell_online', () => {
    expect(chooseVarianceReason({ soldAt: SOLD, receivedAt: at(2) })).toBe('oversell_online');
    expect(chooseVarianceReason({ localReceiptRef: null, soldAt: SOLD, receivedAt: at(0) })).toBe('oversell_online');
  });
  test('a sale dated in the future never counts as late', () => {
    expect(chooseVarianceReason({ soldAt: at(60), receivedAt: SOLD })).toBe('oversell_online');
  });
});

describe('parseSaleIdentity', () => {
  const GOOD = '5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f';
  test('all optional: an empty body is valid and gives nulls (backward compatible)', () => {
    expect(parseSaleIdentity({})).toEqual({ ok: true, value: { clientTxId: null, deviceId: null, localReceiptRef: null } });
  });
  test('accepts a UUID, a device id and a LOCAL- reference; lower-cases the UUID', () => {
    const r = parseSaleIdentity({ clientTxId: GOOD.toUpperCase(), deviceId: 'POS-DEMO-01', localReceiptRef: 'LOCAL-ABCD1234' });
    expect(r).toEqual({ ok: true, value: { clientTxId: GOOD, deviceId: 'POS-DEMO-01', localReceiptRef: 'LOCAL-ABCD1234' } });
  });
  test.each([['not-a-uuid'], [''], [42], [{}], ['5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5']])('rejects clientTxId %j', (v) => {
    expect(parseSaleIdentity({ clientTxId: v }).ok).toBe(false);
  });
  test.each([[''], ['x'.repeat(129)], [7]])('rejects deviceId %j', (v) => {
    expect(parseSaleIdentity({ deviceId: v }).ok).toBe(false);
  });
  test.each([['R-000042'], ['LOCAL-'], ['local-abc'], ['LOCAL-' + 'A'.repeat(33)], [1]])('rejects localReceiptRef %j', (v) => {
    expect(parseSaleIdentity({ localReceiptRef: v }).ok).toBe(false);
  });
  test('explicit nulls are accepted as absent', () => {
    expect(parseSaleIdentity({ clientTxId: null, deviceId: null, localReceiptRef: null }).ok).toBe(true);
  });
});

describe('saleSignature (same clientTxId + different body => 409)', () => {
  const base = {
    shiftId: 's1', totalPiastres: 2000, paymentMethod: 'cash',
    lines: [{ productId: 'pA', quantity: 2, lineTotalCents: 1500 }, { productId: 'pB', quantity: 1, lineTotalCents: 500 }],
  };
  test('line order does not matter', () => {
    expect(saleSignature({ ...base, lines: [...base.lines].reverse() })).toBe(saleSignature(base));
  });
  test.each([
    ['shift', { shiftId: 's2' }],
    ['total', { totalPiastres: 2001 }],
    ['payment method', { paymentMethod: 'card' }],
    ['a quantity', { lines: [{ productId: 'pA', quantity: 3, lineTotalCents: 1500 }, base.lines[1]!] }],
    ['a line total', { lines: [{ productId: 'pA', quantity: 2, lineTotalCents: 1499 }, base.lines[1]!] }],
    ['a product', { lines: [{ productId: 'pZ', quantity: 2, lineTotalCents: 1500 }, base.lines[1]!] }],
    ['an extra line', { lines: [...base.lines, { productId: 'pC', quantity: 1, lineTotalCents: 1 }] }],
  ])('a different %s changes the signature', (_n, over) => {
    expect(saleSignature({ ...base, ...over })).not.toBe(saleSignature(base));
  });
  test('quantity 2 and 2.0 are the same, fractional weights are kept', () => {
    expect(saleSignature({ ...base, lines: [{ productId: 'pA', quantity: 2.0, lineTotalCents: 1500 }, base.lines[1]!] })).toBe(saleSignature(base));
    expect(saleSignature({ ...base, lines: [{ productId: 'pA', quantity: 2.25, lineTotalCents: 1500 }, base.lines[1]!] })).not.toBe(saleSignature(base));
  });
});
