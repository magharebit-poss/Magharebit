// Offline verifier for MAGHAREBIT license tokens, contract v2 (EdDSA / Ed25519 JWT).
// Source of truth: GreenGo-web/apps/magharebit-web/docs/pos-license-contract.md (sections 3 and 6).
//
// Library only: not wired into ActivationGate, the cache or any storage key.
// The caller supplies the clock (`now`) and the highest trusted time, so this stays a pure
// function of its inputs. It never throws on bad input and never logs the token.
import * as noble from '@noble/ed25519';
import type { TrustedKey } from './keys';

export type LicenseV2Status =
  | 'valid'
  | 'refresh_due'      // past refreshBy, inside the 72 h grace: keep working, refresh in the background
  | 'lapsed'           // past refreshBy + 72 h: treat as unlicensed until an online refresh succeeds
  | 'expired'          // now >= exp: hard stop, no grace
  | 'not_yet_valid'
  | 'clock_rollback'   // device clock more than 24 h behind the highest trusted time
  | 'machine_mismatch'
  | 'bad_signature'    // signature fails, or the kid is not in the trusted set
  | 'bad_format';      // structure, alg/typ, iss, aud, schema or a claim type is wrong

export interface LicenseClaims {
  iss: string;
  aud: string;
  sub: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
  refreshBy: number;
  schema: number;
  plan: string;
  trial: boolean;
  maxRegisters: number;
  maxBranches: number;
  features: string[];
  machineId: string;
}

export type Ed25519Verify = (publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array) => Promise<boolean>;

export interface VerifyOptions {
  /** Trusted public keys (see keys.ts). A kid that is not here is an error, never a fallback. */
  keys: readonly TrustedKey[];
  /** Current time, Unix seconds. Injected so tests control the clock. */
  now: number;
  expectedAud: string;
  /** The local terminal id; a token issued to another terminal is rejected. */
  machineId: string;
  /** Highest trusted time seen so far (Unix seconds), for the rollback guard. */
  highestTrustedTime?: number;
  /** Issuer to require. Defaults to the contract value. */
  expectedIss?: string;
  /** Override the Ed25519 implementation (tests). Defaults to Web Crypto with a noble fallback. */
  verifyEd25519?: Ed25519Verify;
}

export interface VerifyResult {
  status: LicenseV2Status;
  /** Present only when the signature verified, so these claims can be trusted for display and limits. */
  claims: LicenseClaims | null;
  /** Short machine-readable detail. Never contains the token. */
  reason: string;
}

export const LICENSE_ISSUER = 'https://magharebit.com';
export const NBF_SKEW_SECONDS = 300;
export const ROLLBACK_TOLERANCE_SECONDS = 24 * 3600;
export const REFRESH_GRACE_SECONDS = 72 * 3600;

const MAX_TOKEN_LENGTH = 8192;
const B64URL = /^[A-Za-z0-9_-]+$/;

// ── Ed25519 ────────────────────────────────────────────────────────────────

/** Web Crypto Ed25519. Throws when the runtime has no Ed25519 support (old WebView). */
export async function verifyEd25519WebCrypto(publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  // Copies give ArrayBuffer-backed views, which is what the BufferSource type requires.
  const key = await crypto.subtle.importKey('raw', new Uint8Array(publicKey), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, key, new Uint8Array(signature), new Uint8Array(data));
}

/** Audited pure-JS fallback. Strict (RFC 8032) verification to match Web Crypto. */
export async function verifyEd25519Noble(publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  return noble.verifyAsync(signature, data, publicKey, { zip215: false });
}

/**
 * Web Crypto first. Only when the runtime cannot import an Ed25519 key (no support) does it fall
 * back to noble. A Web Crypto answer of "false" is final: a bad signature never gets a second try.
 */
