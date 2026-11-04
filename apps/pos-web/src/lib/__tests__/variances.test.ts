import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../i18n';
import { listRejectedTransactions, type RejectedTransaction } from '../offline-queue';
import {
  PAGE_SIZE,
  REJECTED_CSV_COLUMNS,
  applyAcknowledged,
  buildVarianceQuery,
  canViewVariances,
  csvCell,
  formatQuantity,
  formatVarianceTime,
  missingQuantity,
  pageInfo,
  quantityWithUnit,
  reasonKey,
  reasonLabel,
  rejectedExportFileName,
  rejectedReasonKey,
  rejectedToCsv,
  summarizeRejected,
  unitLabel,
  type StockVariance,
} from '../variances';

const variance = (id: string, over: Partial<StockVariance> = {}): StockVariance => ({
  variance_id: id, product_id: 'p-1', product_name_ar: 'تفاح', product_name_fr: 'Pomme', uom: 'kg', is_weighted: true,
  expected_qty: 5000, actual_qty: 4995.9, variance_qty: -4.1, missing_qty: 4.1, reason: 'oversell_online',
  register_id: 'r-1', register_name: 'Caisse 1', transaction_id: 't-1', detected_at: '2026-11-04T10:00:00Z',
  acknowledged_by: null, acknowledged_by_name_ar: null, acknowledged_by_name_fr: null, acknowledged_at: null, ...over,
});

const rejected = (over: Partial<RejectedTransaction> = {}): RejectedTransaction => ({
  local_id: 'q-1', tenant_id: 't-1', shift_id: 's-1', created_at: 1_793_790_000, retry_count: 0, reject_reason: 'client_tx_id_conflict',
  payload_json: JSON.stringify({
    clientTxId: '5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f', localReceiptRef: 'LOCAL-ABCD1234',
    paymentMethod: 'cash', grandTotalPiastres: 4250, lines: [{ productId: 'a' }, { productId: 'b' }],
  }),
  ...over,
});

describe('who may open the page', () => {
  it('manager, supervisor and owner only', () => {
    for (const r of ['MANAGER', 'SUPERVISOR', 'OWNER']) expect(canViewVariances(r), r).toBe(true);
    for (const r of ['CASHIER', 'INVENTORY', 'manager', '', null, undefined]) expect(canViewVariances(r), String(r)).toBe(false);
  });
});

describe('buildVarianceQuery', () => {
  it('"to review" asks for unacknowledged rows, "acknowledged" for acknowledged, "all" for no filter', () => {
    expect(buildVarianceQuery({ status: 'open' })).toBe('?acknowledged=false&limit=50&offset=0');
    expect(buildVarianceQuery({ status: 'acknowledged' })).toBe('?acknowledged=true&limit=50&offset=0');
    expect(buildVarianceQuery({ status: 'all' })).toBe('?limit=50&offset=0');
  });
  it('carries the page window', () => {
    expect(buildVarianceQuery({ status: 'open', limit: 20, offset: 40 })).toBe('?acknowledged=false&limit=20&offset=40');
    expect(PAGE_SIZE).toBe(50);
  });
});

describe('pageInfo', () => {
  it('first, middle and last page', () => {
    expect(pageInfo(120, 0, 50)).toEqual({ from: 1, to: 50, total: 120, hasPrev: false, hasNext: true });
    expect(pageInfo(120, 50, 50)).toEqual({ from: 51, to: 100, total: 120, hasPrev: true, hasNext: true });
    expect(pageInfo(120, 100, 20)).toEqual({ from: 101, to: 120, total: 120, hasPrev: true, hasNext: false });
  });
  it('an empty list shows 0-0', () => {
    expect(pageInfo(0, 0, 0)).toEqual({ from: 0, to: 0, total: 0, hasPrev: false, hasNext: false });
  });
});

describe('reasons', () => {
  it('the three codes the server writes, and anything else as "unknown" (never the raw code)', () => {
    expect(reasonKey('oversell_offline')).toBe('oversell_offline');
    expect(reasonKey('late_sync')).toBe('late_sync');
    expect(reasonKey('oversell_online')).toBe('oversell_online');
    for (const other of ['count_mismatch', '', 'DROP TABLE', 'oversell_online ']) expect(reasonKey(other), other).toBe('unknown');
  });

  it('every reason is translated in ar, fr and en, and an unknown code shows the "other" label', () => {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      const labels = TRANSLATIONS[lang].variances.reasons;
      for (const k of ['oversell_offline', 'late_sync', 'oversell_online', 'unknown'] as const) {
        expect(labels[k], `${lang}.${k}`).toBeTruthy();
      }
      expect(reasonLabel('late_sync', labels)).toBe(labels.late_sync);
      expect(reasonLabel('something_new', labels)).toBe(labels.unknown);
      expect(reasonLabel('something_new', labels)).not.toContain('something_new');
    }
  });
});

