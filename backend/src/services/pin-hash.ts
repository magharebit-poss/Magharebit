import argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Staff PIN hashing.
 *
 * New hashes use Argon2id (memory-hard, OWASP-recommended). Legacy hashes are
 * plain SHA-256 hex (fast, brute-forceable for 4-digit PINs). `verifyPin`
 * transparently upgrades a legacy hash on the next successful login: it returns
 * `needsRehash: true` with a fresh Argon2id hash for the caller to persist.
 *
 * No secret material is stored here — Argon2id salts are embedded in the hash
 * string itself. No env configuration required; parameters are fixed below.
 */

// Argon2id parameters (fixed, not secret): 64 MiB memory, 3 iterations, 1 lane.
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

export type PinVerifyResult =
  | { matched: true; needsRehash: false }
  | { matched: true; needsRehash: true; newHash: string }
  | { matched: false; needsRehash: false };

/** Hash a PIN with Argon2id. Returns the encoded hash string ($argon2id$...). */
export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, ARGON2_OPTIONS);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Constant-time compare of two equal-length hex strings. */
function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Verify a PIN against a stored hash.
 *  - Argon2id hash ($argon2 prefix): verify with argon2 (timing-safe internally).
 *  - Legacy SHA-256 hex: verify with SHA-256; on match, also return a fresh
 *    Argon2id hash so the caller can persist the upgrade.
 */
export async function verifyPin(pin: string, hash: string): Promise<PinVerifyResult> {
  if (hash.startsWith('$argon2')) {
    let ok = false;
    try {
      ok = await argon2.verify(hash, pin);
    } catch {
      ok = false;
    }
    return ok
      ? { matched: true, needsRehash: false }
      : { matched: false, needsRehash: false };
  }

  // Legacy SHA-256 path.
  const matched = timingSafeHexEqual(sha256Hex(pin), hash);
  if (!matched) {
    return { matched: false, needsRehash: false };
  }
  const newHash = await hashPin(pin);
  return { matched: true, needsRehash: true, newHash };
}
