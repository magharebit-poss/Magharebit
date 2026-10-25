/**
 * Encryption of per-tenant integration secrets (AES-256-GCM).
 *
 * - The key comes ONLY from CREDENTIALS_ENCRYPTION_KEY (32 bytes, base64).
 *   There is no fallback key: if it is missing or the wrong length, every
 *   encrypt/decrypt call throws CredentialsKeyError.
 * - A fresh random 12-byte IV is generated for every value.
 * - Stored layout: [1 byte format version][12 byte IV][16 byte tag][ciphertext].
 * - The ciphertext is bound to (tenantId, field) as additional authenticated
 *   data, so a value moved to another tenant's row or another column cannot be
 *   decrypted (the auth tag check fails).
 *
 * Plaintext secrets must never be logged, returned in a response or put in an
 * error message. Errors thrown here carry fixed messages only.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type SecretField = 'ai_key' | 'green_token';

const FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 1 + IV_LENGTH + TAG_LENGTH;

/** The encryption key is missing or malformed (a server configuration problem). */
export class CredentialsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialsKeyError';
  }
}

/** A stored value could not be decrypted (wrong key, tampering, or wrong tenant/field). */
export class CredentialsUnreadableError extends Error {
  constructor() {
    super('stored credential could not be decrypted');
    this.name = 'CredentialsUnreadableError';
  }
}

export function isEncryptionConfigured(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

function loadKey(): Buffer {
  const raw = process.env['CREDENTIALS_ENCRYPTION_KEY'];
  if (!raw || raw.trim() === '') {
    throw new CredentialsKeyError('CREDENTIALS_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) {
    throw new CredentialsKeyError('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

function aad(tenantId: string, field: SecretField): Buffer {
  return Buffer.from(`${tenantId}:${field}`, 'utf8');
}

export function encryptSecret(plain: string, tenantId: string, field: SecretField): Buffer {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(tenantId, field));
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.of(FORMAT_VERSION), iv, tag, ciphertext]);
}

export function decryptSecret(stored: Buffer, tenantId: string, field: SecretField): string {
  const key = loadKey();
  if (stored.length <= HEADER_LENGTH || stored[0] !== FORMAT_VERSION) {
    throw new CredentialsUnreadableError();
  }
  const iv = stored.subarray(1, 1 + IV_LENGTH);
  const tag = stored.subarray(1 + IV_LENGTH, HEADER_LENGTH);
  const ciphertext = stored.subarray(HEADER_LENGTH);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad(tenantId, field));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Never surface Node's message: it is not secret, but callers must see one fixed error.
    throw new CredentialsUnreadableError();
  }
}

/** Replace any occurrence of the given secrets in a text (used on error strings). */
export function scrubSecrets(text: string, secrets: Array<string | null | undefined>): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 4) out = out.split(s).join('[REDACTED]');
  }
  return out;
}
