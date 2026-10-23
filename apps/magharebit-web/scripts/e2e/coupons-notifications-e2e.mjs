// Coupons + Notifications scaffolds: API validation, roles, uniqueness, atomic redemption, audit.
// Run against a server on real MongoDB (MONGODB_DB must match MONGODB_DB below). Env: APP_DIR, BASE (default http://localhost:3021)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const OWNER_PW = readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m)[1]
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_v2'); await db.dropDatabase()

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', role: 'operator', password: 'sara-long-password-1' } })
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'vik', displayName: 'Vik V.', role: 'viewer', password: 'viewer-long-password-1' } })
const sara = (await api('POST', '/api/admin/login', { body: { username: 'sara', password: 'sara-long-password-1' } })).cookie
const vik = (await api('POST', '/api/admin/login', { body: { username: 'vik', password: 'viewer-long-password-1' } })).cookie

// ── coupons ──────────────────────────────────────────────────────────────────
check('coupons: list needs a session (401)', (await api('GET', '/api/admin/coupons')).status === 401)
check('coupons: viewer cannot create (403)', (await api('POST', '/api/admin/coupons', { cookie: vik, body: { code: 'VIEW10', kind: 'percent', value: 10 } })).status === 403)
for (const [name, body] of [
  ['bad code (too short)', { code: 'A', kind: 'percent', value: 10 }],
  ['bad code (lower-case symbol)', { code: 'bad code!', kind: 'percent', value: 10 }],
  ['unknown kind', { code: 'KIND1', kind: 'bogus', value: 10 }],
  ['percent over 100', { code: 'BIG101', kind: 'percent', value: 101 }],
  ['percent not integer', { code: 'FRAC1', kind: 'percent', value: 10.5 }],
  ['trial_days over 90', { code: 'TRIAL91', kind: 'trial_days', value: 91 }],
  ['zero value', { code: 'ZERO1', kind: 'fixed', value: 0 }],
  ['unknown plan', { code: 'PLAN1', kind: 'percent', value: 10, plans: ['Gold'] }],
  ['maxRedemptions 0', { code: 'MAX0', kind: 'percent', value: 10, maxRedemptions: 0 }],
  ['expiry in the past', { code: 'PAST1', kind: 'percent', value: 10, expiresAt: '2020-01-01T00:00:00Z' }],
]) check(`coupons: rejects ${name} (422)`, (await api('POST', '/api/admin/coupons', { cookie: sara, body })).status === 422)

const ok = await api('POST', '/api/admin/coupons', { cookie: sara, body: { code: ' ramadan25 ', kind: 'percent', value: 25, plans: ['Business'], maxRedemptions: 2, description: 'Ramadan', expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() } })
check('coupons: operator creates, code normalised to RAMADAN25', ok.status === 201 && ok.json?.coupon?.code === 'RAMADAN25' && ok.json.coupon.redeemed === 0 && ok.json.coupon.active === true && ok.json.auditRecorded === true, JSON.stringify(ok.json)?.slice(0, 160))
check('coupons: duplicate code -> 409', (await api('POST', '/api/admin/coupons', { cookie: sara, body: { code: 'RAMADAN25', kind: 'fixed', value: 50 } })).status === 409)
await api('POST', '/api/admin/coupons', { cookie: sara, body: { code: 'TRIAL14', kind: 'trial_days', value: 14 } })
const list = await api('GET', '/api/admin/coupons', { cookie: vik })
check('coupons: viewer can list (2 coupons, newest first)', list.status === 200 && list.json.total === 2 && list.json.coupons[0].code === 'TRIAL14')
check('coupons: search ".*" is literal (no match-all)', (await api('GET', '/api/admin/coupons?q=' + encodeURIComponent('.*'), { cookie: sara })).json.coupons.length === 0)
check('coupons: search "ramad" finds RAMADAN25', (await api('GET', '/api/admin/coupons?q=ramad', { cookie: sara })).json.coupons.map((c) => c.code).join() === 'RAMADAN25')
const rid = ok.json.coupon.id
check('coupons: viewer cannot toggle (403)', (await api('PATCH', `/api/admin/coupons/${rid}`, { cookie: vik, body: { active: false } })).status === 403)
check('coupons: toggle needs a boolean (422)', (await api('PATCH', `/api/admin/coupons/${rid}`, { cookie: sara, body: { active: 'no' } })).status === 422)
check('coupons: unknown id -> 404', (await api('PATCH', '/api/admin/coupons/000000000000000000000000', { cookie: sara, body: { active: false } })).status === 404)
check('coupons: invalid id -> 404 (no crash)', (await api('PATCH', '/api/admin/coupons/not-an-id', { cookie: sara, body: { active: false } })).status === 404)
check('coupons: operator disables', (await api('PATCH', `/api/admin/coupons/${rid}`, { cookie: sara, body: { active: false } })).json?.coupon?.active === false)
check('coupons: ?active=false lists only the disabled one', (await api('GET', '/api/admin/coupons?active=false', { cookie: sara })).json.coupons.map((c) => c.code).join() === 'RAMADAN25')
await api('PATCH', `/api/admin/coupons/${rid}`, { cookie: sara, body: { active: true } })

