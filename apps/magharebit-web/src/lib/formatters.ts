// Moroccan-aware number, currency, and date formatters.
//
// IMPORTANT — Western Arabic numerals (0-9) everywhere.
// Eastern Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) are NOT used per technical
// owner decision. The only locale-specific changes are the currency symbol
// (د.م. for ar, DH for fr/en) and thousands-separator style.
//
// Always format numbers with 'fr-MA' locale so we get Western digits with
// Moroccan thousands-separator convention (space-separated groups).

export type Locale = 'ar' | 'fr' | 'en'

export function formatCurrency(
  amount: number,
  locale: string,
  options?: { showSymbol?: boolean; decimals?: number }
): string {
  const showSymbol = options?.showSymbol ?? true
  const decimals = options?.decimals ?? 0

  // Always Western numerals — fr-MA gives "1 249" style spacing
  const formatted = new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 0 ? decimals : 2,
    useGrouping: true,
  }).format(amount)

  if (!showSymbol) return formatted

  // Currency symbol per locale; numerals remain Western in all cases
  const symbol = locale === 'ar' ? 'د.م.' : 'DH'
  return `${formatted} ${symbol}`
}

// Format a price for display in POS mockup tiles and inline amounts.
// Output: "12 DH" (fr/en) or "12 د.م." (ar) — always Western numerals.
export function formatPrice(price: string | number, locale: string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  return formatCurrency(num, locale)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDate(date: Date, locale: string): string {
  // Use fr-MA for all locales so date digits stay Western
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatNumber(value: number, _locale: string): string {
  // Always Western digits with fr-MA grouping
  return new Intl.NumberFormat('fr-MA', { useGrouping: true }).format(value)
}

// toArabicNumerals — now a pass-through.
// Kept for backward compatibility with existing call sites (HeroSection,
// ProofBar) that would otherwise need churn. With Western-numerals policy
// these calls are no-ops but the code compiles without changes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function toArabicNumerals(value: string | number, _locale: string): string {
  return String(value)
}

// Locale-aware currency symbol only (no amount).
export function currencySymbol(locale: string): string {
  if (locale === 'ar') return 'د.م.'
  if (locale === 'en') return 'DH'
  return 'DH'
}

// Format a percentage with Western digits.
// "+18 %" (fr), "+18%" (en/ar)
export function formatPercent(value: number, locale: string, signed = false): string {
  const sign = signed && value > 0 ? '+' : ''
  if (locale === 'fr') return `${sign}${value} %`
  return `${sign}${value}%`
}
