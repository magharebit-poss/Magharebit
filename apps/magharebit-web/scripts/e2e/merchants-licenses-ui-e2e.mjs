// Merchants + Licenses pages in the console shell (headless Chrome over CDP), real MongoDB, v2 signing key on the server.
// Start the server as described in license-v2-e2e.mjs (needs LICENSE_SIGNING_* so terminals can be registered).
// Env: APP_DIR, OUT, PROFILE, CHROME, BASE (default http://localhost:3021), MONGODB_DB (default magharebit_ml_ui), LANGS (default fr,ar)
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const OUT = process.env.OUT; mkdirSync(OUT, { recursive: true })
const OWNER_PW = readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m)[1]
const { MongoClient, ObjectId } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_ml_ui'); await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'vik', displayName: 'Vik Viewer', role: 'viewer', password: 'viewer-long-password-1' } })

// ── seed (per language so each run owns its data) ───────────────────────────────────────────────
const S = {}
async function seed(lang) {
  const tag = lang.toUpperCase()
  const pendingId = new ObjectId()
  await db.collection('merchants').insertOne({ _id: pendingId, phone: `2126${lang === 'fr' ? '1' : '2'}0000001`, storeName: `Epicerie Pending ${tag}`, sector: 'epicerie', city: 'Rabat', locale: lang, createdAt: new Date(), status: 'pending' })
  const make = async (storeName, phone, sector, plan) => {
    const id = new ObjectId()
    await db.collection('merchants').insertOne({ _id: id, phone, storeName, sector, city: 'Fes', locale: lang, createdAt: new Date(), status: 'pending' })
    const r = await api('POST', `/api/admin/merchants/${id}/approve`, { cookie: owner, body: { plan, durationMonths: 12 } })
    return { id: String(id), key: r.json?.license?.key, licId: r.json?.license?.id, phone }
  }
  const toggle = await make(`Boulangerie Toggle ${tag}`, `2126${lang === 'fr' ? '1' : '2'}0000002`, 'boulangerie', 'Starter')
  const lic = await make(`Cafe Licence ${tag}`, `2126${lang === 'fr' ? '1' : '2'}0000003`, 'cafe-restaurant', 'Business')
  for (const m of ['TERMINAL-AAAA-0001', 'TERMINAL-BBBB-0002']) await api('POST', '/api/licenses/activate', { body: { key: lic.key, machineId: m + tag } })
  S[lang] = { pendingId: String(pendingId), toggle, lic, tag }
}

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9337', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9337/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const errs = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ')) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const timer = setTimeout(() => { pending.delete(i); console.log('WARN cdp timeout', method); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(timer); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); if (!r.result?.data) return console.log('WARN no screenshot', n); writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')); console.log('screenshot', n) }
const waitFor = async (e, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(400) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1500) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const clickText = (sel, text) => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true })()`)
const hydrated = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`
const rowCount = `document.querySelectorAll('table tbody tr td:nth-child(2)').length`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

const T = {
  fr: { approve: 'Approuver et générer la clé', release: 'Libérer', extend: 'Prolonger', revokeBtn: 'Révoquer cette licence', apply: 'Appliquer', active: 'Active', revoked: 'Révoquée' },
  ar: { approve: 'قبول وإنشاء المفتاح', release: 'تحرير', extend: 'تمديد', revokeBtn: 'إلغاء هذا الترخيص', apply: 'تطبيق', active: 'نشط', revoked: 'ملغى' },
}
const KEY_RE = 'MGH-\\\\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}'

