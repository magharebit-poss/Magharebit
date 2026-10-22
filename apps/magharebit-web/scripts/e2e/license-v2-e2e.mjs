// License v2 end to end: Ed25519 tokens, terminal limits, refresh, suspend/extend/revoke/release.
// The checks act as a POS: they verify tokens offline with only the published JWKS.
//
// 1) generate a throwaway key:   node scripts/gen-license-keypair.mjs test-kid   (copy the two env lines)
// 2) start the server with it:   LICENSE_SIGNING_KID=... LICENSE_SIGNING_PRIVATE_KEY=... \
//      MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_v2 NEXT_DIST_DIR=.next-test npx next dev -p 3021
// 3) run:                        APP_DIR=. node scripts/e2e/license-v2-e2e.mjs
//    Without a key on the server:  NO_KEY=1 APP_DIR=. node scripts/e2e/license-v2-e2e.mjs   (fail-closed checks)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createHmac, randomBytes } from 'node:crypto'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const env = readFileSync(`${APP}/.env.local`, 'utf8')
const SECRET = env.match(/^NEXTAUTH_SECRET=(.*)$/m)[1]
const OWNER_PW = env.match(/^ADMIN_SECRET=(.*)$/m)[1]
const req = createRequire(`${APP}/package.json`)
const { MongoClient, ObjectId } = req('mongodb')
const ts = req('typescript')
const tmp = mkdtempSync(join(tmpdir(), 'mgh-v2-'))
for (const f of ['license-token', 'plans']) {
  writeFileSync(join(tmp, `${f}.js`), ts.transpileModule(readFileSync(`${APP}/src/lib/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)
}
const T = createRequire(join(tmp, 'x.js'))('./license-token.js')

const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_v2'); await db.dropDatabase()

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null, headers: res.headers }
}

// ── data helpers (keys are built exactly like the server builds them) ───────────
function mkKey(d = new Date()) {
  const body = `MGH-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`
  return `${body}-${createHmac('sha256', SECRET).update(body).digest('hex').slice(0, 2).toUpperCase()}`
}
let n = 0
async function mkMerchant(status = 'approved') {
  const phone = `2126${String(10000000 + ++n)}`
  const _id = new ObjectId()
  await db.collection('merchants').insertOne({ _id, phone, storeName: `Shop ${n}`, sector: 'epicerie', city: 'Rabat', locale: 'fr', createdAt: new Date(), status, plan: 'Business' })
  return { id: _id.toHexString(), phone }
}
async function mkLicense(merchantPhone, { plan = 'Business', days = 180, trial = false } = {}) {
  const now = new Date()
  const lic = { id: `LIC-T${++n}-${randomBytes(2).toString('hex').toUpperCase()}`, key: mkKey(), merchantId: merchantPhone, storeName: `Shop ${n}`, plan, durationMonths: trial ? 0 : 6, ...(trial ? { isTrial: true, durationDays: 14 } : {}), issuedAt: now, expiresAt: new Date(now.getTime() + days * 86400000), status: 'active' }
  await db.collection('licenses').insertOne({ ...lic })
  return lic
}
const activate = (key, machineId) => call('POST', '/api/licenses/activate', { body: { key, machineId } })
const validate = (key, machineId) => call('POST', '/api/licenses/validate', { body: { key, ...(machineId ? { machineId } : {}) } })

// ── no-key mode: fail closed ───────────────────────────────────────────────────
if (process.env.NO_KEY) {
  const m = await mkMerchant(); const lic = await mkLicense(m.phone)
  check('jwks: 503 when no signing key is configured', (await call('GET', '/api/licenses/jwks')).status === 503)
  const a = await activate(lic.key, 'MACHINE-0001')
  check('activate: 503 v2_not_configured, nothing signed', a.status === 503 && a.json.reason === 'v2_not_configured' && !('token' in a.json))
  const v = await validate(lic.key, 'MACHINE-0001')
  check('validate: still the v1 answer, no token', v.json.valid === true && v.json.plan === 'Business' && !('token' in v.json) && !('schema' in v.json))
  check('no terminal was registered', ((await db.collection('licenses').findOne({ id: lic.id })).terminals ?? []).length === 0)
  console.log(`\n${pass} passed, ${fail} failed`); await mongo.close(); process.exit(fail ? 1 : 0)
}

// ── admin accounts ─────────────────────────────────────────────────────────────
const owner = (await call('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'vic', displayName: 'Vic V.', role: 'viewer', password: 'vic-long-password-1' } })
const sara = (await call('POST', '/api/admin/login', { body: { username: 'sara', password: 'sara-long-password-1' } })).cookie
const vic = (await call('POST', '/api/admin/login', { body: { username: 'vic', password: 'vic-long-password-1' } })).cookie

// ── JWKS ───────────────────────────────────────────────────────────────────────
const jw = await call('GET', '/api/licenses/jwks')
const jwks = jw.json
check('jwks: 200, one OKP/Ed25519 key with kid, cacheable', jw.status === 200 && jwks.keys.length >= 1 && jwks.keys[0].kty === 'OKP' && jwks.keys[0].crv === 'Ed25519' && !!jwks.keys[0].kid && /max-age=3600/.test(jw.headers.get('cache-control') || ''))
check('jwks: never exposes a private component', !JSON.stringify(jwks).includes('"d"'))

// ── activate: input validation and key errors ──────────────────────────────────
const m1 = await mkMerchant(); const biz = await mkLicense(m1.phone)
check('activate: machineId too short -> 400', (await activate(biz.key, 'short')).status === 400)
check('activate: machineId with spaces -> 400', (await activate(biz.key, 'has space in it')).status === 400)
check('activate: non-JSON -> 400', (await fetch(B + '/api/licenses/activate', { method: 'POST', body: 'x' })).status === 400)
check('activate: garbage key -> checksum_failed (no DB hit)', (await activate('MGH-202610-AAAAAAAA-BBBB-ZZ', 'MACHINE-0001')).json.reason === 'checksum_failed')
check('activate: well-formed but unknown key -> invalid_key', (await activate(mkKey(), 'MACHINE-0001')).json.reason === 'invalid_key')

// ── activate: tokens + terminal limit (Business = 3) ───────────────────────────
const tokens = {}
for (const mid of ['TERMINAL-A1', 'TERMINAL-B2', 'TERMINAL-C3']) {
  const r = await activate(biz.key, mid)
  tokens[mid] = r.json?.token
  check(`activate ${mid}: valid, schema 2, JWT`, r.json?.valid === true && r.json.schema === 2 && String(r.json.token).split('.').length === 3)
}
const v = T.verifyLicenseToken(tokens['TERMINAL-A1'], jwks, { machineId: 'TERMINAL-A1' })
check('POS verification with only the JWKS accepts the token', v.ok === true)
check('claims: Business limits, merchant, license id, machine', v.ok && v.claims.plan === 'Business' && v.claims.maxRegisters === 3 && v.claims.maxBranches === 2 && v.claims.sub === m1.phone && v.claims.jti === biz.id && v.claims.machineId === 'TERMINAL-A1' && v.claims.trial === false)
check('claims: exp equals the license expiry; refreshBy = iat + 7 days', v.ok && v.claims.exp === Math.floor(biz.expiresAt.getTime() / 1000) && v.claims.refreshBy === v.claims.iat + 604800)
check('a token cannot be used by another terminal', T.verifyLicenseToken(tokens['TERMINAL-A1'], jwks, { machineId: 'TERMINAL-B2' }).reason === 'machine_mismatch')
const [h, , s] = tokens['TERMINAL-A1'].split('.')
const forged = `${h}.${Buffer.from(JSON.stringify({ ...v.claims, maxRegisters: 99, exp: v.claims.exp + 10 ** 8 })).toString('base64url')}.${s}`
check('a forged payload fails signature verification', T.verifyLicenseToken(forged, jwks).reason === 'bad_signature')
const d4 = await activate(biz.key, 'TERMINAL-D4')
check('4th terminal -> terminal_limit, no token', d4.json.valid === false && d4.json.reason === 'terminal_limit' && !('token' in d4.json))
const again = await activate(biz.key, 'TERMINAL-A1')
check('re-activating a registered terminal is idempotent (still 3 slots)', again.json.valid === true && ((await db.collection('licenses').findOne({ id: biz.id })).terminals ?? []).length === 3)

// ── validate: v1 unchanged; refresh path gives a fresh token ───────────────────
const v1 = await validate(biz.key)
check('validate without machineId: v1 response, no token', v1.json.valid === true && v1.json.plan === 'Business' && v1.json.maxRegisters === 3 && !('token' in v1.json))
const vUnreg = await validate(biz.key, 'UNREGISTERED-1')
check('validate with an unregistered machine: no token (activate registers)', vUnreg.json.valid === true && !('token' in vUnreg.json))
const vReg = await validate(biz.key, 'TERMINAL-B2')
check('validate with a registered machine: schema 2 + fresh token that verifies', vReg.json.schema === 2 && T.verifyLicenseToken(vReg.json.token, jwks, { machineId: 'TERMINAL-B2' }).ok === true)
check('v1 fields still present alongside the token', ['key', 'plan', 'storeName', 'expiresAt', 'daysRemaining', 'firstActivation', 'isTrial', 'maxRegisters', 'maxBranches', 'features'].every((f) => f in vReg.json))

// ── plan limit and trial ───────────────────────────────────────────────────────
const m2 = await mkMerchant(); const starter = await mkLicense(m2.phone, { plan: 'Starter' })
check('Starter: first terminal ok', (await activate(starter.key, 'TERMINAL-S01')).json.valid === true)
check('Starter: second terminal -> terminal_limit', (await activate(starter.key, 'TERMINAL-S02')).json.reason === 'terminal_limit')
const m3 = await mkMerchant(); const trial = await mkLicense(m3.phone, { plan: 'Starter', days: 14, trial: true })
const tr = await activate(trial.key, 'TERMINAL-TR1')
const trv = T.verifyLicenseToken(tr.json.token, jwks, { machineId: 'TERMINAL-TR1' })
check('trial token: trial true, Starter limits, ~14 days', trv.ok && trv.claims.trial === true && trv.claims.maxRegisters === 1 && trv.claims.exp - trv.claims.iat > 13 * 86400 && trv.claims.exp - trv.claims.iat <= 14 * 86400 + 5)

// ── race for the last slots ────────────────────────────────────────────────────
const m4 = await mkMerchant(); const raceLic = await mkLicense(m4.phone)
const results = await Promise.all(Array.from({ length: 8 }, (_, i) => activate(raceLic.key, `RACE-TERM-${i}`)))
const okN = results.filter((r) => r.json.valid === true).length
const stored = (await db.collection('licenses').findOne({ id: raceLic.id })).terminals ?? []
check('8 simultaneous activations on a 3-slot license: exactly 3 win', okN === 3 && stored.length === 3, `won=${okN} stored=${stored.length}`)
check('the 5 losers all got terminal_limit', results.filter((r) => r.json.reason === 'terminal_limit').length === 5)

// ── admin: release a terminal ──────────────────────────────────────────────────
check('release: needs a session (401)', (await call('POST', `/api/admin/licenses/${biz.id}/terminals/release`, { body: { machineId: 'TERMINAL-B2' } })).status === 401)
check('release: viewer cannot (403)', (await call('POST', `/api/admin/licenses/${biz.id}/terminals/release`, { cookie: vic, body: { machineId: 'TERMINAL-B2' } })).status === 403)
check('release: unknown terminal -> 404', (await call('POST', `/api/admin/licenses/${biz.id}/terminals/release`, { cookie: sara, body: { machineId: 'NOT-REGISTERED' } })).status === 404)
const rel = await call('POST', `/api/admin/licenses/${biz.id}/terminals/release`, { cookie: sara, body: { machineId: 'TERMINAL-B2' } })
check('release: operator frees a slot, audited', rel.status === 200 && rel.json.auditRecorded === true)
check('the freed slot lets a new terminal activate', (await activate(biz.key, 'TERMINAL-D4')).json.valid === true)
check('the released terminal can no longer refresh a token', !('token' in (await validate(biz.key, 'TERMINAL-B2')).json))

// ── admin: suspend / reactivate toggle ─────────────────────────────────────────
const m5 = await mkMerchant(); const togLic = await mkLicense(m5.phone)
check('toggle: needs a session (401)', (await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { body: { status: 'suspended' } })).status === 401)
check('toggle: viewer cannot (403)', (await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: vic, body: { status: 'suspended' } })).status === 403)
check('toggle: bad status -> 422', (await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: sara, body: { status: 'deleted' } })).status === 422)
check('toggle: reactivating an active merchant -> 409', (await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: sara, body: { status: 'active' } })).status === 409)
const sus = await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: sara, body: { status: 'suspended', reason: 'unpaid' } })
check('toggle: operator suspends, audited', sus.status === 200 && sus.json.merchant.status === 'suspended' && sus.json.auditRecorded === true)
check('suspended: validate -> reason suspended', (await validate(togLic.key)).json.reason === 'suspended')
check('suspended: activate -> reason suspended', (await activate(togLic.key, 'TERMINAL-T01')).json.reason === 'suspended')
check('suspended: the license itself is untouched (not revoked)', (await db.collection('licenses').findOne({ id: togLic.id })).status === 'active')
check('toggle: suspending twice -> 409', (await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: sara, body: { status: 'suspended' } })).status === 409)
const rea = await call('PATCH', `/api/admin/merchants/${m5.id}/status`, { cookie: sara, body: { status: 'active' } })
check('toggle: reactivated, service restored at once', rea.status === 200 && rea.json.merchant.status === 'approved' && (await activate(togLic.key, 'TERMINAL-T01')).json.valid === true)

// ── admin: extend an expired license ───────────────────────────────────────────
const m6 = await mkMerchant(); const exp = await mkLicense(m6.phone, { days: -3 })
check('expired license: validate -> expired', (await validate(exp.key)).json.reason === 'expired')
check('expired license: activate -> expired', (await activate(exp.key, 'TERMINAL-E01')).json.reason === 'expired')
check('extend: both months and days -> 422', (await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: sara, body: { months: 1, days: 5 } })).status === 422)
check('extend: neither -> 422', (await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: sara, body: {} })).status === 422)
check('extend: bad months -> 422', (await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: sara, body: { months: 5 } })).status === 422)
check('extend: viewer cannot (403)', (await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: vic, body: { months: 1 } })).status === 403)
const ext = await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: sara, body: { months: 1, reason: 'goodwill' } })
const dEnd = (new Date(ext.json?.license?.expiresAt) - Date.now()) / 86400000
check('extend: expired license comes back for ~1 month from NOW, audited', ext.status === 200 && ext.json.license.status === 'active' && dEnd > 27 && dEnd < 32 && ext.json.auditRecorded === true, `days=${dEnd.toFixed(1)}`)
check('extended license validates and activates again', (await validate(exp.key)).json.valid === true && (await activate(exp.key, 'TERMINAL-E01')).json.valid === true)
const extDays = await call('POST', `/api/admin/licenses/${exp.id}/extend`, { cookie: sara, body: { days: 10 } })
check('extend by days adds from the current (future) expiry', extDays.status === 200 && Math.abs((new Date(extDays.json.license.expiresAt) - new Date(ext.json.license.expiresAt)) / 86400000 - 10) < 0.01)

// ── admin: revoke one license ──────────────────────────────────────────────────
const m7 = await mkMerchant(); const revLic = await mkLicense(m7.phone); const other = await mkLicense(m7.phone)
const tok = (await activate(revLic.key, 'TERMINAL-R01')).json.token
check('revoke: viewer cannot (403)', (await call('POST', `/api/admin/licenses/${revLic.id}/revoke`, { cookie: vic, body: {} })).status === 403)
const rv = await call('POST', `/api/admin/licenses/${revLic.id}/revoke`, { cookie: sara, body: { reason: 'refund' } })
check('revoke: operator revokes one license, audited', rv.status === 200 && rv.json.auditRecorded === true)
check('revoked: validate and activate refuse', (await validate(revLic.key)).json.reason === 'revoked' && (await activate(revLic.key, 'TERMINAL-R01')).json.reason === 'revoked')
check('revoked: refresh gives no new token, but the cached one is still a valid signature until exp (why refresh matters)', !('token' in (await validate(revLic.key, 'TERMINAL-R01')).json) && T.verifyLicenseToken(tok, jwks, { machineId: 'TERMINAL-R01' }).ok === true)
check('the merchant and its other license are unaffected', (await validate(other.key)).json.valid === true)
check('revoke twice -> 409; extend a revoked license -> 409', (await call('POST', `/api/admin/licenses/${revLic.id}/revoke`, { cookie: sara, body: {} })).status === 409 && (await call('POST', `/api/admin/licenses/${revLic.id}/extend`, { cookie: sara, body: { months: 1 } })).status === 409)
check('unknown license id -> 404', (await call('POST', `/api/admin/licenses/LIC-NOPE/revoke`, { cookie: sara, body: {} })).status === 404)

// ── audit trail ────────────────────────────────────────────────────────────────
const audit = await call('GET', '/api/admin/audit-logs?limit=200', { cookie: owner })
const E = audit.json.entries
const has = (a, pred) => E.some((e) => e.action === a && e.actorName === 'Sara B.' && e.actorEmail === 'sara@example.test' && pred(e))
check('audit: releaseTerminal with machineId', has('releaseTerminal', (e) => e.meta?.machineId === 'TERMINAL-B2' && e.targetId === biz.id))
check('audit: suspendMerchant + reactivateMerchant (toggle)', has('suspendMerchant', (e) => e.meta?.mode === 'toggle' && e.meta?.reason === 'unpaid') && has('reactivateMerchant', (e) => e.meta?.mode === 'toggle'))
check('audit: extendSubscription with from/to and reason', has('extendSubscription', (e) => e.targetId === exp.id && e.meta?.months === 1 && e.meta?.reason === 'goodwill' && e.meta?.wasExpired === true && !!e.meta?.to))
check('audit: revokeKey scope license with reason', has('revokeKey', (e) => e.targetId === revLic.id && e.meta?.scope === 'license' && e.meta?.reason === 'refund'))
check('audit: the new action names are accepted as filters', (await call('GET', '/api/admin/audit-logs?action=releaseTerminal', { cookie: owner })).json.entries.length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
void ((x) => x)(tmp)
