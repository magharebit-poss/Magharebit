/**
 * License verification + caching for the GreenGo logiciel.
 *
 * Key generation is performed exclusively by the website backend. This module
 * contains ONLY verification (against the remote validation API) and caching
 * logic — it never generates or signs keys.
 *
 * All sensitive config (validator URL, x-api-key, license key) is injected via
 * environment variables. No secrets are stored in source. The full license key
 * and the validator API key are NEVER logged — only the key's last 4 chars.
 */

import { getOrCreateDeviceId, isDeviceIdPersisted } from './device-id.js';

// ── Public types ──────────────────────────────────────────────────────────
export type LicensePlan = 'starter' | 'business' | 'enterprise';
export type LicenseStatus =
  | 'active'
  | 'expired'
  | 'revoked'
  | 'pending'
  | 'device_conflict';

export interface LicenseValidationResult {
  valid: boolean;
  status: LicenseStatus;
  plan?: LicensePlan;
  expiresAt?: Date;
  graceUntil?: Date;
  maxRegisters?: number;
  maxBranches?: number;
  features?: string[];
  merchantName?: string;
  boundDeviceId?: string | null;
  error?: string;
}

export interface CachedLicense {
  result: LicenseValidationResult;
  cachedAt: Date;
  key: string; // last 4 chars only, for logging
}

// ── Module state ────────────────────────────────────────────────────────────
const cache = new Map<string, CachedLicense>();
let graceModeActive = false;
let revalidationTimer: ReturnType<typeof setInterval> | null = null;

// ── Config helpers (read at call time, never hardcoded) ─────────────────────
function cacheTtlMs(): number {
  const hours = Number(process.env['LICENSE_CACHE_TTL_HOURS'] ?? 24);
  return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3_600_000;
}
function graceMs(): number {
  const hours = Number(process.env['LICENSE_GRACE_HOURS'] ?? 168);
  return (Number.isFinite(hours) && hours > 0 ? hours : 168) * 3_600_000;
}
function last4(key: string): string {
  return key.length <= 4 ? key : key.slice(-4);
}
function resolveDeviceId(): string {
  // File-based id takes precedence; env var is a fallback when the filesystem
  // is not writable (so the id would otherwise be ephemeral across restarts).
  const fileId = getOrCreateDeviceId();
  if (isDeviceIdPersisted()) return fileId;
  const envId = process.env['LICENSE_DEVICE_ID']?.trim();
  return envId && envId.length > 0 ? envId : fileId;
}

// ── Response mapping (defensive: accept snake_case or camelCase) ────────────
interface RawValidationResponse {
  valid?: boolean;
  status?: string;
  plan?: string;
  expires_at?: string; expiresAt?: string;
  grace_until?: string; graceUntil?: string;
  max_registers?: number; maxRegisters?: number;
  max_branches?: number; maxBranches?: number;
  features?: string[];
  merchant_name?: string; merchantName?: string;
  bound_device_id?: string | null; boundDeviceId?: string | null;
  error?: string;
}

const VALID_STATUSES: LicenseStatus[] = [
  'active', 'expired', 'revoked', 'pending', 'device_conflict',
];

function toDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function mapResponse(raw: RawValidationResponse): LicenseValidationResult {
  const statusRaw = (raw.status ?? (raw.valid ? 'active' : 'pending')) as LicenseStatus;
  const status: LicenseStatus = VALID_STATUSES.includes(statusRaw) ? statusRaw : 'pending';
  return {
    valid: raw.valid === true,
    status,
    plan: raw.plan as LicensePlan | undefined,
    expiresAt: toDate(raw.expires_at ?? raw.expiresAt),
    graceUntil: toDate(raw.grace_until ?? raw.graceUntil),
    maxRegisters: raw.max_registers ?? raw.maxRegisters,
    maxBranches: raw.max_branches ?? raw.maxBranches,
    features: Array.isArray(raw.features) ? raw.features : undefined,
    merchantName: raw.merchant_name ?? raw.merchantName,
    boundDeviceId: raw.bound_device_id ?? raw.boundDeviceId ?? null,
  };
}

// ── Grace handling when the network is unreachable ──────────────────────────
function graceDecision(key: string, cached: CachedLicense | undefined): LicenseValidationResult {
  if (cached) {
    const age = Date.now() - cached.cachedAt.getTime();
    if (age <= graceMs()) {
      graceModeActive = true;
      console.warn(
        `[license] validator unreachable; operating on cached result in grace mode (key …${last4(key)}, age ${Math.round(age / 3_600_000)}h)`,
      );
      return cached.result;
    }
    return {
      valid: false,
      status: 'expired',
      error: 'license_cache_stale_grace_exceeded',
    };
  }
  // No cache to fall back on.
  return {
    valid: false,
    status: 'pending',
    error: 'license_unreachable_no_cache',
  };
}

