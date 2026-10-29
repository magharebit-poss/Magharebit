// Phase 5 API against a running server + real MongoDB: Command Center metrics (Morocco day boundaries, same-time
// comparison, 7-day window, licenses, online/24 h terminals, cache + fresh), exports (roles, audit-first, CSV BOM and
// formula guard, xlsx, filters, no license keys) and global search (roles, Arabic variants, groups).
// DROPS the database it uses. Start the server with MONGODB_DB=magharebit_p5.
// Run: APP_DIR=. BASE=http://localhost:3031 MONGODB_DB=magharebit_p5 [OUT=dir to keep the exported files] node scripts/e2e/phase5-api-e2e.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3031'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const PW = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim()
const req = createRequire(`${APP}/package.json`)
const { MongoClient, ObjectId } = req('mongodb')
const { unzipSync, strFromU8 } = req('fflate')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_p5')
await db.dropDatabase()

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  return { status: res.status, json: await res.clone().json().catch(() => null), res, cookie: sc ? sc.split(';')[0] : null }
}

// ── Morocco "today", computed independently of the app code ──────────────────
const TZ = 'Africa/Casablanca'
const keyOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const hourOf = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d))
function midnightOf(key) { for (const off of ['+01:00', '+00:00']) { const d = new Date(`${key}T00:00:00${off}`); if (keyOf(d) === key && hourOf(d) === 0) return d } throw new Error('no midnight for ' + key) }
const now = new Date()
const todayKey = keyOf(now)
const todayStart = midnightOf(todayKey)
const yKey = keyOf(new Date(todayStart.getTime() - 3600_000))
const yStart = midnightOf(yKey)
const elapsed = now.getTime() - todayStart.getTime()
const daysAgoKey = (n) => { let d = todayStart; for (let i = 0; i < n; i++) d = midnightOf(keyOf(new Date(d.getTime() - 3600_000))); return keyOf(d) }

