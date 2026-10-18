/**
 * S4-002 — Pino structured logger for the Fastify backend.
 *
 * Log level strategy:
 *   production: 'warn'  (only warnings and errors)
 *   staging:    'info'
 *   development:'debug'
 *   Override via LOG_LEVEL environment variable.
 *
 * PII rules:
 *   - req: only method, url, route, tenantId from JWT — never headers, body, IP
 *   - res: only statusCode, responseTime — never body
 *   - err: message, stack (truncated), code — never err.config.data or err.request.data
 *   - All pino redact paths configured to censor '[REDACTED]'
 *
 * No bare console.log in production code — use this logger or a child logger.
 */

import pino from 'pino';
import type { FastifyRequest, FastifyReply } from 'fastify';

const ENV = (process.env['NODE_ENV'] ?? 'development') as string;

const DEFAULT_LEVEL =
  ENV === 'production' ? 'warn'
  : ENV === 'staging'  ? 'info'
  : 'debug';

const LOG_LEVEL = process.env['LOG_LEVEL'] ?? DEFAULT_LEVEL;

// ---------------------------------------------------------------------------
// Pino redact paths — prevents PII appearing in any log line
// ---------------------------------------------------------------------------

const REDACT_PATHS: string[] = [
  // Payment fields (LAW 5 / CI gate 02)
  'req.body.card_number',
  'req.body.pan',
  'req.body.track_data',
  'req.body.cvv',
  'req.body.pin',
  'req.body.pinHash',
  'req.body.pin_hash',
  'req.body.cmiTokenRef',
  'res.body.cmiTokenRef',

  // License and key material
  'req.body.masterSecret',
  'req.body.master_secret',
  'req.body.sqlcipher_key',
  'req.body.tenant_license_hash',
  'req.body.licenseKey',

  // Device identifiers
  'req.body.androidId',
  'req.body.ANDROID_ID',
  'req.headers["x-device-id"]',
  'req.headers.authorization',
  'req.headers["x-api-key"]',

  // Response body mirrors
  'res.body.masterSecret',
  'res.body.sqlcipher_key',
  'res.body.tenant_license_hash',

  // Nested in sync/adjudication payloads
  'req.body.deductions[*].pin',
  'req.body.floorExceededEvents[*].pin',

  // Error objects that may capture request context
  'err.config.data',
  'err.request.data',
  'err.config.headers.authorization',
];

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

const MAX_STACK_LENGTH = 2000;

const serializers = {
  req(request: FastifyRequest) {
    return {
      method: request.method,
      url: request.url,
      route: request.routeOptions?.url ?? request.url,
      // tenantId from JWT claim (safe, non-PII identifier for multi-tenant routing)
      tenantId: (request as FastifyRequest & { tenantId?: string }).tenantId ?? undefined,
      // NEVER log: headers, body, IP, query params
    };
  },
  res(reply: FastifyReply) {
    return {
      statusCode: reply.statusCode,
      // responseTime added by Fastify's reply serializer automatically
    };
  },
  err(err: Error & { code?: string; config?: unknown; request?: unknown }) {
    return {
      message: err.message,
      // Truncate stack to 2000 chars — prevents log flooding
      stack: err.stack !== undefined ? err.stack.slice(0, MAX_STACK_LENGTH) : undefined,
      code: err.code,
      // NEVER log: err.config.data or err.request.data (may contain request bodies)
    };
  },
};

// ---------------------------------------------------------------------------
// Loki transport (dev + staging only)
// ---------------------------------------------------------------------------

function buildTransport(): pino.TransportSingleOptions | undefined {
  if (ENV === 'production') return undefined;

  const lokiEndpoint = process.env['LOKI_ENDPOINT'];
  if (!lokiEndpoint) return undefined;

  return {
    target: 'pino-loki',
    options: {
      host: lokiEndpoint,
      labels: { app: 'greengo-backend', env: ENV },
      silenceErrors: true, // Loki unavailable must not crash the backend
    },
  };
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

const transport = buildTransport();

export const logger = pino({
  level: LOG_LEVEL,
  serializers,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    // censor instead of remove: preserves field presence for debugging
    // while hiding values. Analysts can tell "this field existed but was redacted".
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  ...(transport !== undefined ? { transport } : {}),
});

// ---------------------------------------------------------------------------
// Child logger factory
// ---------------------------------------------------------------------------

export interface LogContext {
  service: string;
  registerId?: string;
  tenantId?: string;
}

export function createLogger(context: LogContext): pino.Logger {
  return logger.child(context);
}
