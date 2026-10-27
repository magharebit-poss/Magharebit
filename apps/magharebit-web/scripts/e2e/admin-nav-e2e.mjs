// Admin sidebar navigation: sign in, click every sidebar link (client-side routing) and fail on any
// console error, uncaught exception, failed request or non-OK RSC response. Also loads every page directly.
// Env: APP_DIR, OUT, PROFILE, CHROME, BASE (default http://localhost:3026), LANGS (default fr,ar)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const B = process.env.BASE || 'http://localhost:3026'
const APP = process.env.APP_DIR || process.cwd()
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const PW = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim() || process.env.ADMIN_PW
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9343', '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9343/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); let problems = []; const reqs = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  const p = d.params
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n').slice(0, 2).join(' | '))
  if (d.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push('ERR ' + p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
  if (d.method === 'Network.requestWillBeSent') reqs.set(p.requestId, p.request.url)
  if (d.method === 'Network.responseReceived' && /_rsc=|\/api\//.test(p.response.url)) {
    const u = p.response.url.replace(B, '')
    if (p.response.status >= 400 && !/\/api\/admin\/session/.test(u)) problems.push(`HTTP ${p.response.status} ${u}`)
    if (/_rsc=/.test(u) && !/text\/x-component/.test(p.response.mimeType + ';' + (p.response.headers['content-type'] || ''))) problems.push(`RSC response is not text/x-component: ${p.response.mimeType} ${u}`)
  }
  if (d.method === 'Network.loadingFailed' && !p.canceled) problems.push(`FAILED ${p.errorText} ${(reqs.get(p.requestId) || '').replace(B, '')}`)
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 60000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1200) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

const PAGES = ['merchants', 'licenses', 'leads', 'commission-rates', 'tipping', 'shop-types', 'cuisines', 'banners', 'coupons', 'notifications', 'audit-logs', 'admins']
for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  await send('Network.clearBrowserCookies')
  problems = []
  await goto(`${B}/${lang}/admin/leads`)
  check(`[${lang}] sign-in form appears and hydrates`, await waitFor(`(() => { const el = document.querySelector('#adm-pass'); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`))
  await setVal('#adm-pass', PW)
  await js(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] signed in, sidebar visible`, await waitFor(`document.querySelectorAll('nav a[href*="/admin/"]').length >= 12`))
  await sleep(1500)

  // client-side navigation through every sidebar link, twice, in two orders
  for (const order of [PAGES, [...PAGES].reverse()]) {
    for (const p of order) {
      await waitFor(`document.querySelectorAll('nav a[href*="/admin/"]').length >= 12`, 120000)
      const before = problems.length
      const clicked = await js(`(() => { const a = document.querySelector('nav a[href$="/admin/${p}"]'); if (!a) return false; a.click(); return true })()`)
      if (!clicked) { check(`[${lang}] sidebar link ${p} exists`, false); continue }
      const ok = await waitFor(`location.pathname.endsWith('/admin/${p}') && !!document.querySelector('main h1, section h1, h1')`, 120000)
      await sleep(700)
      const newProblems = problems.slice(before)
      check(`[${lang}] click -> /admin/${p} renders with no console/network error`, ok && newProblems.length === 0, newProblems.slice(0, 3).join(' || '))
    }
  }

  // direct loads (full page, not client navigation)
  for (const p of PAGES) {
    const before = problems.length
    await goto(`${B}/${lang}/admin/${p}`)
    const ok = await waitFor(`!!document.querySelector('h1')`, 120000)
    await sleep(500)
    check(`[${lang}] direct load /admin/${p}`, ok && problems.slice(before).length === 0, problems.slice(before).slice(0, 3).join(' || '))
  }
  if (OUT) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); if (r.result?.data) writeFileSync(`${OUT}/nav-${lang}.jpg`, Buffer.from(r.result.data, 'base64')) }
}
console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill()
process.exitCode = fail ? 1 : 0
