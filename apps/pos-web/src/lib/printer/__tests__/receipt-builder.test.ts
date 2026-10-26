import { describe, expect, it } from 'vitest';
import type { CartLine } from '../../cart';
import { encodeCP1256 } from '../escpos';
import {
  buildReceipt,
  PROVISIONAL_AR,
  PROVISIONAL_FR,
  PROVISIONAL_NUMBER_LABEL_AR,
  type ReceiptData,
} from '../receipt-builder';
import { formatReceiptDateTime, provisionalReceiptNumber } from '../receipt-format';

// Decode what the printer would receive, using the real Windows-1256 codec.
const cp1256 = new TextDecoder('windows-1256');
const decode = (bytes: Uint8Array): string => cp1256.decode(bytes);

const line = {
  product: { product_id: 'p1', name_ar: 'برتقال', name_fr: 'Orange', is_weighted: false },
  quantity: 2,
  unitPricePiastres: 1000,
  lineTotalPiastres: 2000,
} as unknown as CartLine;

const base: ReceiptData = {
  receiptNumber: 'R-000042',
  shiftId: 'shift-1',
  cashierName: 'أحمد',
  cartLines: [line],
  totalPiastres: 2000,
  taxPiastres: 333,
  paymentMethod: 'cash',
  soldAt: '2026-10-25T17:20:05.000Z',
};

describe('CP1256 round trip of every new receipt string', () => {
  const NEW_STRINGS = [
    PROVISIONAL_AR,
    PROVISIONAL_FR,
    PROVISIONAL_NUMBER_LABEL_AR,
    'رقم الإيصال',
    'التاريخ',
    'المبلغ المقدم',
    'الباقي',
    provisionalReceiptNumber('abcd1234-0000-4000-8000-000000000000'),
    formatReceiptDateTime('2026-10-25T17:20:05Z'),
    formatReceiptDateTime('2026-10-25T23:00:00Z'),
    '100.00 MAD',
    '2.50 MAD',
  ];
  it.each(NEW_STRINGS.map((s) => [s]))('%s survives encode -> decode unchanged, with no "?" substitution', (s) => {
    const bytes = encodeCP1256(s);
    expect(decode(bytes)).toBe(s);
    if (!s.includes('?')) expect(Array.from(bytes)).not.toContain(0x3f);
  });
  it('the French provisional line is plain ASCII', () => {
    expect(/^[\x20-\x7e]+$/.test(PROVISIONAL_FR)).toBe(true);
  });
});

describe('buildReceipt: date, number and provisional marking', () => {
  it('official: server number, date with seconds in Casablanca, no provisional banner', () => {
    const text = decode(buildReceipt(base));
    expect(text).toContain('رقم الإيصال: R-000042');
    expect(text).toContain('التاريخ: 25/10/2026 18:20:05');
    expect(text).not.toContain(PROVISIONAL_AR);
    expect(text).not.toContain(PROVISIONAL_FR);
    expect(text).not.toContain(PROVISIONAL_NUMBER_LABEL_AR);
  });
  it('provisional: banner in both languages, "temporary number" label, never the official label', () => {
    const text = decode(buildReceipt({
      ...base,
      receiptNumber: 'LOCAL-ABCD1234',
      provisional: true,
      soldAt: '2026-10-25T23:00:00.000Z',
    }));
    expect(text).toContain(PROVISIONAL_AR);
    expect(text).toContain(PROVISIONAL_FR);
    expect(text).toContain(`${PROVISIONAL_NUMBER_LABEL_AR}: LOCAL-ABCD1234`);
    expect(text).not.toContain('رقم الإيصال');
    expect(text).toContain('التاريخ: 26/10/2026 00:00:00');
  });
  it('honours the tenant time zone', () => {
    expect(decode(buildReceipt({ ...base, timeZone: 'UTC' }))).toContain('التاريخ: 25/10/2026 17:20:05');
  });
});

describe('buildReceipt: cash given and change due', () => {
  it('prints both for a cash sale when the amount was entered (integer piastres)', () => {
    const text = decode(buildReceipt({ ...base, paidPiastres: 10000, changePiastres: 250 }));
    expect(text).toContain('المبلغ المقدم');
    expect(text).toContain('100.00 MAD');
    expect(text).toContain('الباقي');
    expect(text).toContain('2.50 MAD');
  });
  it('exact payment prints change 0.00 MAD', () => {
    const text = decode(buildReceipt({ ...base, paidPiastres: 2000, changePiastres: 0 }));
    expect(text).toContain('0.00 MAD');
  });
  it('prints neither line when no amount was entered', () => {
    const text = decode(buildReceipt(base));
    expect(text).not.toContain('المبلغ المقدم');
    expect(text).not.toContain('الباقي');
  });
  it('never prints cash lines for a card sale', () => {
    const text = decode(buildReceipt({ ...base, paymentMethod: 'card', paidPiastres: 10000, changePiastres: 250 }));
    expect(text).not.toContain('المبلغ المقدم');
  });
});