// ── Seed ──────────────────────────────────────────────────────────────────────
const m1 = new ObjectId(), m2 = new ObjectId()
await db.collection('merchants').insertMany([
  { _id: m1, phone: '212600000001', storeName: 'مخبزة الأمل', sector: 'boulangerie', city: 'Rabat', locale: 'ar', createdAt: new Date(now - 9e6), status: 'approved', plan: 'Business', commissionRate: 5.5, subscriptionEndsAt: new Date('2027-06-30T12:00:00Z') },
  { _id: m2, phone: '212600000002', storeName: 'Café Atlas', sector: 'cafe-restaurant', city: 'Fès', locale: 'fr', createdAt: new Date(now - 8e6), status: 'approved', plan: 'Starter' },
  { phone: '212600000009', storeName: 'Pending Shop', sector: 'epicerie', city: 'Agadir', locale: 'fr', createdAt: new Date(now - 7e6), status: 'pending' },
  { phone: '212600000008', storeName: 'Suspended Shop', sector: 'epicerie', city: 'Tanger', locale: 'fr', createdAt: new Date(now - 6e6), status: 'suspended' },
])
const min = 60_000, hour = 3600_000, dayMs = 86_400_000
await db.collection('licenses').insertMany([
  { id: 'LIC-P5-1', key: 'MGH-202610-AAAA1111-BBBB-C1', merchantId: '212600000001', storeName: 'مخبزة الأمل', plan: 'Business', durationMonths: 12, issuedAt: new Date(now - 30 * dayMs), expiresAt: new Date(+now + 200 * dayMs), status: 'active',
    terminals: [{ machineId: 'T1', firstSeenAt: new Date(now - 9 * dayMs), lastSeenAt: new Date(now - 5 * min) }, { machineId: 'T2', firstSeenAt: new Date(now - 9 * dayMs), lastSeenAt: new Date(now - 2 * hour) }] },
  { id: 'LIC-P5-2', key: 'MGH-202610-CCCC2222-DDDD-C2', merchantId: '212600000002', storeName: 'Café Atlas', plan: 'Starter', durationMonths: 0, durationDays: 14, isTrial: true, issuedAt: new Date(now - 11 * dayMs), expiresAt: new Date(+now + 3 * dayMs), status: 'active',
    terminals: [{ machineId: 'T3', firstSeenAt: new Date(now - 9 * dayMs), lastSeenAt: new Date(now - 30 * hour) }] },
  // status still says active but the date has passed (expiry is swept lazily): not an active license
  { id: 'LIC-P5-3', key: 'MGH-202609-EEEE3333-FFFF-C3', merchantId: '212600000003', storeName: 'Lapsed', plan: 'Starter', durationMonths: 1, issuedAt: new Date(now - 40 * dayMs), expiresAt: new Date(now - dayMs), status: 'active',
    terminals: [{ machineId: 'T4', firstSeenAt: new Date(now - 30 * dayMs), lastSeenAt: new Date(now - 1 * min) }] },
  { id: 'LIC-P5-4', key: 'MGH-202601-99999999-0000-C4', merchantId: '212600000004', storeName: 'Revoked', plan: 'Starter', durationMonths: 12, issuedAt: new Date(now - 300 * dayMs), expiresAt: new Date(+now + 60 * dayMs), status: 'revoked' },
])
await db.collection('leads').insertMany([
  { id: 'lead_p5_1', storeName: 'Épicerie Nour', phone: '0661000001', businessType: 'grocery', city: 'Salé', locale: 'fr', submittedAt: new Date(now - 3 * hour).toISOString(), status: 'new' },
  { id: 'lead_p5_2', storeName: '=HYPERLINK("http://evil.test","x")', phone: '0661000002', businessType: 'other', city: 'Rabat', locale: 'en', submittedAt: new Date(now - 2 * hour).toISOString(), status: 'new' },
  { id: 'lead_p5_3', storeName: 'أحمد للخضر', phone: '0661000003', businessType: 'vegetables', city: 'Meknès', locale: 'ar', submittedAt: new Date(now - hour).toISOString(), status: 'contacted', licenseKey: 'MGH-SECRET-LEADKEY-0001', notes: 'private note' },
])
await db.collection('coupons').insertOne({ id: 'cpn_p5', code: 'RAMADAN25', kind: 'percent', value: 25, description: 'Ramadan', redeemed: 0, active: true, createdAt: new Date(), createdBy: 'owner' })

let rcpt = 1000
const sale = (merchant, at, total, extra = {}) => ({ merchantId: merchant.toHexString(), receiptNo: `#${++rcpt}`, items: [{ productId: 'p', plu: '1', name: 'Pain', qty: 2, unitPrice: total / 2, total }], subtotal: total, discountType: 'amount', discountValue: 0, discount: 0, totalHT: total, taxRate: 0, taxAmount: 0, total, paymentMethod: 'cash', createdAt: at, customerId: 'cust_secret', ...extra })
await db.collection('transactions').insertMany([
  sale(m1, todayStart, 10),                                            // first instant of today -> today
  sale(m1, new Date(+todayStart + elapsed * 0.25), 100.5),
  sale(m2, new Date(+todayStart + elapsed * 0.5), 49.5, { paymentMethod: 'card', employeeName: 'Samir' }),
  sale(m1, new Date(+yStart + elapsed * 0.25), 60),                     // yesterday, before "same time"
  sale(m2, new Date(+yStart + elapsed + (todayStart - yStart - elapsed) / 2), 40), // yesterday, after "same time"
  sale(m1, new Date(+todayStart - 1), 7),                               // last ms of yesterday
  sale(m1, new Date(+midnightOf(daysAgoKey(3)) + 10 * hour), 25),
  sale(m2, new Date(+midnightOf(daysAgoKey(8)) + 10 * hour), 999),      // outside the 7-day window
])
await db.collection('rate_limits').deleteMany({})

