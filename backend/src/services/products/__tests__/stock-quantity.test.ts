import { describe, expect, test } from 'vitest';
import { MAX_STOCK_QUANTITY, parseStockQuantity, withNumericStock } from '../stock-quantity';

describe('parseStockQuantity (fractional parsing, no parseInt truncation)', () => {
  test.each([
    [1.5, 1.5],
    ['1.5', 1.5],          // a multipart form field arrives as a string; parseInt would have given 1
    ['4995.9', 4995.9],
    [' 2.500 ', 2.5],
    [0, 0],
    ['0', 0],
    ['12', 12],
    ['.5', 0.5],
    ['3.', 3],
  ])('accepts %j as %j', (input, expected) => {
    expect(parseStockQuantity(input)).toEqual({ ok: true, value: expected });
  });

  test('rounds to 3 decimals, the precision of NUMERIC(14,3)', () => {
    expect(parseStockQuantity(1.2345)).toEqual({ ok: true, value: 1.235 });
    expect(parseStockQuantity('0.0004')).toEqual({ ok: true, value: 0 });
  });

  test.each([[undefined], [null], [''], ['   ']])('absent value %j leaves the column alone', (input) => {
    expect(parseStockQuantity(input)).toEqual({ ok: true, value: undefined });
  });

  test.each([['abc'], ['1,5'], ['1.2.3'], ['--1'], ['1e3'], [NaN], [Infinity], [-Infinity], [-1], ['-0.5'], [{}], [[]], [true]])(
    'rejects %j', (input) => {
      expect(parseStockQuantity(input).ok).toBe(false);
    },
  );

  test('rejects a value too large for NUMERIC(14,3)', () => {
    expect(parseStockQuantity(MAX_STOCK_QUANTITY)).toEqual({ ok: true, value: MAX_STOCK_QUANTITY });
    expect(parseStockQuantity(MAX_STOCK_QUANTITY + 1000).ok).toBe(false);
  });

  test('the old parseInt behaviour would have been wrong (guards against reverting)', () => {
    expect(parseInt('1.5', 10)).toBe(1);
    expect(parseStockQuantity('1.5')).toEqual({ ok: true, value: 1.5 });
  });
});

describe('withNumericStock (pg returns NUMERIC as a string)', () => {
  test('turns a numeric string into a number', () => {
    const r = withNumericStock({ product_id: 'p', stock_quantity: '4995.900' });
    expect(r.stock_quantity).toBe(4995.9);
    expect(typeof r.stock_quantity).toBe('number');
  });
  test('zero stays a number, so a strict "=== 0" check in the POS works', () => {
    expect(withNumericStock({ stock_quantity: '0.000' }).stock_quantity === 0).toBe(true);
  });
  test('leaves numbers, null and rows without the column untouched', () => {
    const n = { stock_quantity: 7 };
    expect(withNumericStock(n)).toBe(n);
    expect(withNumericStock({ stock_quantity: null }).stock_quantity).toBeNull();
    expect(withNumericStock({ name: 'x' })).toEqual({ name: 'x' });
  });
  test('does not mutate its input and keeps other fields', () => {
    const input = { a: 1, stock_quantity: '2.500' };
    const out = withNumericStock(input);
    expect(input.stock_quantity).toBe('2.500');
    expect(out).toEqual({ a: 1, stock_quantity: 2.5 });
  });
  test('an unparsable string is left as it is rather than becoming NaN', () => {
    expect(withNumericStock({ stock_quantity: 'abc' }).stock_quantity).toBe('abc');
  });
});
