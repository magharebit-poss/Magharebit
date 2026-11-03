const WA_NUMBER = '212619522487'; // single source: digits for wa.me and for the backend sender default

export const BRAND = {
  contact: {
    email: 'contact@magharebit.com',
    /** The one public WhatsApp / phone number. Display form, digits-only, E.164 and wa.me link must stay in step. */
    whatsapp: '+212 619 522 487',
    waNumber: WA_NUMBER,
    phoneE164: '+212619522487',
    waLink: `https://wa.me/${WA_NUMBER}`,
  },
  company: {
    name:      'MAGHAREBIT',
    nameAr:    'المغاربيت',
    tagline:   'منصة التجزئة الذكية للمغرب',
    copyright: '© 2026 MAGHAREBIT',
    signature: 'فخر الابتكار والتطوير المغربي',
  },
} as const;

/** wa.me link to the company's WhatsApp, optionally with a prefilled message. */
export function waUrl(text?: string): string {
  return text ? `${BRAND.contact.waLink}?text=${encodeURIComponent(text)}` : BRAND.contact.waLink;
}

/**
 * Kitchen-display (KDS) claims on the site (home ecosystem tile, /features catalog). Requested by the coordinator
 * (02/11/2026) but no KDS is described anywhere else in this site, its docs or the engineering rules: confirm it
 * ships before launch, or set this to false to remove every KDS mention.
 */
export const SHOW_KDS = true;
