/** Validation shared by every public form that creates a lead (POST /api/leads and POST /api/demo-request). */

import { cleanLabel } from './public-guard'

export const ALLOWED_BUSINESS_TYPES = [
  'bakery', 'cafe', 'restaurant', 'grocery', 'beauty', 'fashion',
  'pharmacy', 'vegetables', 'general', 'multi', 'other',
]

export interface LeadInput { storeName: string; phone: string; businessType: string; city: string; locale: string }

export function validateLeadInput(body: unknown): { valid: true; data: LeadInput } | { valid: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { valid: false, error: 'Invalid payload' }
  const b = body as Record<string, unknown>

  // Text that is echoed into WhatsApp messages: no links, handles or markup (see lib/public-guard.ts)
  const storeName = cleanLabel(b.storeName, 2, 100)
  if (storeName === null) return { valid: false, error: 'storeName must be 2-100 characters, without links or special symbols' }

  const phone = typeof b.phone === 'string' ? b.phone.replace(/\s/g, '') : ''
  if (!/^0[5-7]\d{8}$/.test(phone)) {
    return { valid: false, error: 'phone must be a valid Moroccan mobile number (06/07XXXXXXXX)' }
  }

  const businessType = typeof b.businessType === 'string' ? b.businessType.trim() : ''
  if (businessType && !ALLOWED_BUSINESS_TYPES.includes(businessType)) {
    return { valid: false, error: 'businessType must be one of: ' + ALLOWED_BUSINESS_TYPES.join(', ') }
  }

  let city = ''
  if (b.city !== undefined && b.city !== null && b.city !== '') {
    const c = cleanLabel(b.city, 2, 100)
    if (c === null) return { valid: false, error: 'city must be 2-100 characters, without links or special symbols' }
    city = c
  }

  const locale = typeof b.locale === 'string' && ['ar', 'fr', 'en'].includes(b.locale) ? b.locale : 'fr'
  return { valid: true, data: { storeName, phone, businessType, city, locale } }
}
