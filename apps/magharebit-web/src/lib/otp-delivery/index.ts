/**
 * One-time code delivery. Routes call deliverOtp(); the provider per channel comes from the environment:
 *
 *   OTP_WHATSAPP_PROVIDER = green-api (default) | infobip
 *   OTP_SMS_PROVIDER      = twilio (default)     | infobip
 *
 * Nothing changes until those variables are set, so Infobip can be configured and tested first, then switched on.
 */

import type { OtpChannel, OtpDeliveryProvider, OtpDeliveryRequest, OtpDeliveryResult } from './types';
import { infobipProvider } from './infobip';
import { greenApiProvider, twilioProvider } from './legacy';

export type { OtpChannel, OtpDeliveryRequest, OtpDeliveryResult, OtpLocale } from './types';
export { toOtpLocale } from './types';

const PROVIDERS: Record<string, OtpDeliveryProvider> = {
  infobip: infobipProvider,
  twilio: twilioProvider,
  'green-api': greenApiProvider,
};

export function providerFor(channel: OtpChannel): OtpDeliveryProvider {
  const wanted = (process.env[channel === 'sms' ? 'OTP_SMS_PROVIDER' : 'OTP_WHATSAPP_PROVIDER'] ?? '').trim().toLowerCase();
  const fallback = channel === 'sms' ? 'twilio' : 'green-api';
  const p = PROVIDERS[wanted] ?? PROVIDERS[fallback];
  // A provider that cannot carry this channel (typo or wrong variable) falls back rather than failing silently.
  return p.channels.includes(channel) ? p : PROVIDERS[fallback];
}

export async function deliverOtp(req: OtpDeliveryRequest): Promise<OtpDeliveryResult & { provider: string }> {
  const provider = providerFor(req.channel);
  if (!provider.isConfigured()) return { success: false, error: `${provider.name}_not_configured`, provider: provider.name };
  const r = await provider.send(req);
  return { ...r, provider: provider.name };
}
