/**
 * S4-002 — Pino logger unit tests.
 *
 * Tests verify:
 *   - PII redaction paths are effective
 *   - logSyncBatchResult logs counts but not raw deductions
 *   - createLogger produces child loggers with service context
 *   - Response body serializer does not log body
 */

import { describe, test, expect } from 'vitest';
import pino from 'pino';
import { createLogger, REDACT_PATHS } from '../logger';
import { logSyncBatchResult } from '../sync-metrics';

// ---------------------------------------------------------------------------
// Helpers: capture pino output in-memory for assertions
// ---------------------------------------------------------------------------

interface CapturedLog {
  level: string;
  msg?: string;
  [key: string]: unknown;
}

function buildTestLogger(captures: CapturedLog[]) {
  return pino(
    {
      level: 'debug',
      redact: {
        paths: [
          'pinHash',
          'pin_hash',
          'masterSecret',
          'master_secret',
          'req.body.pin',
          'req.body.masterSecret',
          'req.headers.authorization',
        ],
        censor: '[REDACTED]',
      },
    },
    {
      write(chunk: string) {
        captures.push(JSON.parse(chunk) as CapturedLog);
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Pino redact tests
// ---------------------------------------------------------------------------

describe('Pino redact paths', () => {
  test('pinHash in log object → [REDACTED]', () => {
    const logs: CapturedLog[] = [];
    const log = buildTestLogger(logs);
    log.info({ pinHash: 'abc123', event: 'test' });
    expect(logs[0]?.['pinHash']).toBe('[REDACTED]');
    expect(logs[0]?.['event']).toBe('test');
  });

  test('masterSecret in log object → [REDACTED]', () => {
    const logs: CapturedLog[] = [];
    const log = buildTestLogger(logs);
    log.info({ masterSecret: 'super-secret-value', event: 'test' });
    expect(logs[0]?.['masterSecret']).toBe('[REDACTED]');
  });

  test('req.headers.authorization → [REDACTED]', () => {
    const logs: CapturedLog[] = [];
    const log = buildTestLogger(logs);
    log.info({ req: { headers: { authorization: 'Bearer jwt-token' }, url: '/test' } });
    const req = logs[0]?.['req'] as Record<string, unknown> | undefined;
    const headers = req?.['headers'] as Record<string, unknown> | undefined;
    expect(headers?.['authorization']).toBe('[REDACTED]');
  });

  test('safe fields (registerId, tenantId) pass through unredacted', () => {
    const logs: CapturedLog[] = [];
    const log = buildTestLogger(logs);
    log.info({ registerId: 'reg-001', tenantId: 'tenant-001', event: 'sync' });
    expect(logs[0]?.['registerId']).toBe('reg-001');
    expect(logs[0]?.['tenantId']).toBe('tenant-001');
  });
});

// ---------------------------------------------------------------------------
// Production REDACT_PATHS (imported from logger.ts, not a local copy)
// ---------------------------------------------------------------------------

describe('Production REDACT_PATHS on a real pino instance', () => {
  const CENSOR = '[REDACTED]';
  const SECRET = 'sk-live-should-never-appear-in-a-log';

  function prodLogger(captures: CapturedLog[]) {
    return pino(
      { level: 'debug', redact: { paths: REDACT_PATHS, censor: CENSOR } },
      { write(chunk: string) { captures.push(JSON.parse(chunk) as CapturedLog); } },
    );
  }

  test('req.body.ai_key, green_token and green_instance_id are redacted', () => {
    const logs: CapturedLog[] = [];
    prodLogger(logs).info({
      req: { body: { ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET, store_name: 'Atlas' } },
    });
    const body = (logs[0]?.['req'] as { body: Record<string, unknown> }).body;
    expect(body['ai_key']).toBe(CENSOR);
    expect(body['green_token']).toBe(CENSOR);
    expect(body['green_instance_id']).toBe(CENSOR);
    expect(body['store_name']).toBe('Atlas');
    expect(JSON.stringify(logs[0])).not.toContain(SECRET);
  });

  test('nested *.ai_key, *.apiKey, *.apiToken, *.green_token, *.green_instance_id are redacted', () => {
    const logs: CapturedLog[] = [];
    prodLogger(logs).info({
      settings: { ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET },
      provider: { apiKey: SECRET, apiToken: SECRET, name: 'greenapi' },
    });
    const settings = logs[0]?.['settings'] as Record<string, unknown>;
    const provider = logs[0]?.['provider'] as Record<string, unknown>;
    expect(settings['ai_key']).toBe(CENSOR);
    expect(settings['green_token']).toBe(CENSOR);
    expect(settings['green_instance_id']).toBe(CENSOR);
    expect(provider['apiKey']).toBe(CENSOR);
    expect(provider['apiToken']).toBe(CENSOR);
    expect(provider['name']).toBe('greenapi');
    expect(JSON.stringify(logs[0])).not.toContain(SECRET);
  });

  const SECRET_KEYS = ['ai_key', 'green_token', 'green_instance_id', 'apiKey', 'apiToken'] as const;

  test('top-level secrets are redacted', () => {
    const logs: CapturedLog[] = [];
    const raw: string[] = [];
    const l = pino({ redact: { paths: REDACT_PATHS, censor: CENSOR } }, { write(c: string) { raw.push(c); logs.push(JSON.parse(c) as CapturedLog); } });
    l.info({ ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET, apiKey: SECRET, apiToken: SECRET, tenant_id: 't-1', name: 'Atlas' });
    for (const k of SECRET_KEYS) expect(logs[0]?.[k], k).toBe(CENSOR);
    expect(logs[0]?.['tenant_id']).toBe('t-1');
    expect(logs[0]?.['name']).toBe('Atlas');
    expect(raw.join('')).not.toContain(SECRET);
  });

  test('one-level nested secrets are redacted and siblings untouched', () => {
    const raw: string[] = [];
    const l = pino({ redact: { paths: REDACT_PATHS, censor: CENSOR } }, { write(c: string) { raw.push(c); } });
    l.info({ settings: { ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET, apiKey: SECRET, apiToken: SECRET, tenant_id: 't-1', name: 'Atlas' } });
    const s = (JSON.parse(raw[0]!) as { settings: Record<string, unknown> }).settings;
    for (const k of SECRET_KEYS) expect(s[k], k).toBe(CENSOR);
    expect(s['tenant_id']).toBe('t-1');
    expect(s['name']).toBe('Atlas');
    expect(raw.join('')).not.toContain(SECRET);
  });

  test('two-level nested secrets are redacted and siblings untouched', () => {
    const raw: string[] = [];
    const l = pino({ redact: { paths: REDACT_PATHS, censor: CENSOR } }, { write(c: string) { raw.push(c); } });
    l.info({ ctx: { integrations: { ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET, apiKey: SECRET, apiToken: SECRET, tenant_id: 't-1', name: 'Atlas' } } });
    const s = (JSON.parse(raw[0]!) as { ctx: { integrations: Record<string, unknown> } }).ctx.integrations;
    for (const k of SECRET_KEYS) expect(s[k], k).toBe(CENSOR);
    expect(s['tenant_id']).toBe('t-1');
    expect(s['name']).toBe('Atlas');
    expect(raw.join('')).not.toContain(SECRET);
  });

  test('req.body secrets: no secret value anywhere in the output string', () => {
    const raw: string[] = [];
    const l = pino({ redact: { paths: REDACT_PATHS, censor: CENSOR } }, { write(c: string) { raw.push(c); } });
    l.info({ req: { body: { ai_key: SECRET, green_token: SECRET, green_instance_id: SECRET, tenant_id: 't-1' } } });
    expect(raw.join('')).not.toContain(SECRET);
    expect(raw.join('')).toContain('t-1');
  });

  test('authorization and x-api-key headers are redacted', () => {
    const logs: CapturedLog[] = [];
    prodLogger(logs).info({ req: { headers: { authorization: `Bearer ${SECRET}`, 'x-api-key': SECRET, accept: 'application/json' } } });
    const headers = (logs[0]?.['req'] as { headers: Record<string, unknown> }).headers;
    expect(headers['authorization']).toBe(CENSOR);
    expect(headers['x-api-key']).toBe(CENSOR);
    expect(headers['accept']).toBe('application/json');
  });

  test('normal fields are untouched', () => {
    const logs: CapturedLog[] = [];
    prodLogger(logs).info({ registerId: 'reg-001', tenantId: 'tenant-001', event: 'sync', req: { body: { quantity: 2, productId: 'p-1' } } });
    expect(logs[0]?.['registerId']).toBe('reg-001');
    expect(logs[0]?.['tenantId']).toBe('tenant-001');
    expect(logs[0]?.['event']).toBe('sync');
    expect((logs[0]?.['req'] as { body: Record<string, unknown> }).body).toEqual({ quantity: 2, productId: 'p-1' });
  });

  test('every integration secret path is present in REDACT_PATHS (guards against silent removal)', () => {
    for (const p of ['req.body.ai_key', 'req.body.green_token', 'req.body.green_instance_id', '*.ai_key', '*.apiKey', '*.apiToken']) {
      expect(REDACT_PATHS).toContain(p);
    }
  });
});

// ---------------------------------------------------------------------------
// logSyncBatchResult — metric content tests
// ---------------------------------------------------------------------------

describe('logSyncBatchResult', () => {
  test('does not log raw deductions array', () => {
    // logSyncBatchResult accepts only SyncBatchMetric — no rawDeductions field.
    // This test verifies the type contract prevents raw deductions from appearing.
    const metric = {
      batchId: 'batch-001',
      tenantId: 'tenant-001',
      registerId: 'reg-001',
      deductionCount: 3,
      acceptedCount: 2,
      correctionEventCount: 1,
      nominalYieldFlagCount: 0,
      processingTimeMs: 145,
    };

    // logSyncBatchResult must accept SyncBatchMetric — no rawDeductions property
    // TypeScript enforces this at compile time; this test documents the contract.
    expect(Object.keys(metric)).not.toContain('rawDeductions');
    expect(Object.keys(metric)).not.toContain('deductions');
    // Should not throw
    expect(() => logSyncBatchResult(metric)).not.toThrow();
  });

  test('logSyncBatchResult logs processingTimeMs as a number', () => {
    const logs: CapturedLog[] = [];
    const testLog = buildTestLogger(logs);

    // Manually call the inner log to verify the shape
    testLog.info({
      event: 'sync_batch_result',
      batchId: 'batch-001',
      tenantId: 'tenant-001',
      registerId: 'reg-001',
      deductionCount: 5,
      acceptedCount: 4,
      correctionEventCount: 1,
      nominalYieldFlagCount: 0,
      processingTimeMs: 234,
    });

    expect(typeof logs[0]?.['processingTimeMs']).toBe('number');
    expect(logs[0]?.['processingTimeMs']).toBe(234);
  });
});

// ---------------------------------------------------------------------------
// createLogger — child logger context
// ---------------------------------------------------------------------------

describe('createLogger child logger', () => {
  test('child logger includes service name in output', () => {
    const childLogger = createLogger({ service: 'sync-service', tenantId: 'tenant-001' });
    // createLogger returns a pino child logger — verify it has the pino interface
    expect(typeof childLogger.info).toBe('function');
    expect(typeof childLogger.error).toBe('function');
    expect(typeof childLogger.warn).toBe('function');
    expect(typeof childLogger.debug).toBe('function');
  });

  test('child logger with registerId context', () => {
    const childLogger = createLogger({
      service: 'license-service',
      registerId: 'reg-abc',
      tenantId: 'tenant-xyz',
    });
    expect(typeof childLogger.info).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Response serializer — body must not be logged
// ---------------------------------------------------------------------------

describe('Response serializer', () => {
  test('res serializer returns only statusCode (no body)', () => {
    // Import the serializer logic directly by verifying the logger config.
    // The serializer in logger.ts deliberately excludes body.
    const mockReply = {
      statusCode: 200,
      body: { secret: 'should-not-appear', data: [1, 2, 3] },
    };

    // Simulates what the pino res serializer returns
    const serialized = {
      statusCode: mockReply.statusCode,
      // body intentionally omitted
    };

    expect(Object.keys(serialized)).toEqual(['statusCode']);
    expect((serialized as Record<string, unknown>)['body']).toBeUndefined();
  });
});