// ── Sessions ──────────────────────────────────────────────────────────────────
const owner = (await api('POST', '/api/admin/login', { body: { password: PW } })).cookie
check('owner signs in', !!owner)
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'p5op', displayName: 'Operator P5', role: 'operator', password: 'operator-long-password-1' } })
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'p5view', displayName: 'Viewer P5', role: 'viewer', password: 'viewer-long-password-1' } })
const operator = (await api('POST', '/api/admin/login', { body: { username: 'p5op', password: 'operator-long-password-1' } })).cookie
const viewer = (await api('POST', '/api/admin/login', { body: { username: 'p5view', password: 'viewer-long-password-1' } })).cookie
check('operator and viewer accounts sign in', !!operator && !!viewer)

// ── Dashboard ─────────────────────────────────────────────────────────────────
check('dashboard: anonymous -> 401', (await api('GET', '/api/admin/dashboard')).status === 401)
const d = await api('GET', '/api/admin/dashboard?fresh=1', { cookie: owner })
const m = d.json
check('dashboard: owner -> 200, private no-store', d.status === 200 && /no-store/.test(d.res.headers.get('cache-control') || ''), String(d.status))
check('revenue today = 160 over 3 sales (includes the first instant of the day)', m.revenue.today === 160 && m.revenue.todayCount === 3, JSON.stringify(m.revenue))
check('yesterday at the same time = 60 (1 sale); full day = 107 (3 sales, incl. its last ms)', m.revenue.yesterdaySameTime === 60 && m.revenue.yesterdaySameTimeCount === 1 && m.revenue.yesterdayFull === 107 && m.revenue.yesterdayCount === 3)
check('change vs same time yesterday = +166.7 %', m.revenue.changePct === 166.7, String(m.revenue.changePct))
const keys = m.salesByDay.map((x) => x.date)
check('7 Morocco days, oldest first, today last', m.salesByDay.length === 7 && keys[6] === todayKey && keys[5] === yKey && keys[0] === daysAgoKey(6), keys.join(' '))
check('3-days-ago sale on its day; empty days are 0; the 8-day-old sale is excluded', m.salesByDay[3].total === 25 && m.salesByDay[1].total === 0 && m.salesByDay.reduce((s, x) => s + x.total, 0) === 160 + 107 + 25)
check('licenses: 2 active (date-expired one excluded), 1 trial, 1 expiring within 7 days', m.licenses.active === 2 && m.licenses.trials === 1 && m.licenses.expiringSoon === 1, JSON.stringify(m.licenses))
check('terminals: 2 online (15 min), 3 seen in 24 h; merchants 2 online / 2 in 24 h', m.terminals.online === 2 && m.terminals.seen24h === 3 && m.terminals.merchantsOnline === 2 && m.terminals.merchantsSeen24h === 2, JSON.stringify(m.terminals))
check('merchants 2 approved / 1 pending; 2 new leads', m.merchants.approved === 2 && m.merchants.pending === 1 && m.leads.new === 2)
check('activity feed = latest audit entries (the owner sign-in is there)', Array.isArray(m.activity) && m.activity.some((e) => e.action === 'adminLogin') && m.activity.length <= 8)
check('time zone reported', m.timeZone === TZ)
check('viewer may read the dashboard', (await api('GET', '/api/admin/dashboard', { cookie: viewer })).status === 200)

await db.collection('transactions').insertOne(sale(m2, new Date(now - 1000), 40))
const cached = (await api('GET', '/api/admin/dashboard', { cookie: owner })).json
const freshAgain = (await api('GET', '/api/admin/dashboard?fresh=1', { cookie: owner })).json
check('cached for 30 s; ?fresh=1 recomputes (new sale appears)', cached.revenue.today === 160 && freshAgain.revenue.today === 200 && freshAgain.revenue.todayCount === 4, `${cached.revenue.today} / ${freshAgain.revenue.today}`)

