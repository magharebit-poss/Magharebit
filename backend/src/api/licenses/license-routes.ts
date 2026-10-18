import type { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';

function verifyKeyChecksum(key: string, secret: string): boolean {
  const parts = key.split('-');
  if (parts.length !== 5) return false;
  const checksum = parts[4]!.toUpperCase();
  const payload = parts.slice(0, 4).join('-');
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 2)
    .toUpperCase();
  try {
    return timingSafeEqual(Buffer.from(checksum), Buffer.from(expected));
  } catch { return false; }
}

interface LicenseRow {
  tenant_id:  string;
  status:     string;
  expires_at: string | null;
  machine_id: string | null;
  plan:       string;
}

export async function licenseRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.post('/api/licenses/validate',
    { config: { public: true } },
    async (request, reply) => {
      const { key, machineId } = request.body as { key?: string; machineId?: string };

      if (!key || !machineId) {
        return reply.status(400).send({ valid: false, reason: 'missing_fields' });
      }

      const DEV_KEY = 'MGH-DEV000-00000000-0000-00';
      const isDev = process.env['NODE_ENV'] !== 'production' && key === DEV_KEY;

      const secret = process.env['LICENSE_HMAC_SECRET'] ?? '';

      if (!isDev && secret && !verifyKeyChecksum(key, secret)) {
        return reply.send({ valid: false, reason: 'checksum_failed' });
      }

      const result = await fastify.pg.query<LicenseRow>(
        `SELECT tenant_id, status, expires_at, machine_id, plan
         FROM licenses
         WHERE license_key = $1`,
        [key],
      );

      if (!result.rows[0]) {
        return reply.send({ valid: false, reason: 'checksum_failed' });
      }

      const lic = result.rows[0];

      if (lic.status === 'revoked') {
        return reply.send({ valid: false, reason: 'revoked' });
      }

      if (lic.expires_at !== null) {
        const expiresAt = new Date(lic.expires_at).getTime();
        if (Date.now() > expiresAt) {
          return reply.send({ valid: false, reason: 'expired' });
        }
      }

      if (!lic.machine_id) {
        await fastify.pg.query(
          `UPDATE licenses
           SET machine_id = $1, first_activated_at = now(), last_validated_at = now()
           WHERE license_key = $2`,
          [machineId, key],
        );
      } else if (lic.machine_id !== machineId) {
        return reply.send({ valid: false, reason: 'machine_mismatch' });
      } else {
        await fastify.pg.query(
          `UPDATE licenses SET last_validated_at = now() WHERE license_key = $1`,
          [key],
        );
      }

      let daysRemaining = 36500;
      if (lic.expires_at !== null) {
        const ms = new Date(lic.expires_at).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(ms / 86_400_000));
      }

      return reply.send({
        valid:           true,
        daysRemaining,
        firstActivation: !lic.machine_id,
        plan:            lic.plan,
        features:        [],
      });
    },
  );
}
