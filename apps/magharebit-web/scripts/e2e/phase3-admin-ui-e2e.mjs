// Phase 3 admin pages in headless Chrome (fr + ar): sidebar groups, Tipping, Commission rates, Shop types / Cuisines /
// Banners, Notifications (send, status, resend), Audit logs timeline, viewer read-only, 375 px layout, console clean.
// Env: APP_DIR, OUT, PROFILE, CHROME, BASE (default http://localhost:3027), MONGODB_DB (default magharebit_v2), LANGS (default fr,ar)
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3027'
const APP = process.env.APP_DIR || process.cwd()
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const PW = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^ADMIN_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient, ObjectId } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_v2')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RUN = Date.now().toString(36).slice(-4) // unique names per run, so reruns on the same database do not collide
await db.collection('rate_limits').deleteMany({}) // logins from earlier runs must not trip the limiter
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

async function api(method, path, { cookie, body } = {}) {
  const res = await fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie'); return { status: res.status, json: await res.json().catch(() => null), cookie: sc ? sc.split(';')[0] : null }
}
const owner = (await api('POST', '/api/admin/login', { body: { password: PW } })).cookie
await api('POST', '/api/admin/users', { cookie: owner, body: { username: 'vik', displayName: 'Vik V.', role: 'viewer', password: 'viewer-long-password-1' } })

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9344', '--window-size=1280,860', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9344/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); let problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  const p = d.params
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push('ERR ' + p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 60000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1200) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const navReady = `document.querySelectorAll('nav a[href*="/admin/"]').length >= 8`
const login = async (lang, user) => {
  await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}/admin/tipping`)
  await waitFor(`(() => { const el = document.querySelector('#adm-pass'); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`)
  if (user) await setVal('#adm-user', user.u)
  await setVal('#adm-pass', user ? user.p : PW)
  await js(`document.querySelector('form button[type=submit]').click()`)
  return waitFor(navReady)
}
const clickSidebar = async (slug) => {
  await waitFor(navReady)
  await js(`document.querySelector('nav a[href$="/admin/${slug}"]').click()`)
  return waitFor(`location.pathname.endsWith('/admin/${slug}') && !!document.querySelector('h1')`)
}
const plusButton = `[...document.querySelectorAll('section button')].find(b => b.innerText.trim().startsWith('+'))`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

// seed
const merchantId = new ObjectId()
await db.collection('merchants').insertOne({ _id: merchantId, phone: '212660000777', storeName: 'Commission UI Shop', sector: 'epicerie', city: 'Rabat', locale: 'fr', createdAt: new Date(), status: 'approved', plan: 'Business' })

for (const lang of (process.env.LANGS || 'fr,ar').split(',')) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
  problems = []
  check(`[${lang}] owner signs in`, await login(lang))
  const groups = await js(`[...document.querySelectorAll('nav p')].length`)
  const links = await js(`[...document.querySelectorAll('nav a')].map(a => a.getAttribute('href').split('/admin/')[1])`)
  check(`[${lang}] sidebar: 4 group headings and 12 links incl. the new pages`, groups === 4 && ['merchants', 'licenses', 'leads', 'commission-rates', 'tipping', 'shop-types', 'cuisines', 'banners', 'coupons', 'notifications', 'audit-logs', 'admins'].every((s) => links.includes(s)) && !links.includes('audit-log'), JSON.stringify(links))

  // ── Tipping ────────────────────────────────────────────────────────────────
  check(`[${lang}] click Tipping`, await clickSidebar('tipping'))
  check(`[${lang}] tipping: 3 steppers loaded with values`, await waitFor(`document.querySelector('#tip-1') && document.querySelector('#tip-1').value !== '' && !!document.querySelector('#tip-3')`))
  const before = await js(`[1,2,3].map(n => document.querySelector('#tip-' + n).value)`)
  check(`[${lang}] tipping: Update disabled while nothing changed`, await js(`document.querySelector('form button[type=submit]').disabled`))
  await js(`document.querySelector('#tip-1').parentElement.querySelectorAll('button')[1].click()`)
  await js(`document.querySelector('#tip-2').parentElement.querySelectorAll('button')[0].click()`)
  const after = await js(`[1,2,3].map(n => document.querySelector('#tip-' + n).value)`)
  check(`[${lang}] tipping: + raises Tip 1 by 1, - lowers Tip 2 by 1`, Number(after[0]) === Number(before[0]) + 1 && Number(after[1]) === Math.max(0, Number(before[1]) - 1) && after[2] === before[2], `${before} -> ${after}`)
  check(`[${lang}] tipping: Update enabled after a change`, !(await js(`document.querySelector('form button[type=submit]').disabled`)))
  await setVal('#tip-3', '9999')
  check(`[${lang}] tipping: 9999 is invalid, Update disabled`, await js(`document.querySelector('form button[type=submit]').disabled && document.querySelector('#tip-3').getAttribute('aria-invalid') === 'true'`))
  await setVal('#tip-3', after[2])
  await shot(`${lang}-1-tipping`)
  await js(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] tipping: Update saves and confirms`, await waitFor(`!!document.querySelector('form [role=status]')`, 30000))
  const saved = (await db.collection('platform_settings').findOne({ _id: 'tipping' }))?.tips
  check(`[${lang}] tipping: database holds the new amounts`, JSON.stringify(saved) === JSON.stringify(after.map(Number)), JSON.stringify(saved))

  // ── Commission ─────────────────────────────────────────────────────────────
  check(`[${lang}] click Commission rate`, await clickSidebar('commission-rates'))
  check(`[${lang}] commission: merchant row with inline % input`, await waitFor(`!!document.querySelector('input[aria-label*="Commission UI Shop"]')`))
  await setVal('input[aria-label*="Commission UI Shop"]', '9,5')
  check(`[${lang}] commission: "9,5" (comma) is accepted, Save enabled`, !(await js(`document.querySelector('button[aria-label*="Commission UI Shop"]').disabled`)))
  await setVal('input[aria-label*="Commission UI Shop"]', 'abc')
  check(`[${lang}] commission: "abc" disables Save and marks the field invalid`, await js(`document.querySelector('button[aria-label*="Commission UI Shop"]').disabled && document.querySelector('input[aria-label*="Commission UI Shop"]').getAttribute('aria-invalid') === 'true'`))
  await setVal('input[aria-label*="Commission UI Shop"]', '9,5')
  await shot(`${lang}-2-commission`)
  await js(`document.querySelector('button[aria-label*="Commission UI Shop"]').click()`)
  await sleep(2500)
  const merchant = await db.collection('merchants').findOne({ _id: merchantId })
  check(`[${lang}] commission: Save stores 9.5 for that merchant`, merchant.commissionRate === 9.5, String(merchant.commissionRate))
  check(`[${lang}] commission: row shows the saved confirmation, Save disabled again`, await js(`document.querySelector('button[aria-label*="Commission UI Shop"]').disabled && !!document.querySelector('td [role=status]')`))

  // ── Catalog pages ──────────────────────────────────────────────────────────
  for (const [slug, kind] of [['shop-types', 'shop-type'], ['cuisines', 'cuisine'], ['banners', 'banner']]) {
    check(`[${lang}] click ${slug}`, await clickSidebar(slug))
    check(`[${lang}] ${slug}: table headers and a "+ Add" button`, await waitFor(`!!${plusButton} && document.querySelectorAll('table thead th').length === 5`))
    await js(`${plusButton}.click()`)
    check(`[${lang}] ${slug}: "+ Add" opens the dialog`, await waitFor(`!!document.querySelector('dialog[open] form')`, 10000))
    const name = `${kind} UI ${lang} ${RUN}`
    await setVal('dialog input:not([type=checkbox])', name)
    await setVal('dialog textarea', 'Created by the UI test')
    await setVal('dialog input[dir=ltr]', '/media/a1-hero.webp')
    await js(`document.querySelector('dialog form button[type=submit]').click()`)
    check(`[${lang}] ${slug}: item is added and listed`, await waitFor(`[...document.querySelectorAll('table tbody tr td:nth-child(2)')].some(td => td.innerText.trim() === ${JSON.stringify(name)})`, 30000))
    const thumb = await js(`(() => { const row = [...document.querySelectorAll('table tbody tr')].find(r => r.children[1].innerText.trim() === ${JSON.stringify(name)}); const img = row.querySelector('td img'); return img ? { alt: img.alt, w: img.naturalWidth } : null })()`)
    await sleep(800)
    const thumb2 = await js(`(() => { const row = [...document.querySelectorAll('table tbody tr')].find(r => r.children[1].innerText.trim() === ${JSON.stringify(name)}); const img = row.querySelector('td img'); return img ? { alt: img.alt, w: img.naturalWidth } : null })()`)
    check(`[${lang}] ${slug}: thumbnail is a real image with alt text`, !!thumb2 && thumb2.alt === name && thumb2.w > 0, JSON.stringify(thumb2 || thumb))
    await js(`[...document.querySelectorAll('table tbody tr')].find(r => r.children[1].innerText.trim() === ${JSON.stringify(name)}).querySelector('button[role=switch]').click()`)
    await sleep(1500)
    const rowDb = await db.collection('catalog_items').findOne({ kind, name })
    check(`[${lang}] ${slug}: the status switch turns the item off in the database`, rowDb && rowDb.active === false)
    await shot(`${lang}-3-${slug}`)
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  check(`[${lang}] click Notifications`, await clickSidebar('notifications'))
  await waitFor(`!!${plusButton}`)
  await js(`${plusButton}.click()`)
  check(`[${lang}] notifications: "+ Send Notification" opens the dialog`, await waitFor(`!!document.querySelector('dialog[open] form')`, 10000))
  const title = `Maintenance ${lang} ${RUN}`
  await setVal('dialog input:not([type=checkbox])', title)
  await setVal('dialog textarea', 'Short downtime tonight at 23:00.')
  await js(`document.querySelector('dialog form button[type=submit]').click()`)
  check(`[${lang}] notifications: it appears in the history table`, await waitFor(`[...document.querySelectorAll('table tbody tr td:first-child')].some(td => td.innerText.includes(${JSON.stringify(title)}))`, 30000))
  const rowSel = `[...document.querySelectorAll('table tbody tr')].find(r => r.children[0].innerText.includes(${JSON.stringify(title)}))`
  await js(`${rowSel}.querySelector('td:last-child button').click()`)
  await sleep(1800)
  const nd = await db.collection('notifications').findOne({ title })
  check(`[${lang}] notifications: Resend counts and keeps it queued`, nd?.resendCount === 1 && nd.status === 'queued', JSON.stringify({ c: nd?.resendCount, s: nd?.status }))
  await setVal('table tbody tr:first-child select', 'sent')
  await sleep(1800)
  check(`[${lang}] notifications: the status select changes it to sent`, (await db.collection('notifications').findOne({ title }))?.status === 'sent')
  await shot(`${lang}-4-notifications`)

  // ── Audit logs ─────────────────────────────────────────────────────────────
  check(`[${lang}] click Audit logs`, await clickSidebar('audit-logs'))
  check(`[${lang}] audit: timeline entries with "API: <action>" and "Performed by"`, await waitFor(`document.querySelectorAll('ol > li').length >= 5 && document.body.innerText.includes('API: updateTipping')`))
  await js(`document.querySelector('ol > li button[aria-controls^="audit-"]').click()`)
  check(`[${lang}] audit: "show details" expands the entry`, await waitFor(`!!document.querySelector('ol > li dl') && !!document.querySelector('ol > li button[aria-expanded=true]')`, 5000))
  await setVal('main select, section select', 'updateCommission')
  await js(`document.querySelector('section form button[type=submit]').click()`)
  check(`[${lang}] audit: action filter narrows the timeline`, await waitFor(`(() => { const t = [...document.querySelectorAll('ol > li')].map(li => li.innerText); return t.length > 0 && t.every(x => x.includes('API: updateCommission')) })()`, 30000))
  await shot(`${lang}-5-audit-timeline`)
  await js(`[...document.querySelectorAll('button[aria-pressed]')].find(b => b.getAttribute('aria-pressed') === 'false').click()`)
  check(`[${lang}] audit: Table view is one click away`, await waitFor(`!!document.querySelector('table tbody tr td')`, 15000))
  await goto(`${B}/${lang}/admin/audit-log`)
  check(`[${lang}] old /admin/audit-log URL lands on /admin/audit-logs`, await waitFor(`location.pathname.endsWith('/admin/audit-logs') && !!document.querySelector('h1')`, 60000))

  // ── phone layout + dark theme ──────────────────────────────────────────────
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  for (const slug of ['tipping', 'commission-rates', 'shop-types', 'cuisines', 'banners', 'notifications', 'audit-logs']) {
    await goto(`${B}/${lang}/admin/${slug}`)
    await waitFor(`!!document.querySelector('h1')`)
    await sleep(1200)
    const ox = await js(`document.documentElement.scrollWidth - innerWidth`)
    check(`[${lang}] 375px: /admin/${slug} has no page-level horizontal overflow`, ox <= 0, String(ox))
  }
  await shot(`${lang}-6-mobile-audit`)
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
  await goto(`${B}/${lang}/admin/tipping`)
  await waitFor(`!!document.querySelector('#tip-1')`)
  await js(`[...document.querySelectorAll('button[role=switch]')].find(b => !b.closest('table')).click()`)
  await sleep(600)
  check(`[${lang}] dark theme applies on the new pages`, (await js(`document.querySelector('.admin-theme').getAttribute('data-theme')`)) === 'dark')
  await shot(`${lang}-7-tipping-dark`)
  await js(`localStorage.removeItem('mgh-admin-theme')`)
  check(`[${lang}] no console errors or exceptions across the run`, problems.length === 0, problems.slice(0, 3).join(' | '))
}

// ── viewer is read-only ──────────────────────────────────────────────────────
problems = []
check('viewer signs in', await login('fr', { u: 'vik', p: 'viewer-long-password-1' }))
await clickSidebar('tipping')
await waitFor(`!!document.querySelector('#tip-1') && document.querySelector('#tip-1').value !== ''`)
check('viewer: tipping inputs and steppers disabled, no Update button', await js(`document.querySelector('#tip-1').disabled && [...document.querySelectorAll('form button')].every(b => b.disabled) && !document.querySelector('form button[type=submit]')`))
await clickSidebar('shop-types')
await sleep(1500)
check('viewer: shop types has no "+ Add" button and switches are disabled', await js(`!${plusButton} && [...document.querySelectorAll('table button[role=switch]')].every(b => b.disabled)`))
await clickSidebar('commission-rates')
await sleep(1500)
check('viewer: commission inputs are disabled', await js(`[...document.querySelectorAll('table tbody input')].every(i => i.disabled)`))
check('viewer: no console errors', problems.length === 0, problems.slice(0, 3).join(' | '))

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await mongo.close()
process.exitCode = fail ? 1 : 0
