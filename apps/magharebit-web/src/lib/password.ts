/**
 * Password hashing for admin accounts (scrypt, per-password random salt).
 *
 * Stored format: scrypt$N$r$p$<salt b64>$<hash b64>. The parameters travel with
 * the hash so they can be raised later without invalidating old hashes.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, N, R, P, KEYLEN)
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0)) return false
  const salt = Buffer.from(parts[4], 'base64')
  const expected = Buffer.from(parts[5], 'base64')
  if (expected.length === 0) return false
  const actual = await scrypt(password, salt, n, r, p, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * Burn roughly the same time as a real verification. Call it when the username
 * does not exist so response timing does not reveal which usernames are valid.
 */
export async function dummyVerify(password: string): Promise<void> {
  await scrypt(password, Buffer.alloc(16), N, R, P, KEYLEN)
}

/** Minimum bar for a new admin password. */
export function isAcceptablePassword(pw: string): boolean {
  return typeof pw === 'string' && pw.length >= 12 && pw.length <= 200
}
