import type { FastifyInstance } from 'fastify';
import { isEncryptionConfigured, scrubSecrets } from '../../services/credentials-crypto.js';
import {
  getIntegrationStatus,
  inputNeedsEncryption,
  loadTenantGreenCreds,
  saveIntegrations,
  type IntegrationInput,
} from '../../services/integrations.js';

// Reading the status (phone, digest toggle, "configured" flags): manager and above.
const READ_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;
// Changing or testing secrets: SUPERVISOR and OWNER only.
const SECRET_ROLES = ['SUPERVISOR', 'OWNER'] as const;

// Printable ASCII, no spaces. Real formats are checked by the provider itself.
const AI_KEY_RE = /^[\x21-\x7E]{20,300}$/;
const GREEN_INSTANCE_RE = /^\d{4,15}$/;
const GREEN_TOKEN_RE = /^[A-Za-z0-9]{20,120}$/;

/**
 * Secrets never leave this module in a response, log line or error message:
 *  - GET returns booleans only, never a value (not even the Green instance id);
 *  - PUT/POST answer with fixed error codes;
 *  - the test action sends no message and reports only the instance state.
 */
export async function integrationsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /settings/integrations ───────────────────────────────────────────
  fastify.get(
    '/settings/integrations',
    { config: { allowedRoles: READ_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });
      try {
        const status = await getIntegrationStatus(fastify.pg, tenantId);
        if (!status) return reply.status(404).send({ error: 'Tenant not found' });
        return reply.send(status);
      } catch (err: unknown) {
        request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'settings/integrations: read failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── PUT /settings/integrations ───────────────────────────────────────────
  // Body: ai_key?, green_instance_id?, green_token?  (all optional)
  //   omitted  → unchanged     ""  → cleared     value → replaced
  // Phone and the digest on/off switch live on PUT /digest/settings (MANAGER+).
  fastify.put<{ Body: IntegrationInput }>(
    '/settings/integrations',
    { config: { allowedRoles: SECRET_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });

      const body = request.body ?? {};
      const input: IntegrationInput = {};

      const take = (field: keyof IntegrationInput, re: RegExp): string | null => {
        const raw = body[field];
        if (raw === undefined) return null;
        if (typeof raw !== 'string') return `${field} must be a string`;
        const v = raw.trim();
        if (v !== '' && !re.test(v)) return `${field} has an invalid format`;
        input[field] = v;
        return null;
      };
      const problem =
        take('ai_key', AI_KEY_RE) ?? take('green_instance_id', GREEN_INSTANCE_RE) ?? take('green_token', GREEN_TOKEN_RE);
      if (problem) return reply.status(400).send({ error: problem });
      if (Object.keys(input).length === 0) return reply.status(400).send({ error: 'nothing to update' });

      // Saving a secret needs the encryption key. There is no fallback key.
      if (inputNeedsEncryption(input) && !isEncryptionConfigured()) {
        return reply.status(503).send({ error: 'credentials_encryption_not_configured' });
      }

      try {
        const exists = await getIntegrationStatus(fastify.pg, tenantId);
        if (!exists) return reply.status(404).send({ error: 'Tenant not found' });

        await saveIntegrations(fastify.pg, tenantId, request.auth?.staff_id, input);
        // Field names only. Values are never logged.
        request.log.info({ tenantId, staffId: request.auth?.staff_id, fields: Object.keys(input) },
          'settings/integrations: credentials updated');
        const status = await getIntegrationStatus(fastify.pg, tenantId);
        return reply.send(status);
      } catch (err: unknown) {
        request.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'settings/integrations: update failed');
        return reply.status(500).send({ error: 'Internal error' });
      }
    },
  );

  // ── POST /settings/integrations/test-green ───────────────────────────────
  // Calls ONLY getStateInstance. Sends no message.
  fastify.post(
    '/settings/integrations/test-green',
    { config: { allowedRoles: SECRET_ROLES } },
    async (request, reply) => {
      const tenantId = request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant claim missing from token' });

      let instanceId: string | undefined;
      let apiToken: string | undefined;
      let source: 'tenant' | 'shared' = 'shared';
      try {
        const own = await loadTenantGreenCreds(fastify.pg, tenantId);
        if (own) { instanceId = own.instanceId; apiToken = own.apiToken; source = 'tenant'; }
      } catch {
        return reply.send({ ok: false, reason: 'credentials_unreadable' });
      }
      if (!instanceId || !apiToken) {
        instanceId = process.env['GREENAPI_INSTANCE_ID'];
        apiToken = process.env['GREENAPI_API_TOKEN'];
      }
      if (!instanceId || !apiToken) return reply.send({ ok: false, reason: 'not_configured' });

      try {
        const res = await fetch(
          `https://api.green-api.com/waInstance${encodeURIComponent(instanceId)}/getStateInstance/${encodeURIComponent(apiToken)}`,
          { method: 'GET', signal: AbortSignal.timeout(10_000) },
        );
        if (!res.ok) return reply.send({ ok: false, reason: `http_${res.status}`, source });
        const data = (await res.json().catch(() => ({}))) as { stateInstance?: string };
        const state = typeof data.stateInstance === 'string'
          ? scrubSecrets(data.stateInstance, [instanceId, apiToken]) : null;
        return reply.send({ ok: state === 'authorized', state, source });
      } catch {
        // No error text: a fetch error message could contain the request URL (and so the token).
        return reply.send({ ok: false, reason: 'unreachable', source });
      }
    },
  );
}
