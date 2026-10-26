/** How a one-time code reaches the merchant. Providers only deliver; codes are generated, hashed and checked by our own OTP routes. */

export type OtpChannel = 'whatsapp' | 'sms';
export type OtpLocale = 'ar' | 'fr' | 'en';

export interface OtpDeliveryRequest {
  channel: OtpChannel;
  /** Digits only, international format without "+": 2126XXXXXXXX. */
  phone: string;
  /** The plain code. It is never stored or logged here. */
  code: string;
  locale: OtpLocale;
}

export interface OtpDeliveryResult {
  success: boolean;
  /** Provider message id, for support and delivery reports. */
  messageId?: string;
  /** Short machine reason when success is false (never contains the code or credentials). */
  error?: string;
}

export interface OtpDeliveryProvider {
  readonly name: 'infobip' | 'twilio' | 'green-api';
  readonly channels: readonly OtpChannel[];
  /** True when every credential this provider needs is present. */
  isConfigured(): boolean;
  send(req: OtpDeliveryRequest): Promise<OtpDeliveryResult>;
}

export function toOtpLocale(raw: string | undefined): OtpLocale {
  return raw === 'ar' || raw === 'en' ? raw : 'fr';
}
