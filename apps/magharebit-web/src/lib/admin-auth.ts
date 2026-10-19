/**
 * admin-auth.ts
 *
 * Server-side admin authentication. The admin secret never reaches the browser.
 *
 *  - The admin pages post a password to POST /api/admin/login. The server
 *    compares it to ADMIN_SECRET (constant time) and, on success, sets a signed
 *    HttpOnly cookie (`mgh_admin`).
 *  - Admin API routes call isAdminRequest(), which accepts EITHER that cookie
 *    OR the `x-admin-secret` header (kept for curl/scripts; server-to-server use
 *    only, never from browser code).
 *
 * Fail-closed: if ADMIN_SECRET is unset/empty nothing is authorized, and the
 * session cookie additionally requires NEXTAUTH_SECRET (no hard-coded fallback).
 * The cookie is signed with a key derived from BOTH secrets, so rotating
 * ADMIN_SECRET invalidates every existing admin session.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export const ADMIN_COOKIE = 'mgh_admin'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

/** Constant-time string comparison. Hashing first hides length differences. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

function adminSecret(): string | null {
  const s = process.env.ADMIN_SECRET
  return s && s.length > 0 ? s : null
}

function signingKey(): string | null {
  const admin = adminSecret()
  const auth = process.env.NEXTAUTH_SECRET
  if (!admin || !auth) return null
  return `${auth}:${admin}:admin-session:v1`
}

function sign(payload: string): string | null {
  const key = signingKey()
  if (!key) return null
  return createHmac('sha256', key).update(payload).digest('hex')
}

/** True when admin login can work (both secrets present). */
export function isAdminConfigured(): boolean {
  return signingKey() !== null
}

/** Check a candidate password against ADMIN_SECRET. */
export function checkAdminPassword(candidate: string): boolean {
  const secret = adminSecret()
  return secret !== null && safeEqual(candidate, secret)
}

/** Create a signed session token, or null if the server is not configured. */
export function createAdminSessionToken(now: number = Date.now()): string | null {
  const exp = String(now + SESSION_TTL_MS)
  const sig = sign(exp)
  return sig ? `${exp}.${sig}` : null
}

function verifyAdminSessionToken(token: string, now: number = Date.now()): boolean {
  const [exp, sig] = token.split('.')
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false
  const expected = sign(exp)
  return expected !== null && safeEqual(sig, expected)
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Is this request made by an authenticated admin?
 * Accepts a valid session cookie or a correct `x-admin-secret` header.
 */
export function isAdminRequest(req: Request): boolean {
  const secret = adminSecret()
  if (!secret) return false

  const header = req.headers.get('x-admin-secret')
  if (header && safeEqual(header, secret)) return true

  const token = readCookie(req.headers.get('cookie'), ADMIN_COOKIE)
  return token !== null && verifyAdminSessionToken(token)
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
}

export function adminUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
