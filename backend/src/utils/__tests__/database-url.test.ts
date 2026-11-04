import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { resolveDatabaseUrl } from '../database-url';

const PROD_URL = 'postgres://app:s3cret@db.internal:5432/greengo';

describe('resolveDatabaseUrl: production must not fall back to the dev database', () => {
  test('production with DATABASE_URL unset throws a clear error that names the variable', () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    expect(() => resolveDatabaseUrl({ NODE_ENV: 'production' })).toThrow(/not set/);
  });

  test('the error never contains the dev URL or its password', () => {
    let message = '';
    try { resolveDatabaseUrl({ NODE_ENV: 'production' }); } catch (e) { message = (e as Error).message; }
    expect(message).not.toContain('localdev');
    expect(message).not.toContain('postgres://');
    expect(message).not.toContain('greengo_dev');
  });

  test('empty or blank DATABASE_URL counts as unset', () => {
    for (const blank of ['', '   ', '\t']) {
      expect(() => resolveDatabaseUrl({ NODE_ENV: 'production', DATABASE_URL: blank }), JSON.stringify(blank)).toThrow(/DATABASE_URL/);
    }
  });

  test('production with DATABASE_URL set uses it unchanged', () => {
    expect(resolveDatabaseUrl({ NODE_ENV: 'production', DATABASE_URL: PROD_URL })).toBe(PROD_URL);
  });

  test('staging and any unknown environment name also refuse (fail closed), whatever the case or spacing', () => {
    for (const env of ['staging', 'Production', 'PRODUCTION', ' production ', 'prod', 'local', 'qa', 'preview']) {
      expect(() => resolveDatabaseUrl({ NODE_ENV: env }), env).toThrow(/DATABASE_URL/);
    }
  });

  test('no non-local environment can ever receive the dev URL, with or without a blank variable', () => {
    for (const env of ['production', 'staging', 'prod', 'live']) {
      for (const url of [undefined, '', '  ']) {
        let got: string | null = null;
        try { got = resolveDatabaseUrl({ NODE_ENV: env, DATABASE_URL: url }); } catch { got = null; }
        expect(got, `${env} / ${JSON.stringify(url)}`).toBeNull();
      }
    }
  });
});

describe('resolveDatabaseUrl: a developer machine keeps working', () => {
  test('development, test, empty and unset NODE_ENV fall back to the local dev database', () => {
    for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: '' }, {}]) {
      expect(resolveDatabaseUrl(env), JSON.stringify(env)).toContain('@localhost:5432/greengo_dev');
    }
  });

  test('a configured DATABASE_URL always wins, in every environment', () => {
    for (const env of ['development', 'test', undefined, 'production', 'staging']) {
      expect(resolveDatabaseUrl({ NODE_ENV: env, DATABASE_URL: PROD_URL }), String(env)).toBe(PROD_URL);
    }
  });
});

describe('index.ts uses it', () => {
  const source = readFileSync(new URL('../../index.ts', import.meta.url), 'utf8');

  test('the startup file resolves the URL through resolveDatabaseUrl and turns a failure into a fatal exit', () => {
    expect(source).toMatch(/resolveDatabaseUrl\(process\.env\)/);
    expect(source).toMatch(/\[FATAL\]/);
  });

  test('the startup file no longer carries an inline fallback or the dev password', () => {
    expect(source).not.toContain('localdev');
    expect(source).not.toMatch(/\?\?\s*['"]postgres/);
  });
});