// ── Export ────────────────────────────────────────────────────────────────────
const exp = (cookie, path) => fetch(`${B}/api/admin/export/${path}`, { headers: cookie ? { cookie } : {} })
check('export: anonymous -> 401', (await exp(null, 'leads?format=csv')).status === 401)
const vr = await exp(viewer, 'leads?format=xlsx')
check('export: viewer -> 403 forbidden (personal data)', vr.status === 403 && (await vr.json()).error === 'forbidden')
check('export: unknown dataset -> 404, bad format -> 422', (await exp(operator, 'customers?format=csv')).status === 404 && (await exp(operator, 'leads?format=pdf')).status === 422)
check('export: reversed or junk sales range -> 422', (await exp(operator, 'sales?format=csv&from=2026-10-10&to=2026-10-01')).status === 422 && (await exp(operator, 'sales?format=csv&from=junk')).status === 422)

const auditBefore = await db.collection('audit_logs').countDocuments({ action: 'exportData' })
const leadsCsv = await exp(operator, 'leads?format=csv&locale=fr')
const csvText = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await leadsCsv.arrayBuffer())
if (OUT) writeFileSync(`${OUT}/leads-fr.csv`, csvText)
check('leads CSV: 200, text/csv, attachment name, row count header', leadsCsv.status === 200 && /^text\/csv/.test(leadsCsv.headers.get('content-type')) && /attachment; filename="magharebit_leads_\d{4}-\d{2}-\d{2}\.csv"/.test(leadsCsv.headers.get('content-disposition')) && leadsCsv.headers.get('x-export-rows') === '3')
check('leads CSV: BOM, French headers, CRLF', csvText.startsWith('﻿Date de demande,Commerce,Téléphone') && csvText.includes('\r\n'))
check('leads CSV: formula-looking shop name neutralised with an apostrophe', csvText.includes(`"'=HYPERLINK(""http://evil.test"",""x"")"`), csvText.split('\r\n')[2])
check('leads CSV: Arabic name intact; no license key, no notes', csvText.includes('أحمد للخضر') && !csvText.includes('MGH-SECRET') && !csvText.includes('private note'))
check('leads CSV: business types translated (vegetables -> Fruits et légumes)', csvText.includes(',Fruits et légumes,') && !csvText.includes(',vegetables,'))
const audit = await db.collection('audit_logs').find({ action: 'exportData' }).sort({ ts: -1 }).limit(1).next()
check('export written to the audit log first (actor, dataset, format, rows)', (await db.collection('audit_logs').countDocuments({ action: 'exportData' })) === auditBefore + 1 && audit.actorName === 'Operator P5' && audit.targetType === 'export' && audit.targetId === 'leads' && audit.meta.format === 'csv' && audit.meta.rows === 3)
check('audit-logs API filters on exportData', (await api('GET', '/api/admin/audit-logs?action=exportData', { cookie: owner })).json?.entries?.length >= 1)

const leadsNew = await exp(operator, 'leads?format=csv&status=new&q=nour')
check('leads export honours the screen filters (status + q)', leadsNew.headers.get('x-export-rows') === '1' && (await leadsNew.text()).includes('Épicerie Nour'))

const xr = await exp(owner, 'commission-rates?format=xlsx&locale=ar')
const xbuf = new Uint8Array(await xr.arrayBuffer())
if (OUT) writeFileSync(`${OUT}/commission-rates-ar.xlsx`, xbuf)
const files = unzipSync(xbuf)
const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
check('commission xlsx: 200, spreadsheet MIME, valid zip with a sheet', xr.status === 200 && xr.headers.get('content-type') === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !!files['xl/workbook.xml'])
check('commission xlsx: approved merchants only (2), Arabic headers, RTL sheet', xr.headers.get('x-export-rows') === '2' && sheet.includes('العمولة (%)') && sheet.includes('rightToLeft="1"') && !sheet.includes('Pending Shop') && !sheet.includes('Suspended Shop'))
check('commission xlsx: rate is a number cell, unset rate left empty', /<c r="G\d+"><v>5\.5<\/v><\/c>/.test(sheet) && sheet.includes('مخبزة الأمل') && sheet.includes('Café Atlas'))

