// green-api.ts — Green API WhatsApp provider
// To swap to Meta Cloud API:
//   1. Create meta-cloud-api.ts implementing WhatsAppProvider
//   2. Change getWhatsAppProvider() in provider-factory.ts to return it
//   3. Set WHATSAPP_PROVIDER=meta in .env
//   No other files change.

import type { WhatsAppMessage, WhatsAppProvider, WhatsAppSendResult } from './provider.js';

interface GreenApiSendResponse {
  idMessage?: string;
}

/** A tenant's own Green API credentials. Absent → the shared environment ones. */
export interface GreenApiCredentials {
  instanceId: string;
  apiToken: string;
}

export class GreenApiProvider implements WhatsAppProvider {
  readonly name = 'green-api';

  // One provider instance per send, never shared across tenants.
  constructor(private readonly creds?: GreenApiCredentials) {}

  async send(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const instanceId = this.creds?.instanceId ?? process.env['GREENAPI_INSTANCE_ID'];
    const apiToken   = this.creds?.apiToken   ?? process.env['GREENAPI_API_TOKEN'];
    // The token is part of the request URL, so scrub it from anything we return.
    const scrub = (text: string): string =>
      [instanceId, apiToken].reduce<string>(
        (t, s) => (s && s.length >= 4 ? t.split(s).join('[REDACTED]') : t), text);

    if (!instanceId || !apiToken) {
      console.warn('[green-api] GREENAPI_INSTANCE_ID or GREENAPI_API_TOKEN not set — skipping send');
      return { success: false, error: 'green-api not configured' };
    }

    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${message.to}@c.us`,
          message: message.body,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => `HTTP ${res.status}`);
        return { success: false, error: scrub(`green-api HTTP ${res.status}: ${detail}`) };
      }

      const data = (await res.json()) as GreenApiSendResponse;
      if (!data.idMessage) {
        return { success: false, error: 'green-api: response missing idMessage' };
      }

      return { success: true, messageId: data.idMessage };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      return { success: false, error: scrub(`green-api fetch error: ${msg}`) };
    }
  }
}
