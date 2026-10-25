import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  CredentialsKeyError,
  CredentialsUnreadableError,
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  scrubSecrets,
} from '../credentials-crypto';

const T1 = '11111111-1111-1111-1111-111111111111';
const T2 = '22222222-2222-2222-2222-222222222222';
const SECRET = 'sk-ant-test-0123456789abcdef0123456789';

let saved: string | undefined;
beforeEach(() => {
  saved = process.env['CREDENTIALS_ENCRYPTION_KEY'];
  process.env['CREDENTIALS_ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
});
afterEach(() => {
  if (saved === undefined) delete process.env['CREDENTIALS_ENCRYPTION_KEY'];
  else process.env['CREDENTIALS_ENCRYPTION_KEY'] = saved;
});

describe('credentials-crypto', () => {
  test('round trip returns the original value', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    expect(decryptSecret(enc, T1, 'ai_key')).toBe(SECRET);
  });

  test('the stored bytes do not contain the plaintext', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    expect(enc.toString('utf8')).not.toContain('sk-ant');
    expect(enc.toString('latin1')).not.toContain(SECRET);
  });

  test('a fresh random IV makes two encryptions of one value differ', () => {
    const a = encryptSecret(SECRET, T1, 'ai_key');
    const b = encryptSecret(SECRET, T1, 'ai_key');
    expect(a.equals(b)).toBe(false);
  });

  test('a value cannot be decrypted for another tenant', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    expect(() => decryptSecret(enc, T2, 'ai_key')).toThrow(CredentialsUnreadableError);
  });

  test('a value cannot be decrypted as another field', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    expect(() => decryptSecret(enc, T1, 'green_token')).toThrow(CredentialsUnreadableError);
  });

  test('tampering is detected', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    enc[enc.length - 1] = enc[enc.length - 1]! ^ 0xff;
    expect(() => decryptSecret(enc, T1, 'ai_key')).toThrow(CredentialsUnreadableError);
  });

  test('a different key cannot decrypt', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    process.env['CREDENTIALS_ENCRYPTION_KEY'] = randomBytes(32).toString('base64');
    expect(() => decryptSecret(enc, T1, 'ai_key')).toThrow(CredentialsUnreadableError);
  });

  test('missing key: encrypt and decrypt fail with a clear error, no fallback key', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    delete process.env['CREDENTIALS_ENCRYPTION_KEY'];
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret(SECRET, T1, 'ai_key')).toThrow(CredentialsKeyError);
    expect(() => decryptSecret(enc, T1, 'ai_key')).toThrow(CredentialsKeyError);
  });

  test('wrong-length key is rejected', () => {
    process.env['CREDENTIALS_ENCRYPTION_KEY'] = randomBytes(16).toString('base64');
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret(SECRET, T1, 'ai_key')).toThrow(/32 bytes/);
  });

  test('errors never contain the secret', () => {
    const enc = encryptSecret(SECRET, T1, 'ai_key');
    try { decryptSecret(enc, T2, 'ai_key'); } catch (e) {
      expect(String(e)).not.toContain(SECRET);
    }
  });

  test('scrubSecrets replaces every occurrence', () => {
    expect(scrubSecrets(`fail ${SECRET} and ${SECRET}`, [SECRET, null])).toBe('fail [REDACTED] and [REDACTED]');
  });
});
