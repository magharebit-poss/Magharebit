import type { OtpLocale } from './types';

/** WhatsApp text message (Green API / session messages). */
export function whatsappOtpText(code: string, locale: OtpLocale): string {
  return {
    ar: `🔐 رمز التحقق من MAGHAREBIT:\n\n*${code}*\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`,
    fr: `🔐 Votre code de vérification MAGHAREBIT:\n\n*${code}*\n\nValable 5 minutes. Ne le partagez pas.`,
    en: `🔐 Your MAGHAREBIT verification code:\n\n*${code}*\n\nValid for 5 minutes. Do not share it.`,
  }[locale];
}

/** SMS body. Kept short: Arabic SMS is UCS-2 (70 characters per segment). */
export function smsOtpText(code: string, locale: OtpLocale): string {
  return {
    ar: `MAGHAREBIT: رمز التحقق ${code} — صالح 5 دقائق`,
    fr: `MAGHAREBIT: Votre code est ${code} — Valable 5 min`,
    en: `MAGHAREBIT: Your code is ${code} — Valid 5 min`,
  }[locale];
}
