import type { FastifyInstance, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../../monitoring/logger';

const log = createLogger({ service: 'portal-routes' });

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoginBody {
  email: string;
  licenseKey: string;
}

interface LicenseKeyRow {
  key_string: string;
  tenant_id: string;
  status: string;
  expires_at: string;
  grace_ends_at: string | null;
  tenant_name: string;
}

interface ApkReleaseRow {
  version: string;
  s3_key: string;
  sha256_hash: string;
  file_size_bytes: number | null;
  released_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskLicenseKey(key: string): string {
  const parts = key.split('-');
  if (parts.length < 4) return 'GGPO-****';
  return `GGPO-${parts[1]}-****-****`;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) {
      // Still do comparison to prevent length-based timing leak
      timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function portalRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * POST /portal/auth/login
   * Rate limit: 10 attempts per IP per 15 minutes.
   * Uses timingSafeEqual for license key comparison.
   * Sets HttpOnly; Secure; SameSite=Strict cookie.
   */
  fastify.post<{ Body: LoginBody }>(
    '/portal/auth/login',
    {
      config: {
        public: true, // token-issuing login — reachable without a JWT
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply) => {
      const { email, licenseKey } = request.body;
      if (!email || !licenseKey) {
        return reply.status(400).send({ error: 'missing fields' });
      }

      try {
        const { rows } = await fastify.pg.query<LicenseKeyRow>(
          `SELECT
             lk.key_string,
             lk.tenant_id,
             lk.status,
             lk.expires_at::text,
             lk.grace_ends_at::text,
             t.name AS tenant_name
           FROM license_keys lk
           JOIN tenants t ON t.id = lk.tenant_id
           JOIN tenant_users tu ON tu.tenant_id = lk.tenant_id
           WHERE tu.email = $1
             AND lk.status NOT IN ('revoked')
           LIMIT 1`,
          [email.trim().toLowerCase()],
        );

        const row = rows[0];
        // Always run comparison even if no row found — prevents timing oracle
        const candidateKey = row?.key_string ?? 'GGPO-000000-00000000-0000';
        const isMatch = timingSafeStringEqual(candidateKey, licenseKey.trim());

        if (!row || !isMatch) {
          return reply.status(401).send({ error: 'invalid credentials' });
        }

        // Sign JWT
        const token = fastify.jwt.sign(
          { tenantId: row.tenant_id, role: 'TENANT_OWNER' },
          { expiresIn: '24h' },
        );

        return reply
          .header(
            'Set-Cookie',
            `portal_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
          )
          .status(200)
          .send({ ok: true });
      } catch (err: unknown) {
        log.error({ err: err instanceof Error ? err : undefined }, 'portal login failed');
        return reply.status(500).send({ error: 'internal error' });
      }
    },
  );

  /**
   * GET /portal/subscription
   * Auth: portal_token cookie (JWT validated by middleware).
   */
  fastify.get('/portal/subscription', { config: { allowedRoles: ['TENANT_OWNER'] } }, async (request, reply) => {
    const tenantId = (request as FastifyRequest & { tenantId?: string }).tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const { rows } = await fastify.pg.query<{
        status: string;
        expires_at: string;
        grace_ends_at: string | null;
        tenant_name: string;
        key_string: string;
      }>(
        `SELECT
           lk.status,
           lk.expires_at::text,
           lk.grace_ends_at::text,
           t.name AS tenant_name,
           lk.key_string
         FROM license_keys lk
         JOIN tenants t ON t.id = lk.tenant_id
         WHERE lk.tenant_id = $1
           AND lk.status NOT IN ('revoked')
         ORDER BY lk.created_at DESC
         LIMIT 1`,
        [tenantId],
      );

      const row = rows[0];
      if (!row) return reply.status(404).send({ error: 'No active license' });

      return reply.status(200).send({
        status: row.status,
        expiresAt: row.expires_at,
        graceEndsAt: row.grace_ends_at,
        tenantName: row.tenant_name,
        maskedKey: maskLicenseKey(row.key_string),
      });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'portal subscription fetch failed');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  /**
   * GET /portal/apk/download-url
   * Auth: portal_token cookie.
   * Returns presigned S3 URL (900s) or fallback static URL.
   *
   * apk_releases table (migration 013):
   *   CREATE TABLE apk_releases (
   *     version        TEXT PRIMARY KEY,
   *     s3_key         TEXT NOT NULL,
   *     sha256_hash    TEXT NOT NULL,
   *     file_size_bytes BIGINT,
   *     released_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   *     is_current     BOOLEAN NOT NULL DEFAULT false,
   *     release_notes  TEXT
   *   );
   *   CREATE UNIQUE INDEX idx_apk_releases_current
   *     ON apk_releases(is_current) WHERE is_current = true;
   *   -- Enforces exactly one current release at the database level.
   */
  fastify.get('/portal/apk/download-url', { config: { allowedRoles: ['TENANT_OWNER'] } }, async (request, reply) => {
    const tenantId = (request as FastifyRequest & { tenantId?: string }).tenantId;
    if (!tenantId) return reply.status(401).send({ error: 'Unauthorized' });

    try {
      const { rows } = await fastify.pg.query<ApkReleaseRow>(
        `SELECT version, s3_key, sha256_hash, file_size_bytes, released_at::text
         FROM apk_releases
         WHERE is_current = true
         LIMIT 1`,
      );

      const release = rows[0];
      if (!release) return reply.status(404).send({ error: 'No release available' });

      const s3Bucket = process.env['S3_BUCKET'];
      if (s3Bucket) {
        // Presigned S3 URL, 900 seconds expiry
        const client = new S3Client({ region: process.env['AWS_REGION'] ?? 'eu-west-1' });
        const command = new GetObjectCommand({ Bucket: s3Bucket, Key: release.s3_key });
        const url = await getSignedUrl(client, command, { expiresIn: 900 });
        const expiresAt = new Date(Date.now() + 900_000).toISOString();

        return reply.status(200).send({
          url,
          version: release.version,
          sha256Hash: release.sha256_hash,
          expiresAt,
          fileSize: release.file_size_bytes,
          releasedAt: release.released_at,
        });
      }

      // Fallback: static URL from env var
      const staticUrl = process.env['APP_DOWNLOAD_URL'] ?? '';
      return reply.status(200).send({
        url: staticUrl,
        version: release.version,
        sha256Hash: release.sha256_hash,
        expiresAt: null,
        fileSize: release.file_size_bytes,
        releasedAt: release.released_at,
      });
    } catch (err: unknown) {
      log.error({ err: err instanceof Error ? err : undefined }, 'apk download-url failed');
      return reply.status(500).send({ error: 'internal error' });
    }
  });

  /**
   * POST /portal/auth/logout
   * Clears portal_token cookie.
   */
  fastify.post('/portal/auth/logout', { config: { public: true } }, async (_request, reply) => {
    return reply
      .header('Set-Cookie', 'portal_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
      .status(200)
      .send({ ok: true });
  });
}
