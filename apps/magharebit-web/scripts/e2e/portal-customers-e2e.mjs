// Phase 3.2 — portal customers page (fr/ar/en) in headless Chrome, on real data created through the APIs: customers +
// a sale attached to one of them (its totals and loyalty update server-side). List: count, phone formatting, tier
// badge, totals = API, search (incl. no match + clear), translated labels and direction. Add dialog: validation,
// duplicate phone error from the API, success toast + row. Detail dialog: stats, loyalty progress, notes saved
// (persisted through the API), purchase history = the real sale, Escape. 375 px card list, no presentational
// inline styles, no console errors. Drops its database.
// Run: APP_DIR=. BASE=… MONGODB_DB=magharebit_b2 CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/portal-customers-e2e.mjs
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
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_b2')
await db.dropDatabase()
// The server creates its indexes once per process; after this drop a long-running dev server would not recreate them,
// so rebuild the one that enforces "one phone per customer per merchant" (src/lib/repositories/customers.ts).
await db.collection('customers').createIndex({ merchantId: 1, phone: 1 }, { unique: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
const api = (path, { method = 'GET', body, cookie } = {}) => fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }
const frMoney = (n) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} MAD`

// ── data through the real APIs ───────────────────────────────────────────────
const local = '0666' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const signup = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: 'Épicerie Atlas', sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await signup.json()
const cookie = cookieOf(signup)
await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'epicerie' }, cookie })
const prod = (await (await api('/api/portal/products?limit=5', { cookie })).json()).products[0]
const salma = (await (await api('/api/portal/customers', { method: 'POST', body: { name: 'Salma Bennani', phone: '0661234567', email: 'salma@example.com' }, cookie })).json()).customer
await api('/api/portal/customers', { method: 'POST', body: { name: 'Youssef Idrissi', phone: '0677889900' }, cookie })
check('2 customers created through the API', !!salma?.id)
const sale = await api('/api/portal/transactions', { method: 'POST', body: { items: [{ productId: prod.id, qty: 3 }], paymentMethod: 'cash', taxRate: 0, customerId: salma.id }, cookie })
check('a real sale attached to Salma', sale.status === 201, String(sale.status))
let salmaNow
for (let i = 0; i < 30; i++) { salmaNow = (await (await api(`/api/portal/customers/${salma.id}`, { cookie })).json()).customer; if (salmaNow?.visitCount === 1) break; await sleep(500) }
check('her totals updated server-side', salmaNow?.visitCount === 1 && salmaNow.totalSpent > 0, JSON.stringify({ spent: salmaNow?.totalSpent, pts: salmaNow?.loyaltyPoints }))

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9353', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9353/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('ERR ' + d.params.args.slice(1).map((a) => a.value ?? a.description).join(' | ').slice(0, 200) + ' :: ' + String(d.params.args[0]?.value ?? '').slice(0, 90))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const view = (w, h = 900) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
const goto = async (u) => { await send('Page.navigate', { url: B + u }); await sleep(800) }
const text = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null`)
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return !!el })()`)
const esc = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300) }
const listReady = `document.querySelectorAll('[data-testid=customers-list] tbody tr').length >= 2`
const noPresentationalStyle = `[...document.querySelectorAll('#main-content [style], dialog[open] [style]')].filter(e => !e.hasAttribute('data-dynamic')).map(e => e.tagName + '.' + String(e.className).slice(0, 40))`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

await view(1440)
await goto('/fr/portal/login')
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setLogin = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setLogin(0, local); await setLogin(1, licenseKey)
await click('form button[type=submit]')
check('signed in to the portal', await waitFor(`location.pathname === '/fr/portal/dashboard'`))

// ── list (fr) ────────────────────────────────────────────────────────────────
await goto('/fr/portal/customers')
check('fr: list loads with both customers', await waitFor(listReady))
check('fr: count and title in French', (await text('[data-testid=customers-count]')) === '2 clients enregistrés' && (await text('[data-testid=shell-title]')) === 'Clients', await text('[data-testid=customers-count]'))
const row = `tr[data-customer="Salma Bennani"]`
check('fr: phone formatted, email shown, Bronze badge', await js(`(() => { const r = document.querySelector('${row}'); return /06 61 23 45 67/.test(r.textContent) && /salma@example.com/.test(r.textContent) && r.querySelector('[data-tier=bronze]')?.textContent.trim() === 'Bronze' })()`))
check('fr: total spent = API value', await js(`document.querySelector('${row}').textContent.includes(${JSON.stringify(frMoney(salmaNow.totalSpent))})`), frMoney(salmaNow.totalSpent))
check('fr: never-visited customer says "Jamais"', await js(`/Jamais/.test(document.querySelector('tr[data-customer="Youssef Idrissi"]').textContent)`))
check('fr: LTR, no presentational inline styles', await js(`getComputedStyle(document.querySelector('[data-testid=customers-list]')).direction === 'ltr'`) && (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-customers')

await setVal('[data-testid=customers-search]', 'youss')
check('search by name filters the list', await waitFor(`(() => { const rows = document.querySelectorAll('[data-testid=customers-list] tbody tr'); return rows.length === 1 && rows[0].dataset.customer === 'Youssef Idrissi' })()`, 20000))
await setVal('[data-testid=customers-search]', '0661234')
check('search by phone filters the list', await waitFor(`(() => { const rows = document.querySelectorAll('[data-testid=customers-list] tbody tr'); return rows.length === 1 && rows[0].dataset.customer === 'Salma Bennani' })()`, 20000))
await setVal('[data-testid=customers-search]', 'zzz-personne')
check('no match: empty state + clear', await waitFor(`/Aucun client ne correspond/.test(document.querySelector('[data-testid=customers-empty]')?.textContent || '')`, 20000))
await js(`[...document.querySelectorAll('[data-testid=customers-empty] button')][0].click(); true`)
check('clear brings the list back', await waitFor(listReady, 20000))

// ── add (fr) ─────────────────────────────────────────────────────────────────
await click('[data-testid=customer-add]'); await sleep(300)
check('add dialog opens with focus inside', await js(`document.querySelector('[data-testid=customer-form]').open && document.querySelector('[data-testid=customer-form]').contains(document.activeElement)`))
await click('[data-testid=customer-save]'); await sleep(200)
check('validation in French', (await text('[data-testid=customer-error]')) === 'Le nom est obligatoire.')
await setVal('[data-testid=c-name]', 'Doublon'); await setVal('[data-testid=c-phone]', '06 61 23 45 67')
await click('[data-testid=customer-save]')
check('duplicate phone: the API error is translated', await waitFor(`(document.querySelector('[data-testid=customer-error]')?.textContent || '') === 'Ce numéro est déjà enregistré pour un autre client.'`, 20000), await text('[data-testid=customer-error]'))
await setVal('[data-testid=c-name]', 'Nadia Fassi'); await setVal('[data-testid=c-phone]', '0700112233'); await setVal('[data-testid=c-email]', 'pas-un-email')
await click('[data-testid=customer-save]')
check('invalid email: translated', await waitFor(`/e-mail n’est pas valide/.test(document.querySelector('[data-testid=customer-error]')?.textContent || '')`, 20000), await text('[data-testid=customer-error]'))
await setVal('[data-testid=c-email]', '')
await click('[data-testid=customer-save]')
check('add: dialog closes, toast, row appears, count 3', await waitFor(`!document.querySelector('[data-testid=customer-form]').open && /Client ajouté/.test(document.querySelector('[data-testid=shell-toasts]').textContent) && !!document.querySelector('tr[data-customer="Nadia Fassi"]') && document.querySelector('[data-testid=customers-count]').textContent === '3 clients enregistrés'`, 20000))

// ── detail (fr) ──────────────────────────────────────────────────────────────
await click(row)
check('row click opens the detail dialog', await waitFor(`document.querySelector('[data-testid=customer-detail]')?.open === true`, 5000))
check('detail: stats from the real sale', await js(`(() => { const d = document.querySelector('[data-testid=customer-detail]'); return d.textContent.includes(${JSON.stringify(frMoney(salmaNow.totalSpent))}) && /Visites1/.test(d.textContent.replace(/\\s+/g, '')) })()`))
check('detail: purchase history lists the sale (cash, translated)', await waitFor(`(() => { const t = document.querySelector('[data-testid=customer-detail] tbody'); return !!t && t.querySelectorAll('tr').length === 1 && /Espèces/.test(t.textContent) && /(^|[^#])#\\d/.test(t.textContent) && !t.textContent.includes('##') })()`, 20000))
check('detail: loyalty progress toward Argent', await js(`/pour le niveau Argent/.test(document.querySelector('[data-testid=customer-detail]').textContent) && !!document.querySelector('[data-testid=customer-detail] [role=progressbar] [data-dynamic]')`))
check('detail: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-customer-detail')
await setVal('[data-testid=customer-notes]', 'Préfère le thé vert')
await click('[data-testid=customer-notes-save]')
check('notes saved: confirmation shown', await waitFor(`/Notes enregistrées/.test(document.querySelector('[data-testid=customer-detail]').textContent)`, 20000))
const persisted = (await (await api(`/api/portal/customers/${salma.id}`, { cookie })).json()).customer
check('notes persisted through the API', persisted?.notes === 'Préfère le thé vert', persisted?.notes)
await esc()
check('Escape closes the detail dialog (unmounted)', await js(`!document.querySelector('[data-testid=customer-detail]')?.open && !document.querySelector('dialog[open]')`))
await click('tr[data-customer="Youssef Idrissi"]')
check('a customer with no purchases: history empty state', await waitFor(`!!document.querySelector('[data-testid=customer-history-empty]')`, 20000))
await esc()

// ── ar, en ───────────────────────────────────────────────────────────────────
await goto('/ar/portal/customers'); await waitFor(listReady)
check('ar: RTL, Arabic count, tier and amounts in درهم', await js(`getComputedStyle(document.querySelector('[data-testid=customers-list]')).direction === 'rtl' && /زبائن مسجلين|زبوناً مسجلاً/.test(document.querySelector('[data-testid=customers-count]').textContent) && document.querySelector('${row} [data-tier]').textContent.trim() === 'برونزي' && /درهم/.test(document.querySelector('${row}').textContent)`), await text('[data-testid=customers-count]'))
await shot('ar-1440-customers')
await goto('/en/portal/customers'); await waitFor(listReady)
check('en: English count and columns', (await text('[data-testid=customers-count]')) === '3 customers registered' && await js(`/Total spent/.test(document.querySelector('[data-testid=customers-list] thead').textContent)`))

// ── 375 px ───────────────────────────────────────────────────────────────────
await view(375, 812)
await goto('/fr/portal/customers'); await waitFor(`document.querySelectorAll('[data-testid=customers-list] li').length >= 3`)
check('375 px: card list, no horizontal scroll', await js(`getComputedStyle(document.querySelector('[data-testid=customers-list] table').parentElement).display === 'none' && document.documentElement.scrollWidth <= innerWidth`))
await js(`document.querySelector('[data-testid=customers-list] li button').click(); true`)
check('375 px: tapping a card opens the detail', await waitFor(`document.querySelector('[data-testid=customer-detail]')?.open === true && document.documentElement.scrollWidth <= innerWidth`, 5000))
await shot('fr-375-customer-detail')

const relevant = problems.filter((p) => !/Failed to load resource|401|409|422/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
