import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../i18n';
import {
  PAGE_SIZE,
  applyAcknowledged,
  buildVarianceQuery,
  canViewVariances,
  formatQuantity,
  formatVarianceTime,
  missingQuantity,
  pageInfo,
  quantityWithUnit,
  reasonKey,
  reasonLabel,
  unitLabel,
  type StockVariance,
} from '../variances';

const variance = (id: string, over: Partial<StockVariance> = {}): StockVariance => ({
  variance_id: id, product_id: 'p-1', product_name_ar: 'تفاح', product_name_fr: 'Pomme', uom: 'kg', is_weighted: true,
  expected_qty: 5000, actual_qty: 4995.9, variance_qty: -4.1, missing_qty: 4.1, reason: 'oversell_online',
  register_id: 'r-1', register_name: 'Caisse 1', transaction_id: 't-1', detected_at: '2026-11-04T10:00:00Z',
  acknowledged_by: null, acknowledged_by_name_ar: null, acknowledged_by_name_fr: null, acknowledged_at: null, ...over,
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
