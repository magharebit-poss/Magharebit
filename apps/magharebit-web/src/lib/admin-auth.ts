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
import { adminUsersRepo } from './repositories/admin-users'

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

// ── Identity ─────────────────────────────────────────────────────────────────

export type AdminRole = 'owner' | 'operator' | 'viewer'

/** Who is acting. Written into every audit entry. */
export interface AdminActor {
  id: string
  name: string
  role: AdminRole
}

/** Break-glass identity: signed in with ADMIN_SECRET and no username. */
export const OWNER_ACTOR: AdminActor = { id: 'owner', name: 'owner', role: 'owner' }
/** Identity for scripts that send the x-admin-secret header. */
export const SCRIPT_ACTOR: AdminActor = { id: 'system:script', name: 'script', role: 'owner' }

const b64u = (s: string): string => Buffer.from(s, 'utf8').toString('base64url')

/**
 * Create a signed session token carrying the actor, or null if the server is
 * not configured. Format: base64url(JSON{sub,name,role,exp}).hmac-hex
 */
export function createAdminSessionToken(actor: AdminActor, now: number = Date.now()): string | null {
  const payload = b64u(JSON.stringify({ sub: actor.id, name: actor.name, role: actor.role, exp: now + SESSION_TTL_MS }))
  const sig = sign(payload)
  return sig ? `${payload}.${sig}` : null
}

function parseAdminSessionToken(token: string, now: number = Date.now()): AdminActor | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (expected === null || !safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown
      name?: unknown
      role?: unknown
      exp?: unknown
    }
    if (typeof data.exp !== 'number' || data.exp < now) return null
    if (typeof data.sub !== 'string' || typeof data.name !== 'string') return null
    if (data.role !== 'owner' && data.role !== 'operator' && data.role !== 'viewer') return null
    return { id: data.sub, name: data.name, role: data.role }
  } catch {
    return null
  }
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
 * Who is making this request? Accepts a valid session cookie or a correct
 * `x-admin-secret` header. Signature-only (no database): use
 * authenticateAdmin() when a disabled account must be refused immediately.
 */
export function getAdminActor(req: Request): AdminActor | null {
  const secret = adminSecret()
  if (!secret) return null

  const header = req.headers.get('x-admin-secret')
  if (header && safeEqual(header, secret)) return SCRIPT_ACTOR

  const token = readCookie(req.headers.get('cookie'), ADMIN_COOKIE)
  return token !== null ? parseAdminSessionToken(token) : null
}

/** Is this request made by an authenticated admin? (signature check only) */
export function isAdminRequest(req: Request): boolean {
  return getAdminActor(req) !== null
}

/**
 * Full check for write actions: the signed session, plus (for individual
 * accounts) a database lookup so a disabled admin loses access at once and the
 * role is always the current one, not the one frozen into the cookie.
 */
export async function authenticateAdmin(req: Request): Promise<AdminActor | null> {
  const actor = getAdminActor(req)
  if (!actor) return null
  if (actor.id === OWNER_ACTOR.id || actor.id.startsWith('system:')) return actor
  const user = await adminUsersRepo.findById(actor.id)
  if (!user || user.disabledAt) return null
  return { id: user.id, name: user.displayName || user.username, role: user.role }
}

/** operator and owner may change data; viewer is read-only. */
export function canWrite(actor: AdminActor): boolean {
  return actor.role === 'owner' || actor.role === 'operator'
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