describe('the variances translations are complete', () => {
  const shape = (o: unknown, prefix = ''): string[] =>
    typeof o === 'object' && o !== null
      ? Object.entries(o).flatMap(([k, v]) => shape(v, `${prefix}${k}.`))
      : [prefix.slice(0, -1)];

  it('ar and fr have exactly the keys en has, none empty, plus the nav label', () => {
    const en = shape(TRANSLATIONS.en.variances).sort();
    for (const lang of ['ar', 'fr'] as const) {
      expect(shape(TRANSLATIONS[lang].variances).sort(), lang).toEqual(en);
    }
    for (const lang of ['ar', 'fr', 'en'] as const) {
      const flat = (o: unknown): string[] =>
        typeof o === 'object' && o !== null ? Object.values(o).flatMap(flat) : [String(o)];
      expect(flat(TRANSLATIONS[lang].variances).every((s) => s.trim().length > 0), lang).toBe(true);
      expect(TRANSLATIONS[lang].nav.variances.trim().length, lang).toBeGreaterThan(0);
    }
  });

  it('the range text keeps its placeholders in every language', () => {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      for (const p of ['{from}', '{to}', '{total}']) expect(TRANSLATIONS[lang].variances.range, lang).toContain(p);
    }
  });
});

describe('quantities', () => {
  it('Western digits, at most 3 decimals, no grouping, no float noise', () => {
    expect(formatQuantity(4995.9)).toBe('4995.9');
    expect(formatQuantity(4.1)).toBe('4.1');
    expect(formatQuantity(5000)).toBe('5000');
    expect(formatQuantity(1234.5)).toBe('1234.5');
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3');
    expect(formatQuantity(2.0004)).toBe('2');
    expect(formatQuantity(Number.NaN)).toBe('');
    expect(/^[0-9.]+$/.test(formatQuantity(1234567.891))).toBe(true);
  });

  it('missing = needed minus on hand, rounded to the column precision', () => {
    expect(missingQuantity(5000, 4995.9)).toBe(4.1);
    expect(missingQuantity(3, 1)).toBe(2);
    expect(missingQuantity(0.3, 0.1)).toBe(0.2);
    expect(missingQuantity(2, 5)).toBe(-3); // a surplus keeps its sign
  });

  it('the unit is found whatever the case of the stored value, and omitted when unknown', () => {
    const labels = { UNIT: 'Unit', KG: 'Kg' };
    expect(unitLabel('kg', labels)).toBe('Kg');
    expect(unitLabel('KG', labels)).toBe('Kg');
    expect(unitLabel('crate', labels)).toBe('');
    expect(unitLabel(null, labels)).toBe('');
    expect(quantityWithUnit(4.1, 'kg', labels)).toBe('4.1 Kg');
    expect(quantityWithUnit(3, 'crate', labels)).toBe('3');
  });
});

describe('time in the tenant time zone', () => {
  it('DD/MM/YYYY HH:mm:ss with Western digits, in the given zone', () => {
    expect(formatVarianceTime('2026-11-04T15:30:00Z', 'Asia/Tokyo')).toBe('05/11/2026 00:30:00');
    expect(formatVarianceTime('2026-11-04T15:30:00Z', 'UTC')).toBe('04/11/2026 15:30:00');
  });
  it('an unusable timestamp shows nothing instead of throwing', () => {
    expect(formatVarianceTime('not a date', 'UTC')).toBe('');
  });
});

describe('after acknowledging', () => {
  const rows = [variance('a'), variance('b'), variance('c', { acknowledged_at: '2026-11-04T11:00:00Z', acknowledged_by: 'm-1' })];
  const ack = { acknowledged_by: 'm-2', acknowledged_at: '2026-11-04T12:00:00Z' };

  it('in the "to review" view the row leaves and the total drops by one', () => {
    const r = applyAcknowledged(rows, 3, 'a', ack, 'open');
    expect(r.items.map((v) => v.variance_id)).toEqual(['b', 'c']);
    expect(r.total).toBe(2);
  });

  it('in the other views the row is marked in place and the total is unchanged', () => {
    for (const view of ['acknowledged', 'all'] as const) {
      const r = applyAcknowledged(rows, 3, 'b', ack, view);
      expect(r.items.map((v) => v.variance_id)).toEqual(['a', 'b', 'c']);
      expect(r.items[1]).toMatchObject({ variance_id: 'b', acknowledged_by: 'm-2', acknowledged_at: '2026-11-04T12:00:00Z' });
      expect(r.items[0]!.acknowledged_at).toBeNull();
      expect(r.total).toBe(3);
    }
  });

  it('an id that is not on this page changes nothing', () => {
    const r = applyAcknowledged(rows, 3, 'zzz', ack, 'open');
    expect(r.items).toHaveLength(3);
    expect(r.total).toBe(3);
  });

  it('does not mutate its input', () => {
    const copy = JSON.stringify(rows);
    applyAcknowledged(rows, 3, 'a', ack, 'all');
    applyAcknowledged(rows, 3, 'a', ack, 'open');
    expect(JSON.stringify(rows)).toBe(copy);
  });
});

