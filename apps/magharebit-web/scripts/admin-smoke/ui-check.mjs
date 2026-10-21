// Admin UI browser check (headless Chrome over CDP): sign-in, audit table, filters, admins page, roles, 375px layout, fr + ar.
// Needs a dev server with the in-memory stand-in on :3020 (see README.md), Chrome, and env CHROME, PROFILE, OUT, ENV_FILE (LANGS=fr,ar).
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'

const B = 'http://localhost:3020'
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const OWNER_PW = readFileSync(process.env.ENV_FILE, 'utf8').match(/^ADMIN_SECRET=(.*)$/m)[1]
const MID = '64b7f0c2a1b2c3d4e5f60718'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 1. seed activity through the real API so the tables have rows ──────────────
async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: OWNER_PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'sara', displayName: 'Sara B.', email: 'sara@example.test', role: 'operator', password: 'sara-long-password-1' } })
const sara = (await api('POST', '/api/admin/login', { body: { username: 'sara', password: 'sara-long-password-1' } })).cookie
await api('POST', `/api/admin/merchants/${MID}/approve`, { cookie: sara, body: { plan: 'Business', durationMonths: 6 } })
await api('POST', `/api/admin/merchants/${MID}/revoke`, { cookie: sara, body: { reason: 'demo', notify: false } })
console.log('seeded via API')

// ── 2. drive headless Chrome over CDP ──────────────────────────────────────────
const profile = process.env.PROFILE
rmSync(profile, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${profile}`, '--remote-debugging-port=9333', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const consoleErrors = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') consoleErrors.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') consoleErrors.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(r.result.data, 'base64')); console.log('screenshot', name) }
const waitFor = async (expr, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evalJs(expr)) return true; await sleep(400) } return false }
const goto = async (url) => { await send('Page.navigate', { url }); await sleep(1500) }
const setValue = (sel, val) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)

await send('Page.enable'); await send('Runtime.enable')
const results = []
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Network.enable'); await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}/admin/audit-log`)
  check(`[${lang}] sign-in form shown when logged out`, await waitFor(`!!document.querySelector('#adm-pass')`, 120000))
  await shot(`${lang}-1-signin`)

  // wrong password, then owner (empty username)
  await setValue('#adm-pass', 'wrong-password'); await evalJs(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] wrong password shows an alert`, await waitFor(`!!document.querySelector('[role=alert]')`, 120000))
  await setValue('#adm-pass', OWNER_PW); await evalJs(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] owner signs in, audit table appears`, await waitFor(`document.querySelectorAll('table tbody tr').length > 1`, 60000))
  const rows = await evalJs(`[...document.querySelectorAll('table tbody tr')].map(r => r.innerText.replace(/\\s+/g,' ').trim())`)
  check(`[${lang}] rows show 'Performed by' name + email and the API action key`, rows.some((r) => r.includes('Sara B.') && r.includes('sara@example.test') && r.includes('API: revokeKey')), `rows=${rows.length}`)
  check(`[${lang}] timestamps read dd/mm/yyyy hh:mm:ss`, rows.every((r) => /\d{2}\/\d{2}\/\d{4}[, ]+\d{2}:\d{2}:\d{2}/.test(r)), rows[0]?.slice(0, 30))
  check(`[${lang}] dir attribute matches language`, (await evalJs(`document.querySelector('[dir]').getAttribute('dir')`)) === (lang === 'ar' ? 'rtl' : 'ltr'))
  check(`[${lang}] header shows actor and role`, (await evalJs(`document.body.innerText`)).includes('owner'))
  await shot(`${lang}-2-audit`)

  // filter by action
  await evalJs(`(() => { const s = document.querySelector('select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'revokeKey'); s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('form button[type=submit]').click() })()`)
  await sleep(2500)
  const filtered = await evalJs(`[...document.querySelectorAll('table tbody tr')].map(r => r.innerText)`)
  check(`[${lang}] action filter narrows to revokeKey only`, filtered.length === 1 && filtered[0].includes('revokeKey'), `rows=${filtered.length}`)

  // admins page
  await goto(`${B}/${lang}/admin/admins`)
  check(`[${lang}] admins table lists sara with email`, await waitFor(`document.body.innerText.includes('sara@example.test')`, 60000))
  await shot(`${lang}-3-admins`)

  // mobile layout
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await goto(`${B}/${lang}/admin/audit-log`)
  await waitFor(`document.querySelectorAll('table tbody tr').length > 0`, 60000)
  const overflow = await evalJs(`document.documentElement.scrollWidth - innerWidth`)
  check(`[${lang}] mobile 375px: no page-level horizontal overflow`, overflow <= 0, `overflow=${overflow}`)
  await shot(`${lang}-4-mobile`)
  const menuBtn = await evalJs(`!!document.querySelector('button[aria-expanded]')`)
  check(`[${lang}] mobile: menu button present`, menuBtn)
  check(`[${lang}] mobile: filter fields stay inside the viewport`, await evalJs(`[...document.querySelectorAll('form input, form select')].every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 })`))
}

// viewer cannot open the admins page content; operator sees no Admins link
await send('Network.clearBrowserCookies')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
await goto(`${B}/fr/admin/admins`)
await waitFor(`!!document.querySelector('#adm-pass')`, 60000)
await setValue('#adm-user', 'sara'); await setValue('#adm-pass', 'sara-long-password-1'); await evalJs(`document.querySelector('form button[type=submit]').click()`)
// sara was never disabled in this script
await waitFor(`document.body.innerText.includes('Sara B.')`, 60000)
const txt = await evalJs(`document.body.innerText`)
check('operator sees owner-only notice on Admins page', txt.includes('réservée au propriétaire'))
check('operator nav has no Admins link', !(await evalJs(`!!document.querySelector('nav a[href$="/admin/admins"]')`)))

check('no console errors / exceptions during the run', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
console.log(`\n${results.filter(Boolean).length} passed, ${results.filter((x) => !x).length} failed`)
ws.close(); chrome.kill()
process.exit(results.every(Boolean) ? 0 : 1)
