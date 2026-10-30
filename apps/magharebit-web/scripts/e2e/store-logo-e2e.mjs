// Store profile in the merchant portal. Store name: settings start with the name from sign-up or the activated
// lead, old blank documents are filled, a typed name is kept. Store logo: API rules (session, real type from the bytes, size cap, versioned public URL,
// caching, settings whitelist, delete, rate limit) and the settings page in headless Chrome (pick a large PNG,
// browser resizes to <= 512 px WebP, preview + sidebar avatar update without reload, survives reload, remove).
// Start (production build): MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_logo NEXT_DIST_DIR=.next-test npx next start -p 3021
// Run: APP_DIR=. BASE=http://localhost:3021 MONGODB_DB=magharebit_logo CHROME=<chrome.exe> PROFILE=<tmp dir> [OUT=<shots dir>] node scripts/e2e/store-logo-e2e.mjs
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'

const B = process.env.BASE || 'http://localhost:3021'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
// The secrets the server uses: .env.local for `next start`; set ENV_FILE=.env.development.local for `next dev` (it wins there)
const ENV_FILE = resolve(APP, process.env.ENV_FILE || '.env.local')
const SECRET = (readFileSync(ENV_FILE, 'utf8').match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_logo')
await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// The OTP search below takes a few seconds; Node's fetch can then reuse a keep-alive socket the server has
// just closed (5 s idle timeout) and fail with ECONNRESET before the request is sent. Retry that once.
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const post = (path, body, cookie) => fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
const findOtp = (phone, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${phone}:${SECRET}`).digest('hex') === hash) return String(n); return null }

// A real RGBA PNG (gradient), built by hand so the test needs no image library
function png(w, h) {
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0); return Buffer.concat([len, t, data, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { const o = y * (w * 4 + 1); for (let x = 0; x < w; x++) { const p = o + 1 + x * 4; raw[p] = (x * 255 / w) | 0; raw[p + 1] = 139; raw[p + 2] = (y * 255 / h) | 0; raw[p + 3] = 255 } }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const put = (body, cookie, type = 'image/png') => fetch(`${B}/api/portal/settings/logo`, { method: 'PUT', headers: { 'content-type': type, ...(cookie ? { cookie } : {}) }, body })

// ── a merchant through the real sign-up (phone OTP) ──────────────────────────
async function signup(name) {
  const local = '0663' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-6)
  const phone = '212' + local.slice(1)
  await post('/api/auth/send-otp', { phone: local, locale: 'ar' })
  const doc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
  const ver = await post('/api/auth/verify-otp', { phone: local, otp: findOtp(phone, doc.otp_hash), locale: 'ar' })
  const done = await post('/api/auth/complete-signup', { phone: local, storeName: name, sector: 'epicerie', city: 'Rabat', locale: 'ar' }, cookieOf(ver))
  const body = await done.json()
  return { local, key: body.licenseKey, cookie: cookieOf(done) }
}
const m1 = await signup('متجر الشعار')
check('sign-up opens a portal session', /portal_session=/.test(m1.cookie), m1.key)
const me1 = await (await fetch(`${B}/api/portal/auth/me`, { headers: { cookie: m1.cookie } })).json()
const id1 = me1.merchantId
const s0 = await (await fetch(`${B}/api/portal/settings`, { headers: { cookie: m1.cookie } })).json()
check('new merchant has no logo (settings + me)', s0.logoUrl === '' && me1.logoUrl === null)

// ── store name: settings start with the name given at sign-up / on the lead ─
check('settings.storeName = the sign-up store name', s0.storeName === 'متجر الشعار', s0.storeName)
const ADMIN = (readFileSync(ENV_FILE, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim()
const leadPhone = '06' + String(Date.now()).slice(-8)
await post('/api/leads', { storeName: 'Primeur Lead', phone: leadPhone, businessType: 'vegetables', city: 'Fès', locale: 'fr' })
const leadRow = await db.collection('leads').findOne({ phone: leadPhone })
const act = await (await fetch(`${B}/api/admin/leads/${leadRow.id}/activate`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN }, body: JSON.stringify({ plan: 'Starter', durationMonths: 1, notify: false }) })).json()
const leadLogin = await post('/api/portal/auth/login', { identifier: leadPhone, licenseKey: act.lead?.licenseKey })
const sLead = await (await fetch(`${B}/api/portal/settings`, { headers: { cookie: cookieOf(leadLogin) } })).json()
check('settings.storeName = the lead store name after admin activation', leadLogin.ok && sLead.storeName === 'Primeur Lead', sLead.storeName)
// a settings document created before this fix (blank name) is filled on the next read, once
const leadMerchant = await db.collection('merchants').findOne({ phone: '212' + leadPhone.slice(1) })
await db.collection('settings').updateOne({ merchantId: leadMerchant._id.toString() }, { $set: { storeName: '' } })
const sOld = await (await fetch(`${B}/api/portal/settings`, { headers: { cookie: cookieOf(leadLogin) } })).json()
check('an old blank settings document is filled from the merchant and saved', sOld.storeName === 'Primeur Lead' && (await db.collection('settings').findOne({ merchantId: leadMerchant._id.toString() })).storeName === 'Primeur Lead')
await fetch(`${B}/api/portal/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: cookieOf(leadLogin) }, body: JSON.stringify({ storeName: 'Primeur Atlas' }) })
const sTyped = await (await fetch(`${B}/api/portal/settings`, { headers: { cookie: cookieOf(leadLogin) } })).json()
check('a name the merchant typed is kept (not replaced by the sign-up name)', sTyped.storeName === 'Primeur Atlas')

