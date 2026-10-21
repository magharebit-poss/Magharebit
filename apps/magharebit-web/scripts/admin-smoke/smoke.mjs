// Admin API smoke test (accounts, roles, audit log, approve/revoke, POS validate).
// Runs against a dev server whose MongoDB is replaced by fake-mongo-patch.js, so it
// needs no database and sends no WhatsApp messages. See fake-mongo-patch.js for the
// start command. Run:  BASE=http://localhost:3020 ENV_FILE=./.env.local node scripts/admin-smoke/smoke.mjs
import { readFileSync } from 'node:fs'

const B = process.env.BASE || 'http://localhost:3020'
const env = readFileSync(process.env.ENV_FILE, 'utf8')
const OWNER_PW = env.match(/^ADMIN_SECRET=(.*)$/m)[1]
const MID = '64b7f0c2a1b2c3d4e5f60718'

let pass = 0, fail = 0
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`) }

async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let json = null
  try { json = await res.json() } catch {}
  const setCookie = res.headers.get('set-cookie')
  return { status: res.status, json, cookie: setCookie ? setCookie.split(';')[0] : null }
}
const login = async (username, password) => call('POST', '/api/admin/login', { body: { ...(username ? { username } : {}), password } })

// 1. owner login + session
const ownerLogin = await login(null, OWNER_PW)
check('owner login 200 with actor', ownerLogin.status === 200 && ownerLogin.json?.actor?.role === 'owner')
const owner = ownerLogin.cookie
const sess = await call('GET', '/api/admin/session', { cookie: owner })
check('session returns actor', sess.status === 200 && sess.json?.actor?.name === 'owner')

// 2. accounts
const pw = 'sara-long-password-1'
const mk = await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', role: 'operator', password: pw } })
check('create operator account 201, no hash returned', mk.status === 201 && !JSON.stringify(mk.json).includes('passwordHash') && mk.json?.auditRecorded === true, `status=${mk.status}`)
const dup = await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'X', role: 'operator', password: pw } })
check('duplicate username 409', dup.status === 409)
const mkv = await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'vic', displayName: 'Vic V.', role: 'viewer', password: 'vic-long-password-1' } })
check('create viewer account 201', mkv.status === 201)
const list = await call('GET', '/api/admin/users', { cookie: owner })
check('list accounts (2), no hashes', list.status === 200 && list.json?.users?.length === 2 && !JSON.stringify(list.json).includes('passwordHash'))

// 3. login as individual accounts; bad password; unknown user
const bad = await login('sara', 'wrong-password-123')
check('wrong password 401', bad.status === 401)
const sara = await login('sara', pw)
check('operator login 200', sara.status === 200 && sara.json?.actor?.role === 'operator')
const vic = await login('vic', 'vic-long-password-1')
check('viewer login 200', vic.status === 200 && vic.json?.actor?.role === 'viewer')
const notOwner = await call('GET', '/api/admin/users', { cookie: sara.cookie })
check('operator cannot list accounts (403)', notOwner.status === 403)

// 4. operator approves the pending merchant (generates the license)
const viewerApprove = await call('POST', `/api/admin/merchants/${MID}/approve`, { cookie: vic.cookie, body: { plan: 'Business', durationMonths: 6 } })
check('viewer cannot approve (403)', viewerApprove.status === 403)
const approve = await call('POST', `/api/admin/merchants/${MID}/approve`, { cookie: sara.cookie, body: { plan: 'Business', durationMonths: 6 } })
const key = approve.json?.license?.key
check('operator approve 201 + license key', approve.status === 201 && /^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$/.test(key || ''), `status=${approve.status} key=${key}`)
check('approvedBy names the real actor', approve.json?.merchant?.approvedBy === 'Sara B.', `approvedBy=${approve.json?.merchant?.approvedBy}`)
check('approve audit recorded', approve.json?.auditRecorded === true)
check('whatsapp not actually sent in test', approve.json?.whatsapp?.sent === false, JSON.stringify(approve.json?.whatsapp))

// 5. POS-facing validate
const v1 = await call('POST', '/api/licenses/validate', { body: { key, machineId: 'TEST-MACHINE' } })
check('validate: valid:true, Business limits', v1.status === 200 && v1.json?.valid === true && v1.json?.plan === 'Business' && v1.json?.maxRegisters === 3 && v1.json?.daysRemaining > 150, JSON.stringify(v1.json).slice(0, 160))

// 6. revoke
const viewerRevoke = await call('POST', `/api/admin/merchants/${MID}/revoke`, { cookie: vic.cookie, body: { reason: 'x', notify: false } })
check('viewer cannot revoke (403)', viewerRevoke.status === 403)
const revoke = await call('POST', `/api/admin/merchants/${MID}/revoke`, { cookie: sara.cookie, body: { reason: 'smoke-test', notify: false } })
check('operator revoke 200, 1 license revoked, audit recorded', revoke.status === 200 && revoke.json?.revokedCount === 1 && revoke.json?.auditRecorded === true, `status=${revoke.status}`)
const v2 = await call('POST', '/api/licenses/validate', { body: { key } })
check('validate after revoke: revoked', v2.json?.valid === false && v2.json?.reason === 'revoked', JSON.stringify(v2.json))

// 7. audit log content
const audit = await call('GET', '/api/admin/audit-logs?limit=100', { cookie: owner })
const entries = audit.json?.entries ?? []
const has = (action, actorName, targetType) => entries.some((e) => e.action === action && e.actorName === actorName && (!targetType || e.targetType === targetType))
check('audit-logs readable (200)', audit.status === 200, `total=${audit.json?.total}`)
check('audit: adminLogin owner', has('adminLogin', 'owner'))
check('audit: createAdmin by owner', has('createAdmin', 'owner', 'admin'))
check('audit: adminLogin Sara B.', has('adminLogin', 'Sara B.'))
check('audit: approveMerchant by Sara B.', has('approveMerchant', 'Sara B.', 'merchant'))
check('audit: generateLicense by Sara B.', has('generateLicense', 'Sara B.', 'license'))
check('audit: revokeKey by Sara B.', has('revokeKey', 'Sara B.', 'license'))
check('audit: suspendMerchant by Sara B.', has('suspendMerchant', 'Sara B.', 'merchant'))
check('audit entries are newest-first', entries.every((e, i) => i === 0 || new Date(entries[i - 1].ts) >= new Date(e.ts)))
check('audit entries carry ts + ip + actorId', entries.every((e) => e.ts && e.ip && e.actorId))
const viewerRead = await call('GET', '/api/admin/audit-logs?action=revokeKey', { cookie: vic.cookie })
check('viewer can read audit, filter by action works', viewerRead.status === 200 && viewerRead.json?.entries?.length === 1 && viewerRead.json.entries[0].action === 'revokeKey')
const badAction = await call('GET', '/api/admin/audit-logs?action=nope', { cookie: owner })
check('invalid action filter 422', badAction.status === 422)

// 8. disabling an account takes effect immediately (cookie still signed)
const sessBefore = await call('GET', '/api/admin/session', { cookie: sara.cookie })
const saraId = list.json.users.find((u) => u.username === 'sara').id
const disable = await call('PATCH', `/api/admin/users/${saraId}`, { cookie: owner, body: { disabled: true } })
const sessAfter = await call('GET', '/api/admin/session', { cookie: sara.cookie })
check('disable account: old cookie rejected at once', sessBefore.status === 200 && disable.status === 200 && sessAfter.status === 401, `before=${sessBefore.status} after=${sessAfter.status}`)
const loginDisabled = await login('sara', pw)
check('disabled account cannot log in', loginDisabled.status === 401)
const selfDisable = await call('PATCH', `/api/admin/users/${list.json.users.find((u) => u.username === 'vic').id}`, { cookie: vic.cookie, body: { disabled: true } })
check('non-owner cannot disable accounts (403)', selfDisable.status === 403)
const audit2 = await call('GET', '/api/admin/audit-logs?action=disableAdmin', { cookie: owner })
check('audit: disableAdmin recorded', audit2.json?.entries?.length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