describe('rejected sales (Tauri only)', () => {
  it('outside Tauri the list is empty: the browser has nothing to show', async () => {
    expect(await listRejectedTransactions('t-1')).toEqual([]);
  });

  it('summarises a queued sale from its payload, without any token', () => {
    const s = summarizeRejected(rejected());
    expect(s).toMatchObject({
      localId: 'q-1', shiftId: 's-1', reason: 'client_tx_id_conflict', retryCount: 0,
      totalPiastres: 4250, paymentMethod: 'cash', lineCount: 2,
      clientTxId: '5b0f6d8e-2f4b-4c1a-9d3e-7a1b2c3d4e5f', localReceiptRef: 'LOCAL-ABCD1234',
    });
    expect(s.createdAt).toBe(new Date(1_793_790_000 * 1000).toISOString());
    expect(Object.keys(s).join(',').toLowerCase()).not.toContain('token');
  });

  it('a corrupt, empty or odd payload never throws and leaves the fields empty', () => {
    for (const payload of ['not json', '', '[]', 'null', '"text"', '{"grandTotalPiastres":"12","lines":"x"}']) {
      const s = summarizeRejected(rejected({ payload_json: payload }));
      expect(s.totalPiastres, payload).toBeNull();
      expect(s.lineCount, payload).toBeNull();
      expect(s.localId).toBe('q-1');
    }
  });

  it('a missing reason or time is shown empty, not invented', () => {
    const s = summarizeRejected(rejected({ reject_reason: null, created_at: Number.NaN }));
    expect(s.reason).toBe('');
    expect(s.createdAt).toBe('');
  });

  it('reason codes map to labels; anything else is "other"', () => {
    expect(rejectedReasonKey('client_tx_id_conflict')).toBe('client_tx_id_conflict');
    expect(rejectedReasonKey('invalid_sale')).toBe('invalid_sale');
    for (const o of ['', null, undefined, 'x']) expect(rejectedReasonKey(o as string | null | undefined)).toBe('other');
    for (const lang of ['ar', 'fr', 'en'] as const) {
      for (const k of ['client_tx_id_conflict', 'invalid_sale', 'other'] as const) {
        expect(TRANSLATIONS[lang].variances.rejectedReasons[k], `${lang}.${k}`).toBeTruthy();
      }
    }
  });
});

describe('CSV export', () => {
  it('plain values stay plain; commas, quotes and line breaks are quoted and escaped', () => {
    expect(csvCell('abc')).toBe('abc');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('a value a spreadsheet would run as a formula is kept as text', () => {
    for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1', '=HYPERLINK("http://x","y")']) {
      expect(csvCell(evil).replace(/^"/, '').startsWith("'"), evil).toBe(true);
    }
  });

  it('header, one row per sale, CRLF line ends, total in MAD with 2 decimals', () => {
    const csv = rejectedToCsv([summarizeRejected(rejected()), summarizeRejected(rejected({ local_id: 'q-2', payload_json: 'bad' }))]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(REJECTED_CSV_COLUMNS.join(','));
    expect(lines).toHaveLength(4); // header, 2 rows, trailing empty after the final CRLF
    expect(lines[3]).toBe('');
    expect(lines[1]).toContain('LOCAL-ABCD1234');
    expect(lines[1]).toContain(',42.50,cash,2,client_tx_id_conflict,0');
    expect(lines[2]).toContain('q-2'); // an unreadable payload still exports, with blank amounts
    expect(lines[2]).toContain(',,,,');
  });

  it('the export has no token or payload column', () => {
    const header = REJECTED_CSV_COLUMNS.join(',').toLowerCase();
    expect(header).not.toContain('token');
    expect(header).not.toContain('payload');
  });

  it('a hostile reason cannot become a formula', () => {
    const csv = rejectedToCsv([summarizeRejected(rejected({ reject_reason: '=cmd|\' /C calc\'!A0' }))]);
    expect(csv).toContain("'=cmd");
  });

  it('file name from the UTC date and time', () => {
    expect(rejectedExportFileName(new Date('2026-11-04T09:05:00Z'))).toBe('rejected-sales-20261104-0905.csv');
  });
});
