// Phase 3 admin API: tipping, commission rates, catalog (shop types, cuisines, banners), notification status/resend,
// audit entries, old audit-log URL redirect. Real MongoDB; the server's MONGODB_DB must equal MONGODB_DB here.
// Env: APP_DIR, BASE (default http://localhost:3027), MONGODB_DB (default magharebit_v2)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3027'
const APP = process.env.APP_DIR || process.cwd()
const OWNER_PW = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient, ObjectId } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_v2'); await db.dropDatabase()

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function api(method, path, { cookie, body, redirect } = {}) {
  const res = await fetch(B + path, { method, redirect: redirect ?? 'follow', headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null, headers: res.headers }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'vik', displayName: 'Vik V.', role: 'viewer', password: 'viewer-long-password-1' } })
const sara = (await api('POST', '/api/admin/login', { body: { username: 'sara', password: 'sara-long-password-1' } })).cookie
const vik = (await api('POST', '/api/admin/login', { body: { username: 'vik', password: 'viewer-long-password-1' } })).cookie

// ── tipping ──────────────────────────────────────────────────────────────────
check('tipping: GET needs a session (401)', (await api('GET', '/api/admin/settings/tipping')).status === 401)
const t0 = await api('GET', '/api/admin/settings/tipping', { cookie: vik })
check('tipping: viewer reads the defaults [5,10,20], saved=false', t0.status === 200 && JSON.stringify(t0.json.tips) === '[5,10,20]' && t0.json.saved === false)
check('tipping: viewer cannot update (403)', (await api('PUT', '/api/admin/settings/tipping', { cookie: vik, body: { tips: [1, 2, 3] } })).status === 403)
for (const [name, tips] of [['two values', [1, 2]], ['four values', [1, 2, 3, 4]], ['negative', [-1, 2, 3]], ['above 1000', [1, 2, 1001]], ['decimal', [1.5, 2, 3]], ['string', ['5', 10, 20]], ['not an array', 'x']])
  check(`tipping: rejects ${name} (422)`, (await api('PUT', '/api/admin/settings/tipping', { cookie: sara, body: { tips } })).status === 422)
const tp = await api('PUT', '/api/admin/settings/tipping', { cookie: sara, body: { tips: [0, 15, 30] } })
check('tipping: operator updates to [0,15,30] (0 = hidden option), audited', tp.status === 200 && JSON.stringify(tp.json.tips) === '[0,15,30]' && tp.json.saved === true && tp.json.updatedBy === 'Sara B.' && tp.json.auditRecorded === true)
check('tipping: persisted for everyone', JSON.stringify((await api('GET', '/api/admin/settings/tipping', { cookie: vik })).json.tips) === '[0,15,30]')
check('tipping: stored in the database', JSON.stringify((await db.collection('platform_settings').findOne({ _id: 'tipping' }))?.tips) === '[0,15,30]')

// ── commission ───────────────────────────────────────────────────────────────
const mk = async (name, phone, status) => { const _id = new ObjectId(); await db.collection('merchants').insertOne({ _id, phone, storeName: name, sector: 'epicerie', city: 'Rabat', locale: 'fr', createdAt: new Date(), status, plan: 'Starter' }); return String(_id) }
const m1 = await mk('Epicerie Commission', '212650000001', 'approved')
const mPending = await mk('Pending Shop', '212650000002', 'pending')
const mSusp = await mk('Suspended Shop', '212650000003', 'suspended')
check('commission: viewer cannot edit (403)', (await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: vik, body: { rate: 5 } })).status === 403)
for (const [name, rate] of [['negative', -1], ['over 100', 100.01], ['three decimals', 12.345], ['string', '12'], ['NaN-like', null]])
  check(`commission: rejects ${name} (422)`, (await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate } })).status === 422)
