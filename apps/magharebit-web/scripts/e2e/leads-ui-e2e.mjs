// Leads page + theme toggle in headless Chrome (CDP), against a dev server on real MongoDB.
// Env: APP_DIR, OUT, PROFILE, CHROME, BASE (default http://localhost:3021), MONGODB_DB (default magharebit_leads_ui)
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const OUT = process.env.OUT; mkdirSync(OUT, { recursive: true })
const OWNER_PW = readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m)[1]
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_leads'); await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
for (const [n, p] of [['Boulangerie Atlas', '0661111111'], ['Cafe Medina', '0662222222'], ['Epicerie Nour', '0663333333']]) {
  await api('POST', '/api/leads', { body: { storeName: n, phone: p, businessType: 'bakery', city: 'Rabat', locale: 'fr' } })
}

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9336', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9336/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const errs = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ')) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')); console.log('screenshot', n) }
const waitFor = async (e, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(400) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1500) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const clickText = (sel, text) => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true })()`)
const hydrated = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

const L = { fr: { open: 'Boulangerie Atlas', gen: 'Générer la clé de licence', ok: 'Activé' }, ar: { open: 'Cafe Medina', gen: 'إنشاء مفتاح الترخيص', ok: 'تم التفعيل' } }
for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}/admin/leads`)
  check(`[${lang}] sign-in shown (no standalone legacy gate)`, await waitFor(`!!document.querySelector('#adm-pass') && ${hydrated('#adm-pass')}`))
  await setVal('#adm-user', 'sara'); await setVal('#adm-pass', 'sara-long-password-1'); await js(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] leads table loads inside the console shell`, await waitFor(`document.querySelectorAll('table tbody tr td:nth-child(7)').length >= 1 && !!document.querySelector('nav a[href$="/admin/audit-log"]')`))
  const first = await js(`document.querySelector('table tbody tr td:nth-child(7)')?.innerText`)
  check(`[${lang}] submitted date renders (no Invalid Date)`, /\d{2}\/\d{2}\/\d{4}/.test(first || ''), first)
  await shot(`${lang}-1-leads-light`)

  // theme toggle
  const sw = `button[role=switch]`
  check(`[${lang}] theme switch present, light by default`, (await js(`document.querySelector('${sw}')?.getAttribute('aria-checked')`)) === 'false')
  await js(`document.querySelector('${sw}').click()`); await sleep(600)
  const dark = await js(`(() => { const r = document.querySelector('.admin-theme'); return [r.getAttribute('data-theme'), getComputedStyle(r).backgroundColor] })()`)
  check(`[${lang}] switching sets dark theme with Pine Green background`, dark?.[0] === 'dark' && dark?.[1] === 'rgb(10, 35, 24)', JSON.stringify(dark))
  await shot(`${lang}-2-leads-dark`)
  await send('Page.reload'); await sleep(1500)
  check(`[${lang}] dark theme persists after reload`, await waitFor(`!!document.querySelector('.admin-theme') && document.querySelector('.admin-theme').getAttribute('data-theme') === 'dark'`))

  // open a lead and activate it (dark theme on purpose: drawer must be readable there too)
  await waitFor(`document.querySelectorAll('table tbody tr td:nth-child(7)').length >= 1`)
  await clickText('table tbody tr button', L[lang].open); await sleep(800)
  check(`[${lang}] detail drawer opens`, await waitFor(`!!document.querySelector('[role=dialog]')`))
  await setVal('[role=dialog] select', 'Business')
  await shot(`${lang}-3-drawer-dark`)
  await clickText('[role=dialog] button', L[lang].gen)
  check(`[${lang}] activation succeeds, real key shown`, await waitFor(`/MGH-\\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}/.test(document.querySelector('[role=dialog]')?.innerText || '')`, 120000))
  check(`[${lang}] success notice and audit note shown`, ((await js(`document.querySelector('[role=dialog]')?.innerText`)) || '').includes(L[lang].ok))
  await shot(`${lang}-4-activated-dark`)
  const keyText = await js(`(document.querySelector('[role=dialog]').innerText.match(/MGH-\\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}/) || [''])[0]`)
  const v = await api('POST', '/api/licenses/validate', { body: { key: keyText } })
  check(`[${lang}] the key shown validates for the POS`, v.json?.valid === true && v.json.plan === 'Business', keyText)

  // back to light, mobile layout
  await js(`document.querySelector('${sw}').click()`); await sleep(500)
  check(`[${lang}] switching back restores light`, (await js(`document.querySelector('.admin-theme').getAttribute('data-theme')`)) === 'light')
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await goto(`${B}/${lang}/admin/leads`)
  await waitFor(`document.querySelectorAll('table tbody tr td:nth-child(7)').length >= 1`)
  check(`[${lang}] mobile 375px: no page-level horizontal overflow`, (await js(`document.documentElement.scrollWidth - innerWidth`)) <= 0)
  await shot(`${lang}-5-mobile`)
  await js(`localStorage.removeItem('mgh-admin-theme')`)
}

const audit = await api('GET', '/api/admin/audit-logs?action=activateLead', { cookie: owner })
check('audit log shows both activations by Sara B. with email', audit.json?.entries?.length === 2 && audit.json.entries.every((e) => e.actorName === 'Sara B.' && e.actorEmail === 'sara@example.test'))
check('no console errors / exceptions', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await mongo.close()
process.exit(fail ? 1 : 0)
