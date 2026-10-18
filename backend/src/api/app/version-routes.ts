import type { FastifyInstance } from 'fastify';

/**
 * GET /app/version — public, no auth required.
 *
 * Returns the latest APK version, minimum required version, and download URL.
 * All three values are sourced exclusively from environment variables.
 * No hardcoded values. Admin updates env vars on each release.
 *
 * MdmUpdateChecker.kt in the Android app calls this endpoint on every cold start.
 */
export async function versionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/app/version', { config: { public: true } }, async (_request, reply) => {
    const latestVersion = process.env['APP_LATEST_VERSION'];
    const minRequiredVersion = process.env['APP_MIN_REQUIRED_VERSION'];
    const downloadUrl = process.env['APP_DOWNLOAD_URL'];

    if (!latestVersion || !minRequiredVersion || !downloadUrl) {
      // Configuration error — do not expose missing keys, return 503
      return reply.status(503).send({ error: 'Version information not configured' });
    }

    return reply.status(200).send({
      latestVersion,
      minRequiredVersion,
      downloadUrl,
    });
  });
}