const c1 = await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate: 12.5 } })
check('commission: operator sets 12.5%', c1.status === 200 && c1.json.merchant.commissionRate === 12.5 && c1.json.auditRecorded === true)
check('commission: 0.07 is accepted (floating point safe), 100 and 0 too', (await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate: 0.07 } })).status === 200 && (await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate: 100 } })).status === 200 && (await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate: 0 } })).status === 200)
check('commission: pending and suspended merchants cannot be edited (409)', (await api('PATCH', `/api/admin/merchants/${mPending}/commission`, { cookie: sara, body: { rate: 5 } })).status === 409 && (await api('PATCH', `/api/admin/merchants/${mSusp}/commission`, { cookie: sara, body: { rate: 5 } })).status === 409)
check('commission: unknown / malformed id -> 404', (await api('PATCH', '/api/admin/merchants/000000000000000000000000/commission', { cookie: sara, body: { rate: 5 } })).status === 404 && (await api('PATCH', '/api/admin/merchants/nope/commission', { cookie: sara, body: { rate: 5 } })).status === 404)
await api('PATCH', `/api/admin/merchants/${m1}/commission`, { cookie: sara, body: { rate: 7.25 } })
const listed = (await api('GET', '/api/admin/merchants?status=approved', { cookie: vik })).json.merchants.find((x) => x.id === m1)
check('commission: the merchants list returns commissionRate 7.25', listed?.commissionRate === 7.25)

// ── catalog ──────────────────────────────────────────────────────────────────
check('catalog: unknown kind -> 404', (await api('GET', '/api/admin/catalog/pizza', { cookie: vik })).status === 404)
check('catalog: list needs a session (401)', (await api('GET', '/api/admin/catalog/banner')).status === 401)
for (const kind of ['shop-type', 'cuisine', 'banner']) {
  check(`[${kind}] viewer cannot create (403)`, (await api('POST', `/api/admin/catalog/${kind}`, { cookie: vik, body: { name: 'Nope' } })).status === 403)
  for (const [name, body] of [['name too short', { name: 'A' }], ['name too long', { name: 'x'.repeat(81) }], ['javascript: image', { name: 'Bad', imageUrl: 'javascript:alert(1)' }], ['http image', { name: 'Bad', imageUrl: 'http://example.test/a.png' }], ['protocol-relative image', { name: 'Bad', imageUrl: '//evil.test/a.png' }], ['data: image', { name: 'Bad', imageUrl: 'data:image/png;base64,AAAA' }], ['long description', { name: 'Bad', description: 'x'.repeat(301) }], ['active not boolean', { name: 'Bad', active: 'yes' }]])
    check(`[${kind}] rejects ${name} (422)`, (await api('POST', `/api/admin/catalog/${kind}`, { cookie: sara, body })).status === 422)
  const made = await api('POST', `/api/admin/catalog/${kind}`, { cookie: sara, body: { name: `  ${kind} one `, description: 'First', imageUrl: 'https://example.test/a.png' } })
  check(`[${kind}] operator creates (trimmed name, active by default), audited`, made.status === 201 && made.json.item.name === `${kind} one` && made.json.item.active === true && made.json.item.kind === kind && made.json.auditRecorded === true)
  const local = await api('POST', `/api/admin/catalog/${kind}`, { cookie: sara, body: { name: `${kind} local`, imageUrl: '/media/a1-hero.webp', active: false } })
  check(`[${kind}] same-site image path accepted, active=false respected`, local.status === 201 && local.json.item.active === false)
  const id = made.json.item.id
  check(`[${kind}] viewer cannot toggle (403)`, (await api('PATCH', `/api/admin/catalog/${kind}/${id}`, { cookie: vik, body: { active: false } })).status === 403)
  const off = await api('PATCH', `/api/admin/catalog/${kind}/${id}`, { cookie: sara, body: { active: false } })
  check(`[${kind}] operator switches it off`, off.status === 200 && off.json.item.active === false && off.json.item.updatedBy === 'Sara B.')
  check(`[${kind}] edit name and description`, (await api('PATCH', `/api/admin/catalog/${kind}/${id}`, { cookie: sara, body: { name: 'Renamed', description: 'Changed' } })).json?.item?.name === 'Renamed')
  check(`[${kind}] empty PATCH and bad image on PATCH -> 422`, (await api('PATCH', `/api/admin/catalog/${kind}/${id}`, { cookie: sara, body: {} })).status === 422 && (await api('PATCH', `/api/admin/catalog/${kind}/${id}`, { cookie: sara, body: { imageUrl: 'ftp://x' } })).status === 422)
  const other = kind === 'banner' ? 'cuisine' : 'banner'
  check(`[${kind}] an id from another kind is not found there (404)`, (await api('PATCH', `/api/admin/catalog/${other}/${id}`, { cookie: sara, body: { active: true } })).status === 404)
  const lst = await api('GET', `/api/admin/catalog/${kind}`, { cookie: vik })
  check(`[${kind}] list shows only this kind, newest first`, lst.json.total === 2 && lst.json.items[0].name === `${kind} local` && lst.json.items.every((x) => x.kind === kind))
  check(`[${kind}] search ".*" is literal, "renam" finds it`, (await api('GET', `/api/admin/catalog/${kind}?q=${encodeURIComponent('.*')}`, { cookie: vik })).json.items.length === 0 && (await api('GET', `/api/admin/catalog/${kind}?q=renam`, { cookie: vik })).json.items.length === 1)
}