for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  await seed(lang)
  const d = S[lang], t = T[lang]
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}/admin/merchants`)
  check(`[${lang}] sign-in shown`, await waitFor(`!!document.querySelector('#adm-pass') && ${hydrated('#adm-pass')}`))
  await setVal('#adm-user', 'sara'); await setVal('#adm-pass', 'sara-long-password-1'); await js(`document.querySelector('form button[type=submit]').click()`)

  // ── Merchants list + filters ───────────────────────────────────────────────────────────────
  check(`[${lang}] merchants table loads inside the console shell`, await waitFor(`${rowCount} >= 3 && !!document.querySelector('nav a[href$="/admin/licenses"]')`))
  check(`[${lang}] legacy standalone gate is gone (no ?secret field outside shell)`, (await js(`document.querySelectorAll('input[type=password]').length`)) === 0)
  await shot(`${lang}-1-merchants-light`)
  const apiList = await api('GET', `/api/admin/merchants?q=${encodeURIComponent(d.tag)}&sector=boulangerie`, { cookie: owner })
  check(`[${lang}] API filter sector+q returns exactly the bakery`, apiList.json?.merchants?.length === 1 && apiList.json.merchants[0].storeName.includes('Toggle'))
  // search regex characters are literal
  const rx = await api('GET', '/api/admin/merchants?q=' + encodeURIComponent('.*'), { cookie: owner })
  check(`[${lang}] search ".*" is treated as literal text (no match-all)`, rx.status === 200 && rx.json.merchants.length === 0)
  await setVal('input[type=search], form input:not([type])', `Toggle ${d.tag}`)
  await clickText('form button[type=submit]', t.apply)
  check(`[${lang}] UI search narrows to one row`, await waitFor(`${rowCount} === 1 && document.querySelector('table tbody tr').innerText.includes('Toggle ${d.tag}')`))

  // ── Toggle suspend/activate ────────────────────────────────────────────────────────────────
  const sw = `table tbody tr button[role=switch]`
  check(`[${lang}] switch shows active (checked)`, (await js(`document.querySelector('${sw}')?.getAttribute('aria-checked')`)) === 'true')
  await js(`document.querySelector('${sw}').click()`)
  check(`[${lang}] switching off suspends the merchant (UI)`, await waitFor(`document.querySelector('${sw}')?.getAttribute('aria-checked') === 'false'`, 60000))
  const v1 = await api('POST', '/api/licenses/validate', { body: { key: d.toggle.key } })
  check(`[${lang}] POS validate now refuses the suspended merchant`, v1.json?.valid === false, JSON.stringify(v1.json))
  await js(`document.querySelector('${sw}').click()`)
  check(`[${lang}] switching on reactivates`, await waitFor(`document.querySelector('${sw}')?.getAttribute('aria-checked') === 'true'`, 60000))
  const v2 = await api('POST', '/api/licenses/validate', { body: { key: d.toggle.key } })
  check(`[${lang}] POS validate accepts again`, v2.json?.valid === true)

  // ── Approve pending from drawer (dark theme on purpose) ─────────────────────────────────────
  await goto(`${B}/${lang}/admin/merchants`)
  await waitFor(`${rowCount} >= 3`)
  await js(`(() => { const all = [...document.querySelectorAll('button[role=switch]')]; const th = all.find(b => !b.closest('table')); th && th.click() })()`); await sleep(600)
  check(`[${lang}] dark theme applied on merchants page`, (await js(`document.querySelector('.admin-theme').getAttribute('data-theme')`)) === 'dark')
  await clickText('table tbody tr button', `Pending ${d.tag}`)
  check(`[${lang}] pending merchant opens a drawer`, await waitFor(`!!document.querySelector('[role=dialog]')`))
  await setVal('[role=dialog] select', 'Business')
  await shot(`${lang}-2-merchant-drawer-dark`)
  await clickText('[role=dialog] button', t.approve)
  check(`[${lang}] approval creates a real key shown in the drawer`, await waitFor(`new RegExp('${KEY_RE}').test(document.querySelector('[role=dialog]')?.innerText || '')`, 120000))
  const key = await js(`(document.querySelector('[role=dialog]').innerText.match(new RegExp('${KEY_RE}')) || [''])[0]`)
  const v3 = await api('POST', '/api/licenses/validate', { body: { key } })
  check(`[${lang}] approved key validates (plan Business)`, v3.json?.valid === true && v3.json.plan === 'Business', key)
  const m = await db.collection('merchants').findOne({ _id: new ObjectId(d.pendingId) })
  check(`[${lang}] merchant row is approved with subscription fields`, m?.status === 'approved' && m.plan === 'Business' && !!m.subscriptionEndsAt)
  await shot(`${lang}-3-merchant-approved-dark`)

  // ── Licenses page ───────────────────────────────────────────────────────────────────────────
  await goto(`${B}/${lang}/admin/licenses`)
  check(`[${lang}] licenses table loads`, await waitFor(`${rowCount} >= 3`))
  await shot(`${lang}-4-licenses-dark`)
  await js(`(() => { const th = [...document.querySelectorAll('button[role=switch]')].find(b => !b.closest('table')); th && th.getAttribute('aria-checked') === 'true' && th.click() })()`); await sleep(500)
  await setVal('form input:not([type])', d.lic.key)
  await clickText('form button[type=submit]', t.apply)
  check(`[${lang}] search by key finds exactly one license`, await waitFor(`${rowCount} === 1 && document.querySelector('table tbody tr').innerText.includes('${d.lic.key}')`))
  const termsCell = await js(`document.querySelector('table tbody tr td:nth-child(6)').innerText`)
  check(`[${lang}] terminals column reads 2 / 3`, /2\s*\/\s*3/.test(termsCell || ''), termsCell)
  await clickText('table tbody tr button', d.lic.key)
  check(`[${lang}] license drawer opens with 2 terminals`, await waitFor(`!!document.querySelector('[role=dialog]') && document.querySelectorAll('[role=dialog] ul li').length === 2`))
  await shot(`${lang}-5-license-drawer-light`)

  // release a terminal
  await clickText('[role=dialog] button', t.release)
  check(`[${lang}] releasing a terminal removes it (1 / 3 left)`, await waitFor(`document.querySelectorAll('[role=dialog] ul li').length === 1`, 60000))
  const lrow = await db.collection('licenses').findOne({ id: d.lic.licId })
  check(`[${lang}] database agrees: one terminal left`, (lrow?.terminals ?? []).length === 1)

  // extend by 3 months
  const before = new Date(lrow.expiresAt).getTime()
  await setVal('[role=dialog] select', '3')
  await clickText('[role=dialog] button', t.extend)
  let lrow2 = lrow
  for (let i = 0; i < 300 && new Date(lrow2.expiresAt).getTime() === before; i++) { await sleep(1000); lrow2 = await db.collection('licenses').findOne({ id: d.lic.licId }) }
  check(`[${lang}] extend shows success notice`, await waitFor(`/Done|Fait|تم/.test(document.querySelector('[role=status]')?.innerText || '') && ![...document.querySelectorAll('[role=dialog] button')].some(b => b.disabled && b.innerText.includes(${JSON.stringify(t.extend)}))`, 120000))
  const gain = (new Date(lrow2.expiresAt).getTime() - before) / 86400000
  check(`[${lang}] expiry moved forward about 3 months`, gain > 88 && gain < 93, `${gain.toFixed(1)} days`)

  // revoke needs the confirmation box
  const revBtn = `[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.includes(${JSON.stringify(t.revokeBtn)}))`
  check(`[${lang}] revoke button disabled until confirmation is ticked`, await js(`${revBtn}.disabled`))
  await js(`document.querySelector('[role=dialog] input[type=checkbox]').click()`)
  check(`[${lang}] ticking enables revoke`, await waitFor(`!${revBtn}.disabled`, 120000))
  await js(`${revBtn}.click()`)
  check(`[${lang}] revoke succeeds`, await waitFor(`!document.querySelector('[role=dialog] input[type=checkbox]')`, 240000))
  const v4 = await api('POST', '/api/licenses/validate', { body: { key: d.lic.key } })
  check(`[${lang}] POS validate refuses the revoked key`, v4.json?.valid === false, JSON.stringify(v4.json))

  // mobile layout
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await goto(`${B}/${lang}/admin/licenses`)
  await waitFor(`${rowCount} >= 1`)
  check(`[${lang}] licenses 375px: no page-level horizontal overflow`, (await js(`document.documentElement.scrollWidth - innerWidth`)) <= 0)
  await goto(`${B}/${lang}/admin/merchants`)
  await waitFor(`${rowCount} >= 1`)
  check(`[${lang}] merchants 375px: no page-level horizontal overflow`, (await js(`document.documentElement.scrollWidth - innerWidth`)) <= 0)
  await shot(`${lang}-6-mobile`)
  await js(`localStorage.removeItem('mgh-admin-theme')`)
}

// viewer is read-only
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Network.clearBrowserCookies')
await goto(`${B}/en/admin/licenses`)
await waitFor(`!!document.querySelector('#adm-pass') && ${hydrated('#adm-pass')}`)
await setVal('#adm-user', 'vik'); await setVal('#adm-pass', 'viewer-long-password-1'); await js(`document.querySelector('form button[type=submit]').click()`)
await waitFor(`${rowCount} >= 1`)
await clickText('table tbody tr button', 'MGH-')
await waitFor(`!!document.querySelector('[role=dialog]')`)
const vtxt = await js(`document.querySelector('[role=dialog]').innerText`)
check('viewer: drawer is read-only (no Extend/Revoke controls)', /read-only/i.test(vtxt) && !/Revoke this license/.test(vtxt), vtxt.replace(/s+/g, ' ').slice(0, 160))

// API-level guards
const vlogin = await api('POST', '/api/admin/login', { body: { username: 'vik', password: 'viewer-long-password-1' } })
const some = (await api('GET', '/api/licenses', { cookie: owner })).json?.licenses?.[0]
const forb = await api('POST', `/api/admin/licenses/${some.id}/extend`, { cookie: vlogin.cookie, body: { months: 1 } })
check('viewer: extend API is 403', forb.status === 403)
const unauth = await api('GET', '/api/admin/merchants')
check('merchants list without a session is 401', unauth.status === 401)

const audit = await api('GET', '/api/admin/audit-logs?limit=100', { cookie: owner })
const acts = new Set((audit.json?.entries || []).map((e) => e.action))
check('audit has approve, extend, revoke, release, suspend and reactivate entries', ['approveMerchant', 'extendSubscription', 'revokeKey', 'releaseTerminal', 'suspendMerchant', 'reactivateMerchant'].every((a) => acts.has(a)), [...acts].join(','))
check('no console errors / exceptions', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await mongo.close()
process.exit(fail ? 1 : 0)
