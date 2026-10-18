// ── Load .env before ANY process.env reads ────────────────────────────────────
// `import 'dotenv/config'` resolves .env from process.cwd() — unreliable when
// the process is launched from the monorepo root (cwd = repo root, not backend/).
// Explicit __dirname-relative path always resolves to backend/.env regardless of
// which directory `npm run dev` is invoked from.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// override:true forces our values even if tsx's built-in .env loader already
// populated process.env from a different .env file (or with CRLF-tainted values).
const _dotenvResult = dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  override: true,
});
if (_dotenvResult.error) {
  console.error('[dotenv] Failed to load .env:', _dotenvResult.error.message);
} else {
  const count = Object.keys(_dotenvResult.parsed ?? {}).length;
  console.log(`[dotenv] Loaded ${count} vars from ${path.resolve(__dirname, '../.env')}`);
}
// ─────────────────────────────────────────────────────────────────────────────

import Fastify from 'fastify';
import cors, { type FastifyCorsOptions } from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import pg from 'pg';
import { authMiddleware } from './middleware/index.js';
import { adminRoutes } from './api/admin/admin-routes.js';
import { healthRoutes } from './api/admin/health-routes.js';
import { versionRoutes } from './api/app/version-routes.js';
import { posRoutes } from './api/pos/pos-routes.js';
import { invoiceRoutes } from './api/pos/invoice-routes.js';
import { portalRoutes } from './api/portal/portal-routes.js';
import { licenseRoutes } from './api/licenses/index.js';
import { lanaRoutes } from './api/payments/lana-routes.js';
import { lanaWebhookRoutes } from './api/webhooks/lana-webhook.js';
import { whatsappOrdersWebhookRoutes } from './api/webhooks/whatsapp-orders-webhook.js';
import { orderRoutes } from './api/orders/order-routes.js';
import { supplierRoutes, purchaseOrderRoutes } from './api/suppliers/supplier-routes.js';
import { invoiceOcrRoutes } from './api/suppliers/invoice-ocr-routes.js';
import { kdsRoutes } from './api/kds/kds-routes.js';
import { productRoutes } from './api/products/product-routes.js';
import { tenantRoutes } from './api/tenants/tenant-routes.js';
import { syncRoutes } from './api/sync/sync-routes.js';
import { digestRoutes } from './api/digest/digest-routes.js';
import { sendDigestToAllTenants } from './services/digest-service.js';
import { markdownRoutes } from './api/markdown/markdown-routes.js';
import { computeMarkdowns } from './services/markdown-engine.js';
import { analyticsChRoutes } from './api/analytics/analytics-ch-routes.js';
import { runEtl } from './services/analytics/etl-runner.js';
import { mlRoutes } from './api/ml/ml-routes.js';
import { trainModels } from './services/ml/model-trainer.js';
import { validateLicense, startLicenseRevalidation, injectMockLicense } from './services/license-engine.js';
import cron from 'node-cron';

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgres://greengo:localdev@localhost:5432/greengo_dev';
// Required. HS256 signing secret for all JWTs. No fallback — see boot guard below.
const JWT_SECRET = process.env['JWT_SECRET'];
const IS_PRODUCTION = process.env['NODE_ENV'] === 'production';
// Required. The merchant's license key. No fallback — see boot gate below.
const LICENSE_KEY = process.env['LICENSE_KEY'];

