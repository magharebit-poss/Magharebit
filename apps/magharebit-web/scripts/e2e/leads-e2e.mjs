// Leads -> activation end-to-end (API level) against a dev server on real MongoDB.
// Start: MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_leads npx next dev -p 3021
// Run:   APP_DIR=. node scripts/e2e/leads-e2e.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const OWNER_PW = readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m)[1]
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_leads'); await db.dropDatabase()

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}

// accounts
const owner = (await call('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
await call('POST', '/api/admin/users', { cookie: owner, body: { username: 'vic', displayName: 'Vic V.', role: 'viewer', password: 'vic-long-password-1' } })
const sara = (await call('POST', '/api/admin/login', { body: { username: 'sara', password: 'sara-long-password-1' } })).cookie
const vic = (await call('POST', '/api/admin/login', { body: { username: 'vic', password: 'vic-long-password-1' } })).cookie

// leads arrive through the public demo form
const mk = (n, phone) => call('POST', '/api/leads', { body: { storeName: n, phone, businessType: 'bakery', city: 'Rabat', locale: 'fr' } })
const l1 = await mk('Boulangerie Atlas', '0661111111')
const l2 = await mk('Café Medina', '0662222222')
const l3 = await mk('Epicerie Nour', '0663333333')
check('public lead form still works (201)', l1.status === 201 && l2.status === 201 && l3.status === 201)

// listing + search
const list = await call('GET', '/api/leads', { cookie: sara })
check('admin lists leads, no _id leaked', list.status === 200 && list.json.total === 3 && !JSON.stringify(list.json).includes('_id'))
check('leads use submittedAt (not createdAt)', list.json.leads.every((l) => !!l.submittedAt && !('createdAt' in l)))
const q = await call('GET', '/api/leads?q=medina', { cookie: sara })
check('server-side search finds Café Medina only', q.json.total === 1 && q.json.leads[0].storeName === 'Café Medina')
const qr = await call('GET', '/api/leads?q=.*', { cookie: sara })
check('search input is escaped (regex chars do not match everything)', qr.json.total === 0)
check('leads list needs a session (401)', (await call('GET', '/api/leads')).status === 401)

const id1 = l1.json.id, id2 = l2.json.id, id3 = l3.json.id

// status changes: only through the controlled route
const bad1 = await call('PATCH', `/api/leads/${id1}`, { cookie: sara, body: { status: 'contacted', licenseKey: 'MGB-FAKE-FAKE' } })
check('PATCH refuses a client-supplied licenseKey (400)', bad1.status === 400)
const bad2 = await call('PATCH', `/api/leads/${id1}`, { cookie: sara, body: { status: 'activated' } })
check("PATCH refuses status 'activated' (400)", bad2.status === 400)
check('viewer cannot change status (403)', (await call('PATCH', `/api/leads/${id1}`, { cookie: vic, body: { status: 'contacted' } })).status === 403)
const ok1 = await call('PATCH', `/api/leads/${id1}`, { cookie: sara, body: { status: 'contacted' } })
check('operator sets status contacted, audit recorded', ok1.status === 200 && ok1.json.lead.status === 'contacted' && ok1.json.auditRecorded === true)
check('rejecting a lead works', (await call('PATCH', `/api/leads/${id3}`, { cookie: sara, body: { status: 'rejected' } })).status === 200)

// activation
const body = { plan: 'Business', durationMonths: 6 }
check('activation needs a session (401)', (await call('POST', `/api/admin/leads/${id1}/activate`, { body })).status === 401)
check('viewer cannot activate (403)', (await call('POST', `/api/admin/leads/${id1}/activate`, { cookie: vic, body })).status === 403)
check('bad plan rejected (422)', (await call('POST', `/api/admin/leads/${id1}/activate`, { cookie: sara, body: { plan: 'Gold', durationMonths: 6 } })).status === 422)
check('bad duration rejected (422)', (await call('POST', `/api/admin/leads/${id1}/activate`, { cookie: sara, body: { plan: 'Business', durationMonths: 5 } })).status === 422)
check('unknown lead 404', (await call('POST', `/api/admin/leads/lead_nope/activate`, { cookie: sara, body })).status === 404)
const rej = await call('POST', `/api/admin/leads/${id3}/activate`, { cookie: sara, body })
check('rejected lead cannot be activated (409)', rej.status === 409 && String(rej.json.error).startsWith('lead_rejected'))

const act = await call('POST', `/api/admin/leads/${id1}/activate`, { cookie: sara, body })
const key = act.json?.license?.key
check('operator activates: 201 with a real MGH key', act.status === 201 && /^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$/.test(key || ''), key)
check('lead now activated and carries that key', act.json?.lead?.status === 'activated' && act.json.lead.licenseKey === key)
check('audit recorded; WhatsApp not sent in test env', act.json?.auditRecorded === true && act.json?.whatsapp?.sent === false)
const v = await call('POST', '/api/licenses/validate', { body: { key, machineId: 'E2E' } })
check('POS validate accepts the key: Business, 3 registers, ~6 months', v.json?.valid === true && v.json.plan === 'Business' && v.json.maxRegisters === 3 && v.json.daysRemaining > 170 && v.json.daysRemaining < 190, JSON.stringify(v.json).slice(0, 100))
const m = await db.collection('merchants').findOne({ phone: '212661111111' })
check('merchant created: approved, Business, approvedBy the operator', m && m.status === 'approved' && m.plan === 'Business' && m.approvedBy === 'Sara B.' && m.sector === 'bakery' && m.city === 'Rabat')
const lic = await db.collection('licenses').find({ merchantId: '212661111111' }).toArray()
check('exactly one license for the merchant', lic.length === 1 && lic[0].key === key)
check('second activation is refused (409) and returns no new key', (await call('POST', `/api/admin/leads/${id1}/activate`, { cookie: sara, body })).status === 409)
check('PATCH cannot touch an activated lead (409)', (await call('PATCH', `/api/leads/${id1}`, { cookie: sara, body: { status: 'new' } })).status === 409)

// race: two admins click at the same moment
const [r1, r2] = await Promise.all([
  call('POST', `/api/admin/leads/${id2}/activate`, { cookie: sara, body: { plan: 'Starter', durationMonths: 1 } }),
  call('POST', `/api/admin/leads/${id2}/activate`, { cookie: owner, body: { plan: 'Enterprise', durationMonths: 12 } }),
])
const statuses = [r1.status, r2.status].sort()
check('simultaneous double activation: one 201, one 409', statuses[0] === 201 && statuses[1] === 409, statuses.join(','))
const lics2 = await db.collection('licenses').find({ merchantId: '212662222222' }).toArray()
check('race leaves exactly one ACTIVE license (the loser was revoked)', lics2.filter((l) => l.status === 'active').length === 1, `active=${lics2.filter((l) => l.status === 'active').length} total=${lics2.length}`)
const winnerKey = (r1.status === 201 ? r1 : r2).json.license.key
const lead2 = await db.collection('leads').findOne({ id: id2 })
check('lead holds the winner key', lead2.licenseKey === winnerKey && lead2.status === 'activated')

// audit trail
const audit = await call('GET', '/api/admin/audit-logs?limit=100', { cookie: owner })
const has = (action, who) => audit.json.entries.some((e) => e.action === action && e.actorName === who)
check('audit: activateLead by Sara B. with email', audit.json.entries.some((e) => e.action === 'activateLead' && e.actorName === 'Sara B.' && e.actorEmail === 'sara@example.test' && e.meta?.leadId === id1))
check('audit: generateLicense for the same key', audit.json.entries.some((e) => e.action === 'generateLicense' && e.targetId === act.json.license.id))
check('audit: updateLeadStatus recorded (new -> contacted)', audit.json.entries.some((e) => e.action === 'updateLeadStatus' && e.meta?.from === 'new' && e.meta?.to === 'contacted'))
check('audit: filter by new action works', (await call('GET', '/api/admin/audit-logs?action=activateLead', { cookie: owner })).json.entries.length === 2)

// a second lead from the same phone as an existing merchant reuses it
const l4 = await mk('Boulangerie Atlas 2', '0661111111')
const act4 = await call('POST', `/api/admin/leads/${l4.json.id}/activate`, { cookie: sara, body: { plan: 'Enterprise', durationMonths: 12 } })
const merchants = await db.collection('merchants').find({ phone: '212661111111' }).toArray()
check('same phone reuses the merchant record and updates its plan', act4.status === 201 && merchants.length === 1 && merchants[0].plan === 'Enterprise')

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
void has