// ── Network validation ──────────────────────────────────────────────────────
async function networkValidate(key: string): Promise<LicenseValidationResult> {
  const url = process.env['LICENSE_VALIDATOR_URL'];
  const apiKey = process.env['LICENSE_VALIDATOR_KEY'];
  const cached = cache.get(key);

  if (!url || !apiKey) {
    console.error('[license] LICENSE_VALIDATOR_URL / LICENSE_VALIDATOR_KEY not configured');
    return graceDecision(key, cached);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        key,
        device_id: resolveDeviceId(),
        device_name: 'GreenGo POS Backend',
        app_version: process.env['APP_LATEST_VERSION'] ?? 'unknown',
      }),
    });

    if (res.status === 200) {
      const raw = (await res.json()) as RawValidationResponse;
      const result = mapResponse(raw);
      cache.set(key, { result, cachedAt: new Date(), key: last4(key) });
      graceModeActive = false;
      return result;
    }

    if (res.status === 401) {
      // Validator rejected OUR api key — do not cache; this is a config fault.
      console.error(`[license] FATAL: validator auth failed (401) for key …${last4(key)} — check LICENSE_VALIDATOR_KEY`);
      return { valid: false, status: 'revoked', error: 'validator_auth_failed' };
    }

    if (res.status === 429) {
      // Rate limited — prefer last known result, else grace logic.
      if (cached) return cached.result;
      return graceDecision(key, cached);
    }

    // Any other HTTP status → treat as unreachable.
    console.warn(`[license] validator returned HTTP ${res.status} for key …${last4(key)}`);
    return graceDecision(key, cached);
  } catch {
    // Network failure / DNS / timeout.
    console.warn(`[license] validator network error for key …${last4(key)}`);
    return graceDecision(key, cached);
  }
}

/**
 * Validate a license key. Uses the in-memory cache when fresh, otherwise hits
 * the remote validator, falling back to grace mode if the network is down.
 */
export async function validateLicense(key: string): Promise<LicenseValidationResult> {
  const cached = cache.get(key);
  if (cached) {
    const age = Date.now() - cached.cachedAt.getTime();
    if (age <= cacheTtlMs()) {
      // Fresh cache — no network call.
      return cached.result;
    }
  }
  // Stale or absent → network (with grace fallback inside).
  return networkValidate(key);
}

/** Snapshot for the public GET /license/status endpoint (cache read only). */
export function getLicenseSnapshot(key?: string): {
  result: LicenseValidationResult | null;
  graceModeActive: boolean;
} {
  let entry: CachedLicense | undefined;
  if (key) {
    entry = cache.get(key);
  } else {
    // Most-recently-cached entry (single-tenant install has at most one).
    for (const v of cache.values()) {
      if (!entry || v.cachedAt > entry.cachedAt) entry = v;
    }
  }
  return { result: entry ? entry.result : null, graceModeActive };
}

// ── Background revalidation ─────────────────────────────────────────────────
export function startLicenseRevalidation(
  key: string,
  intervalHours?: number,
  onResult?: (result: LicenseValidationResult) => void,
): void {
  stopLicenseRevalidation();
  const ttlHours = Number(process.env['LICENSE_CACHE_TTL_HOURS'] ?? 24);
  const hours = intervalHours ?? (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) / 2;
  const intervalMs = Math.max(1, hours) * 3_600_000;
  revalidationTimer = setInterval(() => {
    void validateLicense(key)
      .then((result) => {
        if (onResult) onResult(result);
      })
      .catch(() => {
        /* errors are handled/logged inside validateLicense */
      });
  }, intervalMs);
  // Do not keep the event loop alive solely for revalidation.
  if (typeof revalidationTimer.unref === 'function') revalidationTimer.unref();
}

export function stopLicenseRevalidation(): void {
  if (revalidationTimer) {
    clearInterval(revalidationTimer);
    revalidationTimer = null;
  }
}

/**
 * DEV ONLY. Injects a mock active license into the in-memory cache so that
 * /license/status returns a coherent response and the pos-web UI does not show
 * a license error screen. Never called in production — the boot guard in
 * index.ts exits the process if LICENSE_BYPASS_DEV is set with
 * NODE_ENV=production, so this mock can never be served in production.
 *
 * Writes into the same `cache` Map that validateLicense() reads, keyed on
 * LICENSE_KEY when present (else the sentinel 'dev-bypass'), so
 * getLicenseSnapshot() returns it.
 */
export function injectMockLicense(): void {
  const mock: LicenseValidationResult = {
    valid: true,
    status: 'active',
    plan: 'business',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    graceUntil: new Date(Date.now() + 372 * 24 * 60 * 60 * 1000),
    maxRegisters: 5,
    maxBranches: 5,
    features: ['pos', 'inventory', 'reports', 'whatsapp', 'analytics'],
    merchantName: 'GreenGo Dev Store',
    boundDeviceId: null,
  };
  const cacheKey = process.env['LICENSE_KEY'] ?? 'dev-bypass';
  cache.set(cacheKey, { result: mock, cachedAt: new Date(), key: last4(cacheKey) });
  graceModeActive = false;
}