async function main() {
  // Fail fast: refuse to start without a signing secret. Never hard-code a fallback.
  if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET environment variable is required but not set. Refusing to start.');
    process.exit(1);
  }
  if (!LICENSE_KEY) {
    console.error('[FATAL] LICENSE_KEY environment variable is required but not set. Refusing to start.');
    process.exit(1);
  }

  // Dev-only license bypass. The production guard is the FIRST bypass check —
  // the bypass can NEVER be active when NODE_ENV=production.
  const bypassDev = process.env['LICENSE_BYPASS_DEV'] === 'true';
  if (bypassDev && IS_PRODUCTION) {
    console.error('[FATAL] LICENSE_BYPASS_DEV is set in a production environment. This is not permitted. Refusing to start.');
    process.exit(1);
  }
  if (bypassDev) {
    console.warn('[WARN] LICENSE_BYPASS_DEV is active. License validation is BYPASSED. This must never be used in production.');
  }

  // Resolve the single allowed CORS origin. In production CORS_ORIGIN is mandatory.
  let allowedOrigin: string;
  if (IS_PRODUCTION) {
    const corsOrigin = process.env['CORS_ORIGIN'];
    if (!corsOrigin) {
      console.error('[FATAL] CORS_ORIGIN environment variable is required in production but not set. Refusing to start.');
      process.exit(1);
    }
    allowedOrigin = corsOrigin;
  } else {
    allowedOrigin = 'http://localhost:3003';
  }

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport: process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // PostgreSQL connection pool
  const pool = new pg.Pool({ connectionString: DATABASE_URL, options: '-c client_encoding=UTF8' });
  app.decorate('pg', pool);

  // ── Static file serving for product images ─────────────────────────────────
  // Must be registered BEFORE routes so @fastify/static's reply decorator is
  // available to all route handlers. The images directory is created if absent.
  const imagesDir = process.env['IMAGES_DIR']
    ? path.resolve(process.env['IMAGES_DIR'])
    : path.join(path.dirname(__dirname), 'data', 'images');
  mkdirSync(imagesDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: imagesDir,
    prefix: '/images/',
    decorateReply: false,
  });

  // ── Multipart (file upload) ─────────────────────────────────────────────────
  // Must be registered BEFORE routes for the multipart body parser to apply.
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB max upload
      files: 1,                   // one file per request
    },
  });

  // Warm up the connection pool so the first client request does not pay the
  // TCP + PostgreSQL authentication handshake cost (typically 200–800 ms cold).
  try {
    await pool.query('SELECT 1');
    app.log.info('PostgreSQL connection pool ready.');
  } catch (err) {
    app.log.warn({ err }, 'PostgreSQL pool warm-up failed — first query may be slow.');
  }

  // Ensure all JSON responses carry explicit charset so Arabic text is never mojibake'd.
  app.addHook('onSend', async (_request, reply) => {
    const ct = reply.getHeader('content-type')?.toString() ?? '';
    if (ct.includes('application/json') && !ct.includes('charset')) {
      reply.header('content-type', 'application/json; charset=utf-8');
    }
  });

  // CORS — locked to a single explicit allowlist origin. No wildcard, no `origin: true`.
  app.log.info(`CORS allowed origin: ${allowedOrigin}`);
  const corsOptions: FastifyCorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        // No Origin header → server-to-server / same-origin (curl, native app, health probes).
        // Not a browser CORS request; allow.
        callback(null, true);
        return;
      }
      if (origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  await app.register(cors, corsOptions);
  await app.register(cookie);
  // JWT — Authorization: Bearer header, falling back to the portal_token cookie.
  await app.register(jwt, {
    secret: JWT_SECRET,
    cookie: { cookieName: 'portal_token', signed: false },
  });
  // Rate limiting — opt-in per route via `config.rateLimit` (global disabled).
  await app.register(rateLimit, { global: false });

  // Global auth hook (secure by default; routes opt out with config.public).
  await authMiddleware(app);

  // ── License boot gate ──────────────────────────────────────────────────
  // Validate the license BEFORE registering any routes. Refuse to start if
  // the license is invalid (LICENSE_KEY presence already guarded above).
  //
  // Runtime license flag. Background revalidation flips it to false if the
  // license later becomes invalid; the 402 hook below then blocks new sales
  // without killing in-progress requests. Decorated once here so the bypass
  // branch does not double-register the decorator.
  let licenseValid = true;
  app.decorate('licenseValid', true);

  if (!bypassDev) {
    const keyLast4 = LICENSE_KEY.length <= 4 ? LICENSE_KEY : LICENSE_KEY.slice(-4);
    const bootResult = await validateLicense(LICENSE_KEY);
    if (!bootResult.valid) {
      console.error(`[FATAL] License invalid (status: ${bootResult.status}, key …${keyLast4}, error: ${bootResult.error ?? 'n/a'}). Refusing to start.`);
      process.exit(1);
    }
    app.log.info(
      `License valid. Plan: ${bootResult.plan ?? 'unknown'}. Expires: ${bootResult.expiresAt ? bootResult.expiresAt.toISOString() : 'n/a'}.`,
    );
    startLicenseRevalidation(LICENSE_KEY, undefined, (result) => {
      if (!result.valid) {
        licenseValid = false;
        app.licenseValid = false;
        app.log.error(`License revalidation failed (status: ${result.status}, key …${keyLast4}). New sales blocked (402) until resolved.`);
      } else {
        licenseValid = true;
        app.licenseValid = true;
      }
    });
  } else {
    // DEV BYPASS ONLY — unreachable in production (guarded at boot above).
    // Inject a mock active license so /license/status is coherent and pos-web
    // does not show the license-error screen. No revalidation timer is started.
    injectMockLicense();
    app.log.warn('License validation bypassed (LICENSE_BYPASS_DEV). Mock active license injected — DEV ONLY.');
  }

  // 402 gate: when the license is runtime-invalid, block everything except the
  // health/version/status probes so in-progress requests finish but new ones stop.
  const LICENSE_EXEMPT_PATHS = new Set(['/health', '/app/version', '/license/status']);
  app.addHook('onRequest', async (request, reply) => {
    if (licenseValid) return;
    const url = request.routeOptions?.url ?? request.url;
    if (LICENSE_EXEMPT_PATHS.has(url)) return;
    return reply.status(402).send({ error: 'license_invalid', status: 'payment_required' });
  });

  // Health check — public, no auth.
  app.get('/health', { config: { public: true } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Route modules — each wrapped in an encapsulated scope with a module-level
  // default rate limit (per IP). Tighter per-route limits (e.g. the 5/min PIN
  // endpoints in posRoutes) override the module default within their scope.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(adminRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    await scope.register(healthRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(versionRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 300, timeWindow: '1 minute' });
    await scope.register(posRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(invoiceRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(portalRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    await scope.register(licenseRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 120, timeWindow: '1 minute' });
    await scope.register(lanaRoutes);
  });
  // Webhook scope — tighter rate limit; HMAC/token guards auth, not JWT.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(lanaWebhookRoutes);
  });
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 300, timeWindow: '1 minute' });
    await scope.register(whatsappOrdersWebhookRoutes);
  });

  // Order management scope — WhatsApp order queue (JWT-protected).
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(orderRoutes);
  });
  // Supplier + purchase order scope — stock receiving management.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(supplierRoutes);
    await scope.register(purchaseOrderRoutes);
  });

  // Invoice OCR scope — expensive (image OCR), so a tighter 20/min limit.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 20, timeWindow: '1 minute' });
    await scope.register(invoiceOcrRoutes);
  });

  // Sync scope — offline-first transaction drain from Tauri registers.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
    await scope.register(syncRoutes);
  });

  // Digest scope — WhatsApp daily digest routes.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(digestRoutes);
  });

  // KDS scope — Kitchen Display System. Higher rate limit for frequent polling.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 300, timeWindow: '1 minute' });
    await scope.register(kdsRoutes);
  });

  // Markdown scope — time-based price markdown rules + label printing.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(markdownRoutes);
  });

  // Product management scope — CRUD + image upload.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(productRoutes);
  });

  // Tenant profile scope — business type setup.
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(tenantRoutes);
  });

  // Analytics scope — ClickHouse read routes (MANAGER/SUPERVISOR only).
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(analyticsChRoutes);
  });

  // ML scope — demand forecasts + waste risk (MANAGER/SUPERVISOR only).
  await app.register(async (scope) => {
    await scope.register(rateLimit, { max: 60, timeWindow: '1 minute' });
    await scope.register(mlRoutes);
  });

  // Daily digest cron — fires at 06:00 UTC (07:00 Africa/Casablanca, UTC+1).
  // Per-tenant scheduling (respecting individual digest_time) is Phase 2.
  if (process.env['NODE_ENV'] !== 'test') {
    cron.schedule('0 6 * * *', async () => {
      app.log.info('Running daily digest cron');
      try {
        const results = await sendDigestToAllTenants(app.pg);
        app.log.info(
          {
            sent: results.filter((r) => r.sent).length,
            skipped: results.filter((r) => r.skipped).length,
            failed: results.filter((r) => !r.sent && !r.skipped).length,
          },
          'Daily digest complete',
        );
      } catch (err) {
        app.log.error({ err }, 'Daily digest cron failed');
      }
    }, { timezone: 'Africa/Casablanca' });
    app.log.info('Daily digest cron scheduled (06:00 UTC / 07:00 Africa/Casablanca)');

    // Hourly markdown cron — applies time-based markdown rules to all tenants.
    // Queries markdown_rules and product_lots to determine the correct discount
    // percent for each perishable product and writes current_markdown_percent.
    cron.schedule('0 * * * *', async () => {
      app.log.info('Running hourly markdown cron');
      try {
        const { rows: tenants } = await pool.query<{ id: string }>(
          `SELECT id FROM tenants WHERE is_active = true`,
        );
        let computed = 0;
        let cleared = 0;
        for (const tenant of tenants) {
          try {
            const result = await computeMarkdowns(pool, tenant.id);
            computed += result.computed.length;
            cleared += result.cleared.length;
          } catch (err) {
            app.log.error({ err, tenantId: tenant.id }, '[markdown cron] tenant failed');
          }
        }
        app.log.info({ computed, cleared }, 'Hourly markdown cron complete');
      } catch (err) {
        app.log.error({ err }, 'Hourly markdown cron failed');
      }
    }, { timezone: 'Africa/Casablanca' });
    app.log.info('Hourly markdown cron scheduled');

    // ETL cron — nightly at 02:00 Casablanca time, after traffic drops.
    cron.schedule('0 2 * * *', async () => {
      app.log.info('Starting nightly ETL to ClickHouse');
      try {
        const results = await runEtl(app.pg);
        const totalRows = results.reduce(
          (sum, r) => sum + Object.values(r.rowsSynced).reduce((a, b) => a + b, 0),
          0,
        );
        app.log.info({ totalRows, tenants: results.length }, 'ETL complete');
      } catch (err) {
        app.log.error({ err }, 'ETL cron failed');
      }
    }, { timezone: 'Africa/Casablanca' });
    app.log.info('ETL cron scheduled (02:00 Africa/Casablanca)');

    // ML training cron — Sundays at 03:00 (after nightly ETL at 02:00).
    cron.schedule('0 3 * * 0', async () => {
      app.log.info('Starting weekly ML training');
      try {
        await trainModels();
        app.log.info('ML training complete');
      } catch (err) {
        app.log.error({ err }, 'ML training cron failed');
      }
    }, { timezone: 'Africa/Casablanca' });
    app.log.info('ML cron scheduled (Sundays 03:00 Africa/Casablanca)');
  }

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`GreenGo backend running at http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
