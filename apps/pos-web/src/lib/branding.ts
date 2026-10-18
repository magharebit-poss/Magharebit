// Merchant branding resolution for receipts and other merchant-facing surfaces.
//
// The logiciel is white-labelled: surfaces show the MERCHANT's own identity, not
// the platform brand. No merchant data is hardcoded — it comes from the license
// validation response (cached client-side) with env-var fallbacks.

export interface MerchantBranding {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null; // legacy ICE field — kept for standard receipt header
  // Moroccan DGI fiscal identifiers — used on TVA-compliant invoices.
  ice: string | null;  // Identifiant Commun de l'Entreprise
  if_: string | null;  // Identifiant Fiscal (if_ to avoid JS keyword collision)
  rc: string | null;   // Registre du Commerce
}

// sessionStorage key where page.tsx caches the /api/license/status response.
export const LICENSE_STATUS_KEY = 'greengo_license_status';

function emptyToNull(v: string | undefined | null): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve merchant branding with this precedence per field:
 *   1. The cached license status response (merchantName → .name).
 *   2. NEXT_PUBLIC_MERCHANT_* env-var fallbacks.
 *   3. null (the receipt omits that line gracefully).
 *
 * TODO: when the license validation response is extended with
 * merchantLogo / merchantAddress / merchantPhone / merchantTaxId, prefer those
 * over the env fallbacks. The precedence below already handles this
 * automatically once the license response carries the fields — read them from
 * the cached status object the same way merchantName is read here.
 */
export function getMerchantBranding(): MerchantBranding {
  let licenseName: string | null = null;
  // Future license-supplied fields (currently absent) would be read here too.
  let licenseLogo: string | null = null;
  let licenseAddress: string | null = null;
  let licensePhone: string | null = null;
  let licenseTaxId: string | null = null;
  // Fiscal identifiers — same precedence pattern: license response → env → null.
  let licenseIce: string | null = null;
  let licenseIf: string | null = null;
  let licenseRc: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(LICENSE_STATUS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          merchantName?: string;
          merchantLogo?: string;
          merchantAddress?: string;
          merchantPhone?: string;
          merchantTaxId?: string;
          merchantIce?: string;
          merchantIf?: string;
          merchantRc?: string;
        };
        licenseName = emptyToNull(s.merchantName);
        licenseLogo = emptyToNull(s.merchantLogo);
        licenseAddress = emptyToNull(s.merchantAddress);
        licensePhone = emptyToNull(s.merchantPhone);
        licenseTaxId = emptyToNull(s.merchantTaxId);
        licenseIce = emptyToNull(s.merchantIce);
        licenseIf = emptyToNull(s.merchantIf);
        licenseRc = emptyToNull(s.merchantRc);
      }
    } catch {
      // ignore malformed cache
    }
  }

  return {
    // Name must always render (it is the receipt header). License value wins;
    // 'Magharebit' is a neutral platform fallback (never the codename).
    name: licenseName ?? 'Magharebit',
    logoUrl: licenseLogo ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_LOGO_URL']),
    address: licenseAddress ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_ADDRESS']),
    phone: licensePhone ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_PHONE']),
    taxId: licenseTaxId ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_TAX_ID']),
    ice: licenseIce ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_ICE']),
    if_: licenseIf ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_IF']),
    rc: licenseRc ?? emptyToNull(process.env['NEXT_PUBLIC_MERCHANT_RC']),
  };
}
