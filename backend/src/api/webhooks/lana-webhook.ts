import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { markSessionPaid } from '../payments/lana-routes';

/**
 * Lana Cash Webhook Handler — SECURITY CRITICAL
 *
 * HMAC-SHA256 validation using crypto.timingSafeEqual():
 * - NEVER use === for HMAC comparison (timing attack vector)
 * - LANA_WEBHOOK_SECRET from environment variable (never hardcoded)
 * - Invalid signature → 401 immediately, session NOT updated
 */
export async function lanaWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Register raw body parser for HMAC computation
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      done(null, body);
    }
  );

  fastify.post(
    '/webhooks/lana',
    // HMAC-SHA256 is the auth mechanism for this route — JWT is bypassed.
    { config: { public: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['x-lana-signature'] as string | undefined;

      if (!signature) {
        request.log.warn({ msg: 'Lana webhook: missing X-Lana-Signature header' });
        return reply.status(401).send({ error: 'Missing signature' });
      }

      const secret = process.env.LANA_WEBHOOK_SECRET;
      if (!secret) {
        request.log.error({ msg: 'LANA_WEBHOOK_SECRET not configured' });
        return reply.status(500).send({ error: 'Server misconfigured' });
      }

      const rawBody = request.body as Buffer;
      const isValid = validateHmacSignature(rawBody, signature, secret);

      if (!isValid) {
        request.log.warn({ msg: 'Lana webhook: invalid HMAC signature' });
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      // Parse the validated body
      const payload = JSON.parse(rawBody.toString('utf-8')) as {
        sessionId: string;
        status: string;
        paidAt: string;
      };

      if (payload.status === 'paid') {
        const updated = markSessionPaid(payload.sessionId);
        if (!updated) {
          return reply.status(404).send({ error: 'Session not found or already processed' });
        }
      }

      return reply.status(200).send({ received: true });
    }
  );
}

/**
 * Validates HMAC-SHA256 signature using timing-safe comparison.
 * Uses crypto.timingSafeEqual() — NEVER === (prevents timing attacks).
 */
function validateHmacSignature(
  body: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  // Expected format: "sha256=<hex>"
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length);
  const computedHmac = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const receivedBuffer = Buffer.from(receivedHex, 'hex');
  const computedBuffer = Buffer.from(computedHmac, 'hex');

  if (receivedBuffer.length !== computedBuffer.length) return false;

  // timingSafeEqual prevents timing attacks — NEVER use === here
  return timingSafeEqual(receivedBuffer, computedBuffer);
}

export { validateHmacSignature };