// atomic redemption (repo-level logic, exercised through the database the same way the repo does it)
const col = db.collection('coupons')
const redeem = (plan) => col.findOneAndUpdate({ code: 'RAMADAN25', active: true, $and: [
  { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
  { $or: [{ maxRedemptions: { $exists: false } }, { $expr: { $lt: ['$redeemed', '$maxRedemptions'] } }] },
  { $or: [{ plans: { $exists: false } }, { plans: { $size: 0 } }, { plans: plan }] }] }, { $inc: { redeemed: 1 } }, { returnDocument: 'after' })
const wrongPlan = await redeem('Starter')
check('redeem: plan restriction respected (Starter refused)', !wrongPlan)
const results = await Promise.all(Array.from({ length: 8 }, () => redeem('Business')))
check('redeem: 8 concurrent attempts on maxRedemptions=2 succeed exactly twice', results.filter(Boolean).length === 2, String(results.filter(Boolean).length))
check('redeem: counter ends at 2, never above the limit', (await col.findOne({ code: 'RAMADAN25' })).redeemed === 2)

// ── notifications ────────────────────────────────────────────────────────────
check('notifications: list needs a session (401)', (await api('GET', '/api/admin/notifications')).status === 401)
check('notifications: viewer cannot send (403)', (await api('POST', '/api/admin/notifications', { cookie: vik, body: { title: 'Hello', body: 'World', audience: 'all' } })).status === 403)
for (const [name, body] of [
  ['short title', { title: 'A', body: 'Body ok', audience: 'all' }],
  ['empty body', { title: 'Title ok', body: ' ', audience: 'all' }],
  ['bad audience', { title: 'Title ok', body: 'Body ok', audience: 'everyone' }],
  ['plan audience without a valid plan', { title: 'Title ok', body: 'Body ok', audience: 'plan', target: 'Gold' }],
  ['merchant audience without target', { title: 'Title ok', body: 'Body ok', audience: 'merchant' }],
]) check(`notifications: rejects ${name} (422)`, (await api('POST', '/api/admin/notifications', { cookie: sara, body })).status === 422)
const n1 = await api('POST', '/api/admin/notifications', { cookie: sara, body: { title: 'Maintenance', body: 'Short downtime tonight', audience: 'plan', target: 'Business' } })
check('notifications: operator creates, queued and honest about delivery', n1.status === 201 && n1.json.notification.status === 'queued' && n1.json.delivered === false && n1.json.auditRecorded === true)
await api('POST', '/api/admin/notifications', { cookie: sara, body: { title: 'Welcome', body: 'Hello everyone', audience: 'all' } })
const nl = await api('GET', '/api/admin/notifications', { cookie: vik })
check('notifications: viewer lists 2, newest first', nl.status === 200 && nl.json.total === 2 && nl.json.notifications[0].title === 'Welcome')

// ── audit ────────────────────────────────────────────────────────────────────
const a1 = await api('GET', '/api/admin/audit-logs?action=createCoupon', { cookie: owner })
const a2 = await api('GET', '/api/admin/audit-logs?action=broadcastNotification', { cookie: owner })
check('audit: createCoupon entries (2 creates + 2 toggles) attributed to Sara B.', a1.json.entries.length === 4 && a1.json.entries.every((e) => e.actorName === 'Sara B.'), String(a1.json.entries.length))
check('audit: broadcastNotification entries (2) with audience meta', a2.json.entries.length === 2 && a2.json.entries.some((e) => e.meta?.audience === 'plan' && e.meta?.target === 'Business'))

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
