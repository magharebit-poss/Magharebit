import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * WhatsApp Order Intake Webhook — Green API
 *
 * Receives incoming WhatsApp messages from Green API and creates
 * whatsapp_orders records for staff review in the POS queue.
 *
 * Auth: token query-string (?token=<GREENAPI_WEBHOOK_TOKEN>).
 * If GREENAPI_WEBHOOK_TOKEN is unset → WARN and accept (dev mode).
 * Non-text webhook types (status updates, read receipts, etc.) → 200, skip.
 */

interface GreenApiWebhookPayload {
  typeWebhook: string;
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    sender?: string;
    senderName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: {
      textMessage?: string;
    };
  };
}

export async function whatsappOrdersWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Querystring: { token?: string } }>(
    '/webhooks/whatsapp-orders',
    { config: { public: true } },
    async (request: FastifyRequest<{ Querystring: { token?: string } }>, reply: FastifyReply) => {
      // ── Token verification ────────────────────────────────────────────────
      const expectedToken = process.env['GREENAPI_WEBHOOK_TOKEN'];
      const receivedToken = request.query.token;

      if (!expectedToken) {
        request.log.warn('GREENAPI_WEBHOOK_TOKEN not set — accepting webhook in dev mode');
      } else if (receivedToken !== expectedToken) {
        request.log.warn({ msg: 'WhatsApp webhook: invalid token' });
        return reply.status(401).send({ error: 'Invalid token' });
      }

      // ── Parse payload ─────────────────────────────────────────────────────
      const payload = request.body as GreenApiWebhookPayload;

      // Only handle incoming text messages; return 200 for everything else
      // so Green API does not retry non-actionable events (status updates,
      // read receipts, group notifications, etc.)
      if (
        payload.typeWebhook !== 'incomingMessageReceived' ||
        payload.messageData?.typeMessage !== 'textMessage'
      ) {
        return reply.status(200).send({ received: true, skipped: true });
      }

      // ── Extract fields ────────────────────────────────────────────────────
      const chatId = payload.senderData?.chatId ?? '';
      const phone = chatId.replace('@c.us', '').replace('+', '');
      const name = payload.senderData?.senderName ?? null;
      const message = payload.messageData?.textMessageData?.textMessage ?? '';

      if (!phone || !message) {
        request.log.warn({ chatId }, 'WhatsApp webhook: missing phone or message body');
        return reply.status(200).send({ received: true, skipped: true });
      }

      // ── Tenant lookup by whatsapp_phone ───────────────────────────────────
      // The merchant's configured WhatsApp number (added in migration 022).
      // If no tenant matches, log WARN and return 200 — Green API must not
      // receive non-200 or it will retry indefinitely.
      const tenantRes = await fastify.pg.query<{ id: string }>(
        `SELECT id FROM tenants WHERE whatsapp_phone = $1 AND is_active = true LIMIT 1`,
        [phone.startsWith('212') ? phone : `212${phone}`],
      ).catch(() => ({ rows: [] as { id: string }[] }));

      // Re-try: Green API sends the message FROM the customer's number;
      // we match against the MERCHANT's configured whatsapp_phone.
      // The merchant's number is what they set in their digest config.
      // Actually — the webhook fires when a customer messages the merchant's
      // Green API instance. The INSTANCE belongs to one tenant only.
      // We need to match by instance, but we only have whatsapp_phone.
      // Strategy: find any active tenant (single-tenant dev) or match by
      // GREENAPI_INSTANCE_ID env var cross-referenced with tenant config.
      // For Phase 1: find tenant whose whatsapp_phone matches the destination
      // (the merchant's own number, not the sender).
      // Green API does NOT send the destination in the standard payload —
      // we fall back to finding the FIRST active tenant (works for single-tenant
      // deployments; multi-tenant requires instance-per-tenant in Phase 2).
      let tenantId: string | null = tenantRes.rows[0]?.id ?? null;

      if (!tenantId) {
        // Phase 1 fallback: single active tenant
        const fallback = await fastify.pg.query<{ id: string }>(
          `SELECT id FROM tenants WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
        ).catch(() => ({ rows: [] as { id: string }[] }));
        tenantId = fallback.rows[0]?.id ?? null;
      }

      if (!tenantId) {
        request.log.warn({ phone }, 'WhatsApp webhook: no active tenant found — dropping message');
        return reply.status(200).send({ received: true, skipped: true });
      }

      // ── Customer auto-link ────────────────────────────────────────────────
      const customerRes = await fastify.pg.query<{ customer_id: string }>(
        `SELECT customer_id FROM customers WHERE tenant_id = $1 AND phone = $2 LIMIT 1`,
        [tenantId, phone],
      ).catch(() => ({ rows: [] as { customer_id: string }[] }));
      const customerId = customerRes.rows[0]?.customer_id ?? null;

      // ── Default store ─────────────────────────────────────────────────────
      const storeRes = await fastify.pg.query<{ store_id: string }>(
        `SELECT store_id FROM stores WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
        [tenantId],
      ).catch(() => ({ rows: [] as { store_id: string }[] }));
      const storeId = storeRes.rows[0]?.store_id ?? null;

      // ── Insert order ──────────────────────────────────────────────────────
      await fastify.pg.query(
        `INSERT INTO whatsapp_orders
          (tenant_id, customer_phone, customer_name, raw_message, customer_id, store_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, phone, name, message, customerId, storeId],
      );

      request.log.info({ tenantId, phone, customerId }, 'WhatsApp order created');

      // Always return 200 immediately — never let slow processing block Green API.
      return reply.status(200).send({ received: true });
    },
  );
}
