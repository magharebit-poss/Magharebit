// Phase 5 UI in headless Chrome (fr + ar): Command Center (KPIs, 7-day chart order in LTR/RTL, hover tooltip, table
// view, activity feed), Ctrl+K palette (pages, Arabic data search, keyboard, deep link into a filtered table),
// exports (download from the leads page, viewer blocked), 375 px layout, dark theme, console clean.
// Run AFTER phase5-api-e2e.mjs on the same database (it reuses that seed).
// Env: APP_DIR, OUT (screenshots), DL (download dir), PROFILE, CHROME, BASE, MONGODB_DB (default magharebit_p5), LANGS
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3031'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const DL = resolve(process.env.DL || `${APP}/.p5-downloads`); rmSync(DL, { recursive: true, force: true }); mkdirSync(DL, { recursive: true })
const PW = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_p5')
await db.collection('rate_limits').deleteMany({})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9345', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9345/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
const bws = new WebSocket((await (await fetch('http://127.0.0.1:9345/json/version')).json()).webSocketDebuggerUrl); await new Promise((r) => (bws.onopen = r))
let id = 0; const pending = new Map(); let problems = []
const onMsg = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  const p = d.params
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push('ERR ' + p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
}
ws.onmessage = onMsg; bws.onmessage = onMsg
const sendOn = (sock, method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 60000); pending.set(i, (d) => { clearTimeout(t); res(d) }); sock.send(JSON.stringify({ id: i, method, params })) })
const send = (method, params) => sendOn(ws, method, params)
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72, captureBeyondViewport: true }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1200) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const key = async (k, code, mods = 0, text) => {
  const vk = { Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, k: 75 }[k] ?? 0
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, modifiers: mods, windowsVirtualKeyCode: vk })
}
const hydrated = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`
const login = async (lang, user) => {
  await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}/admin`)
  await waitFor(hydrated('#adm-pass'))
  if (user) await setVal('#adm-user', user.u)
  await setVal('#adm-pass', user ? user.p : PW)
  await js(`document.querySelector('form button[type=submit]').click()`)
  return waitFor(`!!document.querySelector('[data-kpi="revenue-today"]')`)
}
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await sendOn(bws, 'Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true })

const ctrlK = () => key('k', 'KeyK', 2) // modifiers: 2 = Ctrl

for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  const rtl = lang === 'ar'
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  problems = []
  check(`[${lang}] owner signs in at /admin and lands on the Command Center`, await login(lang))
  check(`[${lang}] sidebar: Overview group + 13 links, Command Center current`, await js(`(() => { const a = [...document.querySelectorAll('nav a')]; return document.querySelectorAll('nav p').length === 5 && a.length === 13 && a[0].getAttribute('href') === '/${lang}/admin' && a[0].getAttribute('aria-current') === 'page' })()`))
  await waitFor(`document.querySelectorAll('[data-day]').length === 7`)
  const kpi = await js(`Object.fromEntries([...document.querySelectorAll('[data-kpi]')].map(e => [e.dataset.kpi, e.innerText.replace(/\\s+/g, ' ').trim()]))`)
  check(`[${lang}] KPI: portal sales today 200,00 MAD, change shown with arrow and sign`, /200,00/.test(kpi['revenue-today']) && /▲\s*\+233,3\s*%/.test(kpi['revenue-change']), JSON.stringify(kpi))
  check(`[${lang}] KPI: 2 active licenses, 2 merchants online, 24 h line, 2 approved merchants`, kpi['licenses-active'] === '2' && /2$/.test(kpi['merchants-online']) && /2.*3/.test(kpi['seen-24h']) && kpi['merchants-approved'] === '2')
  check(`[${lang}] the revenue card says it is web portal only`, await js(`/${rtl ? 'البوابة فقط' : 'Portail web uniquement'}/.test(document.querySelector('[data-kpi="revenue-today"]').parentElement.innerText)`))
  // the band hit-rects, not the bars: an empty day has no bar geometry
  const xs = await js(`[...document.querySelectorAll('[data-day]')].map(g => Number(g.querySelector('rect').getAttribute('x')))`)
  check(`[${lang}] chart drawn at real size: day labels are 11+ px on screen`, await js(`[...document.querySelectorAll('[data-day] text')].every(t => t.getBoundingClientRect().height >= 11)`))
  check(`[${lang}] French plural is "terminaux", never "terminalaux"`, !(await js(`document.body.innerText.includes('terminalaux')`)))
  check(`[${lang}] chart: oldest day on the ${rtl ? 'right' : 'left'}, today on the ${rtl ? 'left' : 'right'}`, rtl ? xs[0] > xs[6] : xs[0] < xs[6], JSON.stringify(xs.map(Math.round)))
  check(`[${lang}] chart: today labelled, today's bar uses the highlight colour`, await js(`(() => { const g = [...document.querySelectorAll('[data-day]')].pop(); return /${rtl ? 'اليوم' : 'Aujourd’hui'}/.test(g.textContent) && g.querySelector('path').getAttribute('fill') === 'var(--adm-chart-today)' })()`))
  await js(`[...document.querySelectorAll('[data-day]')][6].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))`)
  check(`[${lang}] chart: hovering a day shows its amount and sale count`, await waitFor(`(() => { const t = document.querySelector('section [role=status]'); return !!t && /200,00/.test(t.innerText) && /4/.test(t.innerText) })()`, 5000))
  await js(`document.querySelector('section details summary').click()`)
  check(`[${lang}] chart: table view lists the 7 days`, await waitFor(`document.querySelectorAll('section details tbody tr').length === 7`, 5000))
  check(`[${lang}] activity feed lists recent audit entries`, await js(`document.querySelectorAll('[data-activity] li').length >= 3`))
  await shot(`${lang}-1-command-center`)

  // ── Ctrl+K palette ──────────────────────────────────────────────────────────
  await ctrlK()
  check(`[${lang}] Ctrl+K opens the search dialog with focus in the input`, await waitFor(`!!document.querySelector('dialog[open] input[role=combobox]') && document.activeElement === document.querySelector('dialog[open] input')`, 5000))
  check(`[${lang}] empty query lists the pages`, await js(`document.querySelectorAll('dialog[open] [role=option]').length === 13`))
  await setVal('dialog[open] input', 'pourboire')
  check(`[${lang}] "pourboire" (French word, any UI language) finds the Tipping page`, await waitFor(`(() => { const o = [...document.querySelectorAll('dialog[open] [role=option]')]; return o.length >= 1 && o[0].dataset.href === '/${lang}/admin/tipping' })()`, 5000))
  await key('Escape', 'Escape')
  check(`[${lang}] Esc closes the palette`, await waitFor(`!document.querySelector('dialog[open]')`, 5000))
  await js(`document.querySelector('[data-palette-trigger]').click()`)
  await waitFor(`!!document.querySelector('dialog[open] input')`, 5000)
  await setVal('dialog[open] input', 'احمد')
  check(`[${lang}] "احمد" finds the lead "أحمد للخضر" (alef variant) from the server`, await waitFor(`[...document.querySelectorAll('dialog[open] [role=option]')].some(o => o.innerText.includes('أحمد للخضر'))`, 8000))
  await shot(`${lang}-2-palette`)
  const idx = await js(`[...document.querySelectorAll('dialog[open] [role=option]')].findIndex(o => o.innerText.includes('أحمد للخضر'))`)
  for (let i = 0; i < idx; i++) await key('ArrowDown', 'ArrowDown')
  check(`[${lang}] arrow keys move the active option (aria-activedescendant)`, await js(`document.querySelector('dialog[open] input').getAttribute('aria-activedescendant') === 'pal-opt-${idx}' && document.querySelector('#pal-opt-${idx}').getAttribute('aria-selected') === 'true'`))
  await key('Enter', 'Enter')
  check(`[${lang}] Enter opens the leads table filtered on that lead`, await waitFor(`location.pathname === '/${lang}/admin/leads' && new URLSearchParams(location.search).get('q') === '0661000003' && [...document.querySelectorAll('tbody tr')].length === 1 && document.querySelector('tbody').innerText.includes('أحمد للخضر')`, 30000))

  // ── Export from the leads page ──────────────────────────────────────────────
  const before = readdirSync(DL).length
  await js(`document.querySelector('[data-export="xlsx"]').click()`)
  check(`[${lang}] leads Excel export: status message with the row count`, await waitFor(`[...document.querySelectorAll('[role=status]')].some(s => /1/.test(s.innerText) && /${rtl ? 'تصدير' : 'export'}/i.test(s.innerText))`, 15000))
  const t0 = Date.now(); while (Date.now() - t0 < 10000 && readdirSync(DL).filter((f) => f.endsWith('.xlsx')).length <= before) await sleep(300)
  const got = readdirSync(DL).filter((f) => /^magharebit_leads_.*\.xlsx$/.test(f))
  check(`[${lang}] the browser saved magharebit_leads_<date>.xlsx`, got.length >= 1, readdirSync(DL).join(', '))
  await shot(`${lang}-3-leads-export`)

  // ── 375 px phone layout + dark theme ────────────────────────────────────────
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await goto(`${B}/${lang}/admin`)
  await waitFor(`document.querySelectorAll('[data-day]').length === 7`)
  check(`[${lang}] 375 px: chart day labels do not overlap`, await js(`(() => { const r = [...document.querySelectorAll('[data-day]')].map(g => g.querySelector('text').getBBox()); return r.every((b, i) => i === 0 || Math.max(b.x, r[i-1].x) >= Math.min(b.x + b.width, r[i-1].x + r[i-1].width)) })()`))
  check(`[${lang}] 375 px: no horizontal scroll, search button reachable`, await js(`document.documentElement.scrollWidth <= window.innerWidth + 1 && !!document.querySelector('[data-palette-trigger]') && document.querySelector('[data-palette-trigger]').getBoundingClientRect().height >= 44`), String(await js('document.documentElement.scrollWidth')))
  await shot(`${lang}-4-mobile`)
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await js(`document.querySelector('aside button[role=switch]').click()`)
  check(`[${lang}] dark theme switches the chart colours`, await waitFor(`getComputedStyle(document.querySelector('.admin-theme')).getPropertyValue('--adm-chart').trim().toUpperCase() === '#3FA36C'`, 5000))
  await shot(`${lang}-5-dark`)
  await js(`document.querySelector('aside button[role=switch]').click()`)

  check(`[${lang}] console clean`, problems.length === 0, problems.join(' | '))
}

// ── Viewer: dashboard yes, export no ──────────────────────────────────────────
problems = []
check('viewer signs in and sees the Command Center', await login('fr', { u: 'p5view', p: 'viewer-long-password-1' }))
check('viewer: sales export buttons disabled with an explanation', await js(`[...document.querySelectorAll('[data-export]')].every(b => b.disabled) && document.body.innerText.includes('Export réservé aux propriétaires et opérateurs')`))
await goto(`${B}/fr/admin/commission-rates`)
check('viewer: commission export disabled too', await waitFor(`document.querySelectorAll('[data-export]').length === 2 && [...document.querySelectorAll('[data-export]')].every(b => b.disabled)`))
check('viewer: console clean', problems.length === 0, problems.join(' | '))

console.log(`\n${pass} passed, ${fail} failed`)
chrome.kill(); await mongo.close()
process.exitCode = fail ? 1 : 0
