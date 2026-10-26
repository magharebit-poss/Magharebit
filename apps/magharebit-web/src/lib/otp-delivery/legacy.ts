/** The providers used before Infobip: Green API (WhatsApp) and Twilio (SMS). Behaviour unchanged. */

import type { OtpDeliveryProvider, OtpDeliveryRequest, OtpDeliveryResult } from './types';
import { smsOtpText, whatsappOtpText } from './messages';
import { sendWhatsAppMessage } from '../whatsapp';

export const greenApiProvider: OtpDeliveryProvider = {
  name: 'green-api',
  channels: ['whatsapp'],
  isConfigured: () => !!(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_API_TOKEN),
  async send(req: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    const r = await sendWhatsAppMessage({ to: req.phone, message: whatsappOtpText(req.code, req.locale) });
    return r.success ? { success: true, messageId: r.messageId } : { success: false, error: 'green_api_send_failed' };
  },
};

export const twilioProvider: OtpDeliveryProvider = {
  name: 'twilio',
  channels: ['sms'],
  isConfigured(): boolean {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    return !!(sid && sid !== 'REPLACE_AFTER_ROTATION' && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
  },
  async send(req: OtpDeliveryRequest): Promise<OtpDeliveryResult> {
    if (!this.isConfigured()) return { success: false, error: 'twilio_not_configured' };
    const sid = process.env.TWILIO_ACCOUNT_SID as string;
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `+${req.phone}`, From: process.env.TWILIO_FROM_NUMBER as string, Body: smsOtpText(req.code, req.locale) }),
      });
      if (!res.ok) return { success: false, error: 'twilio_send_failed' };
      const j = (await res.json().catch(() => ({}))) as { sid?: string };
      return { success: true, messageId: j.sid };
    } catch {
      return { success: false, error: 'twilio_network_error' };
    }
  },
};
