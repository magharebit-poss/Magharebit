// Merchant portal app shell in headless Chrome (fr + ar): real login (phone + license key), all 8 nav links,
// direction and sidebar edge per language, icon rail at 1100 px (toggle remembered across reloads), mobile drawer
// at 375 px (inline-start edge, focus inside, Escape, focus returns), offline (persistent banner, write blocked with an
// auto-dismissing toast, recovery), server down (health 503 -> degraded banner), session expiry (401 -> toast ->
// login), no console errors. Drops its database.
// Start: MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_shell npx next start -p 3021   (or next dev)
// Run:   APP_DIR=. BASE=http://localhost:3021 MONGODB_DB=magharebit_shell CHROME=<chrome.exe> PROFILE=<tmp> [OUT=<shots>] [ENV_FILE=.env.development.local] node scripts/e2e/portal-shell-e2e.mjs
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3021'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const ENV = readFileSync(resolve(APP, process.env.ENV_FILE || '.env.local'), 'utf8')
const SECRET = (ENV.match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_shell')
await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
const post = (path, body, cookie) => fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }

// a merchant through the real sign-up
const local = '0664' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await post('/api/auth/send-otp', { phone: local, locale: 'fr' })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await post('/api/auth/verify-otp', { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' })
const done = await (await post('/api/auth/complete-signup', { phone: local, storeName: 'Épicerie Atlas', sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookieOf(ver))).json()
check('test merchant signed up', /^MGH-/.test(done.licenseKey || ''), done.licenseKey)

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9351', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9351/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const problems = []; const fetchHooks = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160))
  if (d.method === 'Fetch.requestPaused') for (const h of fetchHooks) h(d.params)
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const view = (w, h = 900) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
const goto = async (u) => { await send('Page.navigate', { url: B + u }); await sleep(800) }
const shellReady = `(() => { const t = document.querySelector('[data-testid=shell-title]'); return !!t && Object.keys(t).some(k => k.startsWith('__react')) && !!document.querySelector('[data-testid=shell-store-name]')?.textContent.replace('…', '').trim() })()`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

// ── login through the real form ──────────────────────────────────────────────
await view(1440)
await goto('/fr/portal/login')
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setInput = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setInput(0, local); await setInput(1, done.licenseKey)
await js(`document.querySelector('form button[type=submit]').click()`)
check('portal login (phone + key) lands in the shell', await waitFor(`location.pathname === '/fr/portal/dashboard'`) && await waitFor(shellReady))

// ── fr desktop ───────────────────────────────────────────────────────────────
const layout = `(() => { const a = document.querySelector('[data-testid=shell-sidebar]'); const r = a.getBoundingClientRect(); const act = a.querySelector('[aria-current=page]'); const bar = act?.querySelector('span[aria-hidden=true]'); const br = bar?.getBoundingClientRect(), ar = act?.getBoundingClientRect(); return { dir: document.querySelector('[data-testid=shell-title]').closest('[dir]').getAttribute('dir'), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), vw: document.documentElement.clientWidth, title: document.querySelector('[data-testid=shell-title]').textContent, groups: [...a.querySelectorAll('nav p')].map(p => p.textContent), active: act?.textContent.trim(), barSide: br && ar ? (Math.abs(br.left - ar.left) < 2 ? 'left' : Math.abs(br.right - ar.right) < 2 ? 'right' : '?') : null, barOpacity: bar && getComputedStyle(bar).opacity, store: a.querySelector('[data-testid=shell-store-name]').textContent, status: document.querySelector('[data-testid=shell-status]').dataset.state, bodyDir: document.querySelector('#main-content > div').getAttribute('dir') } })()`
let L = await js(layout)
check('fr: shell is LTR, sidebar docked on the left at 264 px', L.dir === 'ltr' && L.left === 0 && L.w === 264, JSON.stringify({ left: L.left, w: L.w }))
check('fr: French title, 4 group headers', L.title === 'Tableau de bord' && L.groups.join('|') === 'Vente|Gestion|Croissance|Compte', L.groups.join('|'))
check('fr: active item has the gold start-edge bar on the left', L.active === 'Tableau de bord' && L.barSide === 'left' && L.barOpacity === '1', `${L.active} ${L.barSide}`)
check('fr: store card shows the signed-up name, status online', L.store === 'Épicerie Atlas' && L.status === 'online', `${L.store} ${L.status}`)
check('page bodies stay Arabic RTL inside the French shell (D1)', L.bodyDir === 'rtl')
await shot('fr-1440-dashboard')

const slugs = ['products', 'customers', 'purchases', 'employees', 'marketing', 'reports', 'settings', 'dashboard']
const titles = { products: 'Produits', customers: 'Clients', purchases: 'Achats', employees: 'Employés', marketing: 'Marketing', reports: 'Rapports', settings: 'Paramètres', dashboard: 'Tableau de bord' }
for (const s of slugs) {
  await js(`document.querySelector('[data-testid=shell-sidebar] a[href="/fr/portal/${s}"]').click()`)
  const ok = await waitFor(`location.pathname === '/fr/portal/${s}' && document.querySelector('[data-testid=shell-title]').textContent === ${JSON.stringify(titles[s])} && document.querySelector('[data-testid=shell-sidebar] [aria-current=page]')?.getAttribute('href') === '/fr/portal/${s}'`, 120000)
  check(`nav → ${s}: page, title and active item follow`, ok)
}

// ── ar desktop ───────────────────────────────────────────────────────────────
await js(`[...document.querySelectorAll('header nav a')].find(a => a.textContent === 'AR').click()`)
await waitFor(`location.pathname === '/ar/portal/dashboard'`)
await waitFor(shellReady)
L = await js(layout)
check('ar: language switch keeps the page; shell RTL, sidebar on the right', L.dir === 'rtl' && L.right === L.vw && L.w === 264, JSON.stringify({ right: L.right, vw: L.vw }))
check('ar: Arabic labels, active bar on the right (start edge)', L.title === 'لوحة التحكم' && L.groups[0] === 'البيع' && L.barSide === 'right', `${L.title} ${L.barSide}`)
await shot('ar-1440-dashboard')

// ── icon rail at 1100 px ─────────────────────────────────────────────────────
await js(`localStorage.removeItem('mgh-portal-rail'); true`)
await view(1100)
await goto('/fr/portal/dashboard'); await waitFor(shellReady)
const railW = () => js(`Math.round(document.querySelector('[data-testid=shell-sidebar]').getBoundingClientRect().width)`)
await sleep(400)
check('1100 px: icon rail by default (72 px), labels still named', (await railW()) === 72 && await js(`document.querySelector('[data-testid=shell-sidebar] a[href="/fr/portal/products"]').getAttribute('aria-label') === 'Produits'`))
await js(`document.querySelector('[data-testid=shell-sidebar] button[aria-label="Agrandir le menu"]').click()`); await sleep(400)
check('rail toggle expands to 264 px', (await railW()) === 264)
await goto('/fr/portal/dashboard'); await waitFor(shellReady); await sleep(400)
check('the choice is remembered after a reload', (await railW()) === 264)
await js(`document.querySelector('[data-testid=shell-sidebar] button[aria-label="Réduire le menu"]').click()`); await sleep(400)
check('and can be collapsed again', (await railW()) === 72)
await shot('fr-1100-rail')

// ── mobile drawer at 375 px ──────────────────────────────────────────────────
for (const [lang, edge] of [['fr', 'left'], ['ar', 'right']]) {
  await view(375, 812)
  await goto(`/${lang}/portal/dashboard`); await waitFor(shellReady)
  check(`${lang} 375 px: docked sidebar hidden, no horizontal scroll`, await js(`getComputedStyle(document.querySelector('[data-testid=shell-sidebar]')).display === 'none' && document.documentElement.scrollWidth <= innerWidth`))
  await js(`document.querySelector('[data-testid=shell-menu]').focus(); document.querySelector('[data-testid=shell-menu]').click(); true`); await sleep(450)
  const d = await js(`(() => { const d = document.querySelector('[data-testid=shell-drawer]'); const r = d.getBoundingClientRect(); return { open: d.open, left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth, focusInside: d.contains(document.activeElement) } })()`)
  check(`${lang} 375 px: drawer opens from the ${edge} edge with focus inside`, d.open && d.focusInside && (edge === 'left' ? Math.abs(d.left) <= 2 : Math.abs(d.right - d.vw) <= 2), JSON.stringify(d))
  await shot(`${lang}-375-drawer`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(300)
  check(`${lang} 375 px: Escape closes it and focus returns to the menu button`, await js(`!document.querySelector('[data-testid=shell-drawer]').open && document.activeElement === document.querySelector('[data-testid=shell-menu]')`))
  if (lang === 'fr') {
    await js(`document.querySelector('[data-testid=shell-menu]').click(); true`); await sleep(400)
    await js(`document.querySelector('[data-testid=shell-drawer] a[href="/fr/portal/reports"]').click(); true`)
    check('fr 375 px: a drawer link navigates and closes the drawer', await waitFor(`location.pathname === '/fr/portal/reports' && !document.querySelector('[data-testid=shell-drawer]').open`))
  }
}

// ── offline ──────────────────────────────────────────────────────────────────
await view(1440)
await goto('/fr/portal/settings'); await waitFor(shellReady)
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
check('offline: status pill and persistent banner appear', await waitFor(`document.querySelector('[data-testid=shell-status]').dataset.state === 'offline' && /Hors ligne/.test(document.querySelector('[data-testid=shell-banner]')?.textContent || '')`, 15000))
check('offline banner is a warning (amber), not red, and has no close button', await js(`(() => { const b = document.querySelector('[data-testid=shell-banner]'); return getComputedStyle(b).backgroundColor === 'rgb(255, 248, 225)' && !b.querySelector('button') })()`))
const blocked = await js(`fetch('/api/portal/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{"storeName":"X"}' }).then(() => 'sent', (e) => e.name)`)
check('offline: a portal write is refused at once', blocked === 'OfflineWriteError', blocked)
check('offline: a toast explains why', await waitFor(`/hors ligne/i.test(document.querySelector('[data-testid=shell-toasts]').textContent)`, 3000))
await shot('fr-1440-offline')
check('the toast dismisses itself after a few seconds', await waitFor(`document.querySelector('[data-testid=shell-toasts]').children.length === 0`, 9000))
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
check('back online: status returns to online and the banner goes', await waitFor(`document.querySelector('[data-testid=shell-status]').dataset.state === 'online' && !document.querySelector('[data-testid=shell-banner]')`, 20000))
check('the merchant was never written while offline', (await db.collection('settings').findOne({ storeName: 'X' })) === null)

// ── server down (health 503) ─────────────────────────────────────────────────
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/health*' }] })
fetchHooks.push((p) => send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 503, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from('{"server":"ok","db":"error"}').toString('base64') }))
await js(`window.dispatchEvent(new Event('online')); true`)
check('server down: degraded state with its own banner (not "offline")', await waitFor(`document.querySelector('[data-testid=shell-status]').dataset.state === 'degraded' && /serveur/i.test(document.querySelector('[data-testid=shell-banner]')?.textContent || '')`, 15000))
fetchHooks.length = 0
await send('Fetch.disable')
await js(`window.dispatchEvent(new Event('online')); true`)
check('server back: online again', await waitFor(`document.querySelector('[data-testid=shell-status]').dataset.state === 'online'`, 15000))

// ── session expiry ───────────────────────────────────────────────────────────
await send('Network.deleteCookies', { name: 'portal_session', url: B })
await js(`fetch('/api/portal/auth/me'); true`)
check('session expired: a toast, then the portal login', await waitFor(`/expiré/.test(document.querySelector('[data-testid=shell-toasts]')?.textContent || '')`, 5000) && await waitFor(`location.pathname === '/fr/portal/login'`, 15000))

const relevant = problems.filter((p) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|401|503|offline_write_blocked/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