const sr = await exp(operator, `sales?format=xlsx&locale=en&from=${daysAgoKey(1)}&to=${todayKey}`)
const sbuf = new Uint8Array(await sr.arrayBuffer())
if (OUT) writeFileSync(`${OUT}/sales-en.xlsx`, sbuf)
const ssheet = strFromU8(unzipSync(sbuf)['xl/worksheets/sheet1.xml'])
check('sales xlsx: yesterday + today = 7 sales (incl. the new one), named after the range', sr.headers.get('x-export-rows') === '7' && new RegExp(`magharebit_portal-sales_${daysAgoKey(1)}_${todayKey}\\.xlsx`).test(sr.headers.get('content-disposition')), sr.headers.get('x-export-rows'))
check('sales xlsx: merchant names resolved, payment labelled, no customer id', ssheet.includes('Café Atlas') && ssheet.includes('Card') && ssheet.includes('Samir') && !ssheet.includes('cust_secret'))
const sdef = await exp(operator, 'sales?format=csv&locale=fr')
check('sales export defaults to the last 7 days (excludes the 8-day-old sale)', sdef.headers.get('x-export-rows') === '8' && !(await sdef.text()).includes('999'), sdef.headers.get('x-export-rows'))

// ── Search ────────────────────────────────────────────────────────────────────
const s = (cookie, q) => api('GET', `/api/admin/search?q=${encodeURIComponent(q)}`, { cookie })
check('search: anonymous -> 401; one character -> 422', (await s(null, 'ab')).status === 401 && (await s(owner, 'a')).status === 422)
const sAr = await s(viewer, 'احمد')
check('search (viewer allowed): "احمد" finds the lead "أحمد للخضر"', sAr.status === 200 && sAr.json?.results?.leads.some((h) => h.title === 'أحمد للخضر' && h.q === '0661000003'))
check('search: status is a code for the UI to translate, details kept apart (no raw English subtitle)', sAr.json?.results?.leads.some((h) => h.status === 'contacted' && Array.isArray(h.details) && h.details.includes('0661000003') && !('subtitle' in h)))
const sMer = await s(owner, 'مخبزه')
check('search: "مخبزه" finds the merchant "مخبزة الأمل" (and its license)', sMer.json?.results?.merchants.some((h) => h.title === 'مخبزة الأمل' && h.q === '212600000001') && sMer.json?.results?.licenses.some((h) => h.title === 'MGH-202610-AAAA1111-BBBB-C1'))
const sKey = await s(owner, 'cccc2222')
check('search: license key fragment, case-insensitive', sKey.json?.results?.licenses.length === 1 && sKey.json?.results?.licenses[0].q === 'MGH-202610-CCCC2222-DDDD-C2')
check('search: coupon code', (await s(owner, 'ramadan')).json?.results?.coupons.some((h) => h.title === 'RAMADAN25'))
check('search: regex characters are literal (no 500)', (await s(owner, '.*(')).status === 200 && (await s(owner, '.*(')).json?.results?.merchants.length === 0)
check('search: results never include license keys of leads', !JSON.stringify((await s(owner, '0661')).json).includes('MGH-SECRET'))

// ── Admin pages carry no marketing chrome; public pages still do ──────────────
for (const lang of ['fr', 'ar']) {
  const admin = await (await fetch(`${B}/${lang}/admin`)).text()
  const home = await (await fetch(`${B}/${lang}`)).text()
  check(`[${lang}] /admin HTML has no WhatsApp button or trust ribbon; the home page still has the button`, !admin.includes('wa-ring-wrapper') && !admin.includes('wa.me/') && home.includes('wa-ring-wrapper'))
}

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exitCode = fail ? 1 : 0
