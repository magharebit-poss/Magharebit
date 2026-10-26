/**
 * Infobip delivery (https://portal.infobip.com): SMS and WhatsApp.
 *
 * SCAFFOLD: written from Infobip's public API reference and covered by a mock-server test
 * (scripts/e2e/otp-delivery-unit.mjs), but NOT yet run against a live account. Before go-live:
 *  1. Create an API key and copy your personal base URL from the portal (Developer tools).
 *  2. SMS: register the sender (alphanumeric sender IDs for Morocco need operator registration).
 *  3. WhatsApp: connect a sender and get an AUTHENTICATION template approved (one-time code in the body
 *     plus a "copy code" button) in ar, fr and en. Names and languages go in the env vars below.
 *  4. Send one real SMS and one WhatsApp message to your own phone, then run `node scripts/e2e/otp-delivery-unit.mjs`.
 *
 * Environment (server-only):
 *   INFOBIP_BASE_URL            e.g. xxxxx.api.infobip.com  (https:// is added if missing)
 *   INFOBIP_API_KEY             sent as "Authorization: App <key>"
 *   INFOBIP_SMS_SENDER          SMS sender ID or number
 *   INFOBIP_WHATSAPP_SENDER     WhatsApp sender number (international format, digits)
 *   INFOBIP_WHATSAPP_TEMPLATE   approved authentication template name (default "mgh_otp")
 *   INFOBIP_TIMEOUT_MS          optional, default 8000
 */

import type { OtpChannel, OtpDeliveryProvider, OtpDeliveryRequest, OtpDeliveryResult } from './types';
import { smsOtpText } from './messages';

const DEFAULT_TEMPLATE = 'mgh_otp';

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function infobipBaseUrl(): string {
  const raw = env('INFOBIP_BASE_URL').replace(/\/+$/, '');
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

interface InfobipMessageStatus { groupId?: number; groupName?: string; name?: string; description?: string }
interface InfobipSendResponse {
  messages?: { messageId?: string; status?: InfobipMessageStatus }[];
  requestError?: { serviceException?: { messageId?: string; text?: string } };
}

/** Infobip status groups: 1 PENDING, 2 UNDELIVERABLE, 3 DELIVERED, 4 EXPIRED, 5 REJECTED. */
function acceptedStatus(s: InfobipMessageStatus | undefined): boolean {
  return !s || s.groupId === 1 || s.groupId === 3;
}

async function post(path: string, body: unknown): Promise<{ status: number; json: InfobipSendResponse | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(env('INFOBIP_TIMEOUT_MS')) || 8000);
  try {
    const res = await fetch(`${infobipBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `App ${env('INFOBIP_API_KEY')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => null)) as InfobipSendResponse | null;
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function failure(status: number, json: InfobipSendResponse | null): OtpDeliveryResult {
  if (status === 401 || status === 403) return { success: false, error: 'infobip_unauthorized' };
  if (status === 429) return { success: false, error: 'infobip_rate_limited' };
  if (status >= 500) return { success: false, error: 'infobip_unavailable' };
  const status0 = json?.messages?.[0]?.status;
  if (status0 && !acceptedStatus(status0)) return { success: false, error: `infobip_${(status0.groupName ?? 'rejected').toLowerCase()}` };
  return { success: false, error: 'infobip_bad_request' };
}

async function sendSms(req: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
  const { status, json } = await post('/sms/2/text/advanced', {
    messages: [{
      destinations: [{ to: req.phone }],
      from: env('INFOBIP_SMS_SENDER'),
      text: smsOtpText(req.code, req.locale),
    }],
  });
  const m = json?.messages?.[0];
  if (status >= 200 && status < 300 && m && acceptedStatus(m.status)) return { success: true, messageId: m.messageId };
  return failure(status, json);
}

async function sendWhatsapp(req: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
  const { status, json } = await post('/whatsapp/1/message/template', {
    messages: [{
      from: env('INFOBIP_WHATSAPP_SENDER'),
      to: req.phone,
      content: {
        templateName: env('INFOBIP_WHATSAPP_TEMPLATE') || DEFAULT_TEMPLATE,
        // Authentication template: the code fills {{1}} in the body and the copy-code button.
        templateData: { body: { placeholders: [req.code] }, buttons: [{ type: 'URL', parameter: req.code }] },
        language: req.locale,
      },
    }],
  });
  const m = json?.messages?.[0];
  if (status >= 200 && status < 300 && m && acceptedStatus(m.status)) return { success: true, messageId: m.messageId };
  return failure(status, json);
}

export const infobipProvider: OtpDeliveryProvider = {
  name: 'infobip',
  channels: ['sms', 'whatsapp'],
  isConfigured(): boolean {
    return !!(infobipBaseUrl() && env('INFOBIP_API_KEY'));
  },
  async send(req: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    const channel: OtpChannel = req.channel;
    if (!this.isConfigured()) return { success: false, error: 'infobip_not_configured' };
    if (channel === 'sms' && !env('INFOBIP_SMS_SENDER')) return { success: false, error: 'infobip_sms_sender_missing' };
    if (channel === 'whatsapp' && !env('INFOBIP_WHATSAPP_SENDER')) return { success: false, error: 'infobip_whatsapp_sender_missing' };
    try {
      return channel === 'sms' ? await sendSms(req) : await sendWhatsapp(req);
    } catch (e) {
      return { success: false, error: (e as { name?: string })?.name === 'AbortError' ? 'infobip_timeout' : 'infobip_network_error' };
    }
  },
};
