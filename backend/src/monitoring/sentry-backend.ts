/**
 * S4-001 — Sentry Node.js SDK initialization for the Fastify backend.
 *
 * DSN from environment variable SENTRY_DSN_BACKEND — never hardcoded.
 *
 * PII rules identical to apps/pos sentry.ts:
 *   - payment/license breadcrumbs: data stripped
 *   - PII fields: replaced with '[REDACTED]'
 *   - User context: only { id: tenantId } — never email, IP, device ID
 *   - tracesSampleRate: 0.05 in production
 */

import * as Sentry from '@sentry/node';

// ---------------------------------------------------------------------------
// PII scrubbing (mirrors apps/pos/src/monitoring/sentry.ts)
// ---------------------------------------------------------------------------

const PII_EXACT = new Set<string>([
  'card_number', 'pan', 'track_data', 'cvv',
  'pin', 'pin_hash', 'pinHash',
  'masterSecret', 'master_secret',
  'ANDROID_ID', 'android_id',
  'tenant_license_hash', 'sqlcipher_key',
  'cmiTokenRef', 'cmi_token_ref',
]);

const PII_PATTERN = /pin|key|secret|hash|token/i;
const MAX_STRING_LENGTH = 200;

function redactValue(key: string, value: unknown): unknown {
  if (PII_EXACT.has(key) || PII_PATTERN.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    if (value.startsWith('GGPO-')) return 'GGPO-****';
    if (value.length > MAX_STRING_LENGTH) {
      return value.slice(0, MAX_STRING_LENGTH) + '…[TRUNCATED]';
    }
  }
  return value;
}

function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    if (obj.startsWith('GGPO-')) return 'GGPO-****';
    if (obj.length > MAX_STRING_LENGTH) return obj.slice(0, MAX_STRING_LENGTH) + '…[TRUNCATED]';
    return obj;
  }
  if (Array.isArray(obj)) return obj.map((item) => redactObject(item));
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = redactValue(k, typeof v === 'object' ? redactObject(v) : v);
    }
    return result;
  }
  return obj;
}

const CARD_NUMBER_SAFE_FIELDS = new Set<string>([
  'transactionId', 'transaction_id', 'shiftId', 'shift_id',
  'deductionId', 'deduction_id', 'batchId', 'batch_id',
  'registerId', 'register_id', 'tenantId', 'tenant_id',
  'receiptId', 'receipt_id', 'lotId', 'lot_id',
  'staffId', 'staff_id', 'saleTransactionId', 'sale_transaction_id',
]);

const CARD_NUMBER_PATTERN = /\b[0-9]{13,19}\b/;

function containsRawCardNumber(obj: unknown, parentKey?: string): boolean {
  if (typeof obj === 'string') {
    if (CARD_NUMBER_SAFE_FIELDS.has(parentKey ?? '')) return false;
    return CARD_NUMBER_PATTERN.test(obj);
  }
  if (Array.isArray(obj)) return obj.some((item) => containsRawCardNumber(item, parentKey));
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj as Record<string, unknown>).some(([k, v]) =>
      containsRawCardNumber(v, k),
    );
  }
  return false;
}

function beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  try {
    if (event.extra) event.extra = redactObject(event.extra) as Record<string, unknown>;
    if (event.contexts) {
      event.contexts = redactObject(event.contexts) as Record<string, Record<string, unknown>>;
    }
    if (event.tags) event.tags = redactObject(event.tags) as Record<string, string>;
    if (event.user) {
      event.user = event.user.id !== undefined ? { id: event.user.id } : {};
    }

    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((bc: Sentry.Breadcrumb) => {
        if (bc.category === 'payment' || bc.category === 'license') {
          return { ...bc, data: undefined };
        }
        return bc;
      });
    }

    if (containsRawCardNumber(event)) return null;
    return event;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const ENV = (process.env['NODE_ENV'] ?? 'development') as string;

export function initSentryBackend(): void {
  const dsn = process.env['SENTRY_DSN_BACKEND'];
  if (!dsn) {
    if (ENV !== 'production') return;
    throw new Error('SENTRY_DSN_BACKEND environment variable is required in production');
  }

  Sentry.init({
    dsn,
    environment: ENV,
    tracesSampleRate: ENV === 'production' ? 0.05 : ENV === 'staging' ? 0.2 : 1.0,
    integrations: [
      // Automatic Fastify request tracing
      Sentry.httpIntegration(),
    ],
    beforeSend,
  });
}

export { Sentry };
