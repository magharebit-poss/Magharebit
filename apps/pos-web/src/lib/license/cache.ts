export interface LicenseCache {
  key:           string;
  machineId:     string;
  validatedAt:   number;   // Unix ms
  daysRemaining: number;
  plan:          string;
  features:      string[]; // active feature flags
  revoked:       boolean;
}

const CACHE_KEY   = 'mgh_license_v1';
const GRACE_HOURS = 72;

export function saveLicense(cache: LicenseCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full — ignore */ }
}

export function loadLicense(): LicenseCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LicenseCache;
  } catch { return null; }
}

export function clearLicense(): void {
  localStorage.removeItem(CACHE_KEY);
}

export type LicenseStatus =
  | 'valid'    // cache fresh, all good
  | 'grace'    // cache older than GRACE_HOURS, needs online recheck but allowed
  | 'expired'  // daysRemaining exhausted
  | 'revoked'  // backend said revoked
  | 'none';    // no cache at all

export function getLicenseStatus(): LicenseStatus {
  const cache = loadLicense();
  if (!cache) return 'none';
  if (cache.revoked) return 'revoked';

  const hoursElapsed = (Date.now() - cache.validatedAt) / 3_600_000;
  const daysElapsed = hoursElapsed / 24;

  if (daysElapsed >= cache.daysRemaining) return 'expired';
  if (hoursElapsed >= GRACE_HOURS) return 'grace';
  return 'valid';
}

export function getDaysRemaining(): number {
  const cache = loadLicense();
  if (!cache) return 0;
  const daysElapsed = (Date.now() - cache.validatedAt) / 86_400_000;
  return Math.max(0, Math.floor(cache.daysRemaining - daysElapsed));
}