// ── notifications: status and resend ─────────────────────────────────────────
const n1 = await api('POST', '/api/admin/notifications', { cookie: sara, body: { title: 'Maintenance', body: 'Tonight 23:00', audience: 'all' } })
const nid = n1.json.notification.id
check('notifications: viewer cannot change status or resend (403)', (await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: vik, body: { resend: true } })).status === 403)
check('notifications: rejects empty, both, unknown status (422)', (await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: {} })).status === 422 && (await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: { status: 'sent', resend: true } })).status === 422 && (await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: { status: 'done' } })).status === 422)
const sent = await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: { status: 'sent' } })
check('notifications: status -> sent, still honest that nothing was delivered', sent.status === 200 && sent.json.notification.status === 'sent' && sent.json.delivered === false)
await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: { resend: true } })
const rs = await api('PATCH', `/api/admin/notifications/${nid}`, { cookie: sara, body: { resend: true } })
check('notifications: resend puts it back to queued and counts (2)', rs.json.notification.status === 'queued' && rs.json.notification.resendCount === 2)
check('notifications: unknown / malformed id -> 404', (await api('PATCH', '/api/admin/notifications/000000000000000000000000', { cookie: sara, body: { resend: true } })).status === 404 && (await api('PATCH', '/api/admin/notifications/nope', { cookie: sara, body: { resend: true } })).status === 404)

// ── audit ────────────────────────────────────────────────────────────────────
const audit = await api('GET', '/api/admin/audit-logs?limit=200', { cookie: owner })
const acts = new Set(audit.json.entries.map((e) => e.action))
check('audit: updateTipping, updateCommission, createCatalogItem, updateCatalogItem, updateNotification all recorded', ['updateTipping', 'updateCommission', 'createCatalogItem', 'updateCatalogItem', 'updateNotification'].every((a) => acts.has(a)), [...acts].join(','))
const tipAudit = audit.json.entries.find((e) => e.action === 'updateTipping')
check('audit: tipping entry carries before/after, actor and email', JSON.stringify(tipAudit?.meta?.before) === '[5,10,20]' && JSON.stringify(tipAudit?.meta?.after) === '[0,15,30]' && tipAudit.actorName === 'Sara B.' && tipAudit.actorEmail === 'sara@example.test')
check('audit: filter by the new actions works', (await api('GET', '/api/admin/audit-logs?action=updateCommission', { cookie: owner })).json.entries.length >= 5 && (await api('GET', '/api/admin/audit-logs?action=updateCatalogItem', { cookie: owner })).json.entries.length >= 3)
check('audit: no entries for rejected requests (validation failures are not changes)', audit.json.entries.filter((e) => e.action === 'createCatalogItem').length === 6)

// ── old audit-log URL ────────────────────────────────────────────────────────
const old = await api('GET', '/fr/admin/audit-log', { redirect: 'manual' })
check('old /admin/audit-log redirects to /admin/audit-logs', [307, 308].includes(old.status) && /\/fr\/admin\/audit-logs$/.test(old.headers.get('location') || ''), `${old.status} ${old.headers.get('location')}`)

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exitCode = fail ? 1 : 0