// ── upload rules ─────────────────────────────────────────────────────────────
const small = png(64, 40)
check('no session -> 401', (await put(small)).status === 401)
check('SVG -> 415 (script-capable format refused)', (await put('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', m1.cookie, 'image/svg+xml')).status === 415)
check('text declared as image/png -> 415 (type comes from the bytes)', (await put('not an image at all', m1.cookie)).status === 415)
check('GIF -> 415', (await put(Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'), m1.cookie, 'image/gif')).status === 415)
const big = Buffer.concat([small, Buffer.alloc(600 * 1024)])
check('over 512 KB -> 413', (await put(big, m1.cookie)).status === 413)

const up = await put(small, m1.cookie, 'application/octet-stream')
const upBody = await up.json()
const sha = createHash('sha256').update(small).digest('hex')
check('valid PNG -> 200 with a versioned URL', up.status === 200 && upBody.logoUrl === `/api/stores/${id1}/logo?v=${sha.slice(0, 16)}`, upBody.logoUrl)
const stored = await db.collection('store_logos').findOne({ merchantId: id1 })
check('bytes stored once per merchant with the sniffed type', stored?.contentType === 'image/png' && stored.size === small.length && stored.sha256 === sha)

const img = await fetch(B + upBody.logoUrl)
const imgBytes = Buffer.from(await img.arrayBuffer())
check('public GET returns the same bytes as image/png', img.status === 200 && img.headers.get('content-type') === 'image/png' && imgBytes.equals(small))
check('versioned URL is cacheable for a year', /max-age=31536000/.test(img.headers.get('cache-control') || '') && /immutable/.test(img.headers.get('cache-control') || ''))
check('nosniff + sandbox CSP on the image', img.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(img.headers.get('content-security-policy') || ''))
const plain = await fetch(`${B}/api/stores/${id1}/logo`)
check('unversioned URL gets a short cache', plain.status === 200 && /max-age=300/.test(plain.headers.get('cache-control') || ''))
check('If-None-Match -> 304', (await fetch(B + upBody.logoUrl, { headers: { 'if-none-match': img.headers.get('etag') } })).status === 304)
check('unknown merchant -> 404, malformed id -> 404', (await fetch(`${B}/api/stores/${'0'.repeat(24)}/logo`)).status === 404 && (await fetch(`${B}/api/stores/..%2f..%2fetc/logo`)).status === 404)

const set1 = await (await fetch(`${B}/api/portal/settings`, { headers: { cookie: m1.cookie } })).json()
const me2 = await (await fetch(`${B}/api/portal/auth/me`, { headers: { cookie: m1.cookie } })).json()
check('settings.logoUrl and me.logoUrl point at the upload', set1.logoUrl === upBody.logoUrl && me2.logoUrl === upBody.logoUrl)
const patchOnly = await fetch(`${B}/api/portal/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: m1.cookie }, body: JSON.stringify({ logoUrl: 'https://evil.example/x.png' }) })
check('PATCH cannot set logoUrl (not whitelisted -> 422)', patchOnly.status === 422)
const patchMix = await (await fetch(`${B}/api/portal/settings`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: m1.cookie }, body: JSON.stringify({ storeName: 'متجر الشعار', logoUrl: '' }) })).json()
check('a settings save (or "reset") keeps the logo', patchMix.logoUrl === upBody.logoUrl)

const m2 = await signup('متجر آخر')
const up2 = await (await put(png(10, 10), m2.cookie)).json()
const after1 = await fetch(B + upBody.logoUrl)
check("another merchant's upload does not touch the first logo", up2.logoUrl.includes((await (await fetch(`${B}/api/portal/auth/me`, { headers: { cookie: m2.cookie } })).json()).merchantId) && Buffer.from(await after1.arrayBuffer()).equals(small))

// ── settings page in Chrome ──────────────────────────────────────────────────
const bigFile = join(tmpdir(), `mgh-logo-${process.pid}.png`); writeFileSync(bigFile, png(1600, 900))
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9347', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9347/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

// sign in through the real portal login form (phone + license key, no OTP on this page)
const m3 = await signup('Épicerie Logo')
await send('Page.navigate', { url: `${B}/ar/portal/login` })
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setInput = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setInput(0, m3.local); await setInput(1, m3.key)
await js(`document.querySelector('form button[type=submit]').click()`)
check('portal login with phone + license key reaches the dashboard', await waitFor(`location.pathname.startsWith('/ar/portal/dashboard')`))

await send('Page.navigate', { url: `${B}/ar/portal/settings` })
check('settings page shows the upload zone', await waitFor(`!!document.querySelector('[data-testid=store-logo-pick]') && !document.querySelector('[data-testid=store-logo-img]')`))
await shot('logo-1-empty')
const { root } = (await send('DOM.getDocument')).result
const { nodeId } = (await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#store-logo-input' })).result
await send('DOM.setFileInputFiles', { nodeId, files: [bigFile] })
check('picking a 1600x900 PNG shows the saved logo', await waitFor(`(() => { const i = document.querySelector('[data-testid=store-logo-img]'); return !!i && i.complete && i.naturalWidth > 0 })()`))
const dims = await js(`(() => { const i = document.querySelector('[data-testid=store-logo-img]'); return [i.naturalWidth, i.naturalHeight, i.getAttribute('src')] })()`)
check('browser resized it to 512 px on the long side', dims[0] === 512 && dims[1] === 288, JSON.stringify(dims))
const doc3 = await db.collection('store_logos').findOne({ merchantId: dims[2].split('/')[3] })
check('uploaded as WebP, far smaller than the original', doc3?.contentType === 'image/webp' && doc3.size < 60_000, `${doc3?.contentType} ${doc3?.size} B`)
check('sidebar avatar shows the logo without a reload', await waitFor(`document.querySelector('[data-testid=sidebar-store-logo]')?.getAttribute('src') === ${JSON.stringify(dims[2])}`))
await shot('logo-2-uploaded')
await send('Page.reload'); await sleep(1500)
check('logo is still there after a reload', await waitFor(`document.querySelector('[data-testid=store-logo-img]')?.getAttribute('src') === ${JSON.stringify(dims[2])}`))

await js(`window.confirm = () => true; document.querySelector('[data-testid=store-logo-remove]').click(); true`)
check('remove clears the preview and the sidebar falls back to the initial', await waitFor(`!document.querySelector('[data-testid=store-logo-img]') && !document.querySelector('[data-testid=sidebar-store-logo]')`))
check('removed logo is gone from the public URL', (await fetch(B + dims[2])).status === 404)
await shot('logo-3-removed')

// a GIF picked in the browser is refused before upload
writeFileSync(bigFile.replace('.png', '.gif'), Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'))
const n2 = (await send('DOM.querySelector', { nodeId: (await send('DOM.getDocument')).result.root.nodeId, selector: '#store-logo-input' })).result.nodeId
await send('DOM.setFileInputFiles', { nodeId: n2, files: [bigFile.replace('.png', '.gif')] })
check('a GIF shows an inline error and uploads nothing', await waitFor(`/الصيغة غير مدعومة/.test(document.querySelector('[role=alert]')?.textContent || '')`) && !(await db.collection('store_logos').findOne({ merchantId: dims[2].split('/')[3] })))
check('no console errors or exceptions on the settings page', problems.filter((p) => !/404/.test(p)).length === 0, problems.join(' | '))
chrome.kill()

// ── delete + rate limit (API) ────────────────────────────────────────────────
const del = await (await fetch(`${B}/api/portal/settings/logo`, { method: 'DELETE', headers: { cookie: m1.cookie } })).json()
check('DELETE clears logoUrl and the image', del.logoUrl === '' && (await fetch(B + upBody.logoUrl)).status === 404)
let last = 0
for (let i = 0; i < 25; i++) last = (await put(small, m2.cookie)).status
check('rate limit: 20 changes per 10 min per merchant -> 429', last === 429)

rmSync(bigFile, { force: true }); rmSync(bigFile.replace('.png', '.gif'), { force: true })
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