export async function verifyEd25519Auto(publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array): Promise<boolean> {
  try {
    return await verifyEd25519WebCrypto(publicKey, signature, data);
  } catch {
    // No Ed25519 in this runtime (or no crypto.subtle): use the pure-JS implementation.
    return verifyEd25519Noble(publicKey, signature, data);
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function b64urlToBytes(s: string): Uint8Array | null {
  if (!s || !B64URL.test(s) || s.length % 4 === 1) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function parseJsonObject(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function toClaims(p: Record<string, unknown>): LicenseClaims | null {
  const { iss, aud, sub, jti, iat, nbf, exp, refreshBy, schema, plan, trial, maxRegisters, maxBranches, features, machineId } = p;
  if (!isStr(iss) || !isStr(aud) || !isStr(sub) || !isStr(jti) || !isStr(plan) || !isStr(machineId)) return null;
  if (!isInt(iat) || !isInt(nbf) || !isInt(exp) || !isInt(refreshBy) || !isInt(schema)) return null;
  if (!isInt(maxRegisters) || maxRegisters < 0 || !isInt(maxBranches) || maxBranches < 0) return null;
  if (typeof trial !== 'boolean') return null;
  if (!Array.isArray(features) || !features.every((f) => typeof f === 'string')) return null;
  return { iss, aud, sub, jti, iat, nbf, exp, refreshBy, schema, plan, trial, maxRegisters, maxBranches, features: features as string[], machineId };
}

const fail = (status: LicenseV2Status, reason: string): VerifyResult => ({ status, claims: null, reason });

// ── verifier ───────────────────────────────────────────────────────────────

export async function verifyLicenseV2(token: unknown, opts: VerifyOptions): Promise<VerifyResult> {
  try {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return fail('bad_format', 'token_shape');
    const parts = token.split('.');
    if (parts.length !== 3) return fail('bad_format', 'token_shape');
    const [h64, p64, s64] = parts as [string, string, string];

    // Header: only EdDSA / JWT. `none`, HS256 and anything else is rejected before any key is touched.
    const headerBytes = b64urlToBytes(h64);
    const header = headerBytes ? parseJsonObject(headerBytes) : null;
    if (!header) return fail('bad_format', 'header');
    if (header['alg'] !== 'EdDSA') return fail('bad_format', 'alg');
    if (header['typ'] !== 'JWT') return fail('bad_format', 'typ');
    if ('crit' in header) return fail('bad_format', 'crit');
    const kid = header['kid'];
    if (typeof kid !== 'string' || kid.length === 0 || kid.length > 64) return fail('bad_format', 'kid');

    // Key by kid from the trusted set. No fallback to another key.
    const trusted = opts.keys.find((k) => k.kid === kid);
    if (!trusted) return fail('bad_signature', 'unknown_kid');
    const publicKey = b64urlToBytes(trusted.x);
    if (!publicKey || publicKey.length !== 32) return fail('bad_signature', 'bad_trusted_key');

    // Signature over the exact signing input, BEFORE any claim is read.
    const signature = b64urlToBytes(s64);
    if (!signature || signature.length !== 64) return fail('bad_signature', 'signature_shape');
    const signingInput = new TextEncoder().encode(`${h64}.${p64}`);
    let signatureOk = false;
    try {
      signatureOk = await (opts.verifyEd25519 ?? verifyEd25519Auto)(publicKey, signature, signingInput);
    } catch {
      signatureOk = false;
    }
    if (!signatureOk) return fail('bad_signature', 'signature');

    // From here on the payload is authentic.
    const payloadBytes = b64urlToBytes(p64);
    const payload = payloadBytes ? parseJsonObject(payloadBytes) : null;
    const claims = payload ? toClaims(payload) : null;
    if (!claims) return fail('bad_format', 'claims');
    if (claims.iss !== (opts.expectedIss ?? LICENSE_ISSUER)) return fail('bad_format', 'iss');
    if (claims.aud !== opts.expectedAud) return fail('bad_format', 'aud');
    if (claims.schema !== 2) return fail('bad_format', 'schema');

    const result = (status: LicenseV2Status, reason: string): VerifyResult => ({ status, claims, reason });

    if (claims.machineId !== opts.machineId) return result('machine_mismatch', 'machine_id');

    const { now } = opts;
    if (!Number.isFinite(now)) return fail('bad_format', 'now');

    // Rollback guard first: a clock that is behind must not extend any validity.
    if (opts.highestTrustedTime !== undefined && now < opts.highestTrustedTime - ROLLBACK_TOLERANCE_SECONDS) {
      return result('clock_rollback', 'clock_behind_trusted_time');
    }
    if (now < claims.nbf - NBF_SKEW_SECONDS) return result('not_yet_valid', 'nbf');
    if (now >= claims.exp) return result('expired', 'exp');
    if (now > claims.refreshBy + REFRESH_GRACE_SECONDS) return result('lapsed', 'refresh_overdue');
    if (now > claims.refreshBy) return result('refresh_due', 'refresh_window');
    return result('valid', 'ok');
  } catch {
    return fail('bad_format', 'internal');
  }
}
