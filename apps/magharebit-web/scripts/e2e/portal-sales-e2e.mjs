// Phase 3.3 — portal Sales page (fr/ar/en) in headless Chrome on real data: 25 sales created through the API (4 payment
// methods, one with a customer, a % discount, VAT and a note), 5 of them then moved back in time in the database so
// the date filters have something to separate. API: method filter, sum of the matching sales, customer names, 422 on a
// bad method/date, NaN-safe paging. UI: nav entry (Vente group), summary = API count + sum, pagination (range, next,
// prev, reset to page 1 on filter), method filter, period presets, custom range (incl. start > end), no-match state +
// reset, detail dialog (items, discount, VAT, total, customer, note, Escape), walk-in label, ar RTL / en, 375 px cards,
// no presentational inline styles, no console errors. Drops its database.
// Run: APP_DIR=. BASE=… MONGODB_DB=… CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/portal-sales-e2e.mjs
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
const { MongoClient, ObjectId } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_sales')
await db.dropDatabase()
// The server creates its indexes once per process; rebuild the unique ones a long-running dev server would not recreate
await db.collection('customers').createIndex({ merchantId: 1, phone: 1 }, { unique: true })
await db.collection('transactions').createIndex({ receiptNo: 1, merchantId: 1 }, { unique: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
const api = (path, { method = 'GET', body, cookie } = {}) => fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }
const frMoney = (n) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} MAD`
const round = (n) => Math.round(n * 100) / 100
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d }

// ── data through the real APIs ───────────────────────────────────────────────
const local = '0667' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const signup = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: 'Café Zellige', sector: 'cafe', city: 'Rabat', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await signup.json()
const cookie = cookieOf(signup)
await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'cafe' }, cookie })
const prods = (await (await api('/api/portal/products?limit=10', { cookie })).json()).products
const salma = (await (await api('/api/portal/customers', { method: 'POST', body: { name: 'Salma Bennani', phone: '0661234567' }, cookie })).json()).customer
check('catalogue and a customer created through the API', prods.length >= 3 && !!salma?.id)

const methodOf = (i) => (i < 15 ? 'cash' : i < 21 ? 'card' : i < 23 ? 'mobile_money' : 'mixed')
const sales = []
for (let i = 0; i < 25; i++) {
  const special = i === 16
  const body = special
    ? { items: [{ productId: prods[0].id, qty: 2 }, { productId: prods[1].id, qty: 1 }], paymentMethod: 'card', discountType: 'percent', discountValue: 10, taxRate: 20, customerId: salma.id, note: 'Livraison à domicile' }
    : { items: [{ productId: prods[i % prods.length].id, qty: 1 + (i % 3) }], paymentMethod: methodOf(i), taxRate: 0 }
  const r = await api('/api/portal/transactions', { method: 'POST', body, cookie })
  if (r.status !== 201) { check(`sale ${i} created`, false, `${r.status} ${await r.text()}`); break }
  sales.push((await r.json()).transaction)
}
check('25 real sales created through the API', sales.length === 25)
// Move 3 sales to 10 days ago and 2 to 40 days ago (the API stamps createdAt itself)
const moved = [[0, 10], [1, 10], [2, 10], [3, 40], [4, 40]]
for (const [i, d] of moved) await db.collection('transactions').updateOne({ _id: new ObjectId(sales[i].id) }, { $set: { createdAt: daysAgo(d) } })
const special = sales[16]
const sumOf = (xs) => round(xs.reduce((s, t) => s + t.total, 0))
const allSum = sumOf(sales)
const card = sales.filter((t) => t.paymentMethod === 'card')

// ── API contract ─────────────────────────────────────────────────────────────
const get = async (q) => { const r = await api(`/api/portal/transactions?${q}`, { cookie }); return { status: r.status, body: await r.json() } }
const all = await get('limit=100')
check('API: total and sum of every sale', all.body.total === 25 && all.body.sum === allSum, `${all.body.total} ${all.body.sum} vs ${allSum}`)
const byCard = await get('method=card&limit=100')
check('API: method filter (card) + its sum', byCard.body.total === 6 && byCard.body.transactions.every((t) => t.paymentMethod === 'card') && byCard.body.sum === sumOf(card), `${byCard.body.total} ${byCard.body.sum}`)
check('API: customer name on the linked sale only', byCard.body.transactions.find((t) => t.id === special.id)?.customerName === 'Salma Bennani' && all.body.transactions.filter((t) => t.customerName).length === 1)
check('API: unknown method → 422', (await get('method=bitcoin')).status === 422)
check('API: invalid date → 422', (await get('dateFrom=pas-une-date')).status === 422)
const nan = await get('page=abc&limit=xyz')
check('API: NaN paging falls back to page 1 / 20 rows', nan.status === 200 && nan.body.transactions.length === 20)
const fromQ = await get(`dateFrom=${daysAgo(30).toISOString()}&limit=100`)
check('API: date filter', fromQ.body.total === 23, String(fromQ.body.total))

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9354', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9354/json')).json(); if (targets.length) break } catch {} await sleep(500) }
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
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return !!el })()`)
const esc = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300) }
const rows = `document.querySelectorAll('[data-testid=sales-list] tbody tr')`
const settled = `document.querySelector('[data-testid=sales-list]')?.getAttribute('aria-busy') === 'false'`
const state = (n, summary) => `${settled} && ${rows}.length === ${n} && (document.querySelector('[data-testid=sales-summary]')?.textContent || '').startsWith(${JSON.stringify(summary)})`
const noPresentationalStyle = `[...document.querySelectorAll('#main-content [style], dialog[open] [style]')].filter(e => !e.hasAttribute('data-dynamic')).map(e => e.tagName + '.' + String(e.className).slice(0, 40))`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

await view(1440)
await goto('/fr/portal/login')
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setLogin = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setLogin(0, local); await setLogin(1, licenseKey)
await click('form button[type=submit]')
check('signed in to the portal', await waitFor(`location.pathname === '/fr/portal/dashboard'`))

// ── nav ──────────────────────────────────────────────────────────────────────
check('nav: "Ventes" link sits right after Clients', await js(`(() => { const hrefs = [...document.querySelectorAll('[data-testid=shell-sidebar] a[href*="/portal/"]')].map(a => a.getAttribute('href')); const i = hrefs.indexOf('/fr/portal/sales'); return i > 0 && hrefs[i - 1] === '/fr/portal/customers' })()`))
await js(`document.querySelector('[data-testid=shell-sidebar] a[href="/fr/portal/sales"]').click(); true`)
check('nav: opens the page, title and active item', await waitFor(`location.pathname === '/fr/portal/sales' && document.querySelector('[data-testid=shell-title]')?.textContent === 'Ventes' && document.querySelector('[data-testid=shell-sidebar] a[href="/fr/portal/sales"]')?.getAttribute('aria-current') === 'page'`))

// ── list + pagination (fr) ───────────────────────────────────────────────────
check('fr: 20 rows, summary = API count and sum', await waitFor(state(20, `25 ventes · ${frMoney(allSum)}`)), await text('[data-testid=sales-summary]'))
check('fr: range "1–20 sur 25", page 1 of 2', (await text('[data-testid=sales-range]')) === '1–20 sur 25' && (await text('[data-testid=sales-page]')) === 'Page 1 sur 2')
check('fr: newest first, receipt + translated method + total in the row', await js(`(() => { const r = ${rows}[0]; return r.dataset.receipt === ${JSON.stringify(sales[24].receiptNo)} && /Mixte/.test(r.textContent) && r.textContent.includes(${JSON.stringify(frMoney(sales[24].total))}) })()`))
check('fr: walk-in label, customer name on the linked sale', await js(`/Client de passage/.test(${rows}[0].textContent) && /Salma Bennani/.test(document.querySelector('tr[data-receipt="${special.receiptNo}"]').textContent)`))
check('fr: LTR, no presentational inline styles', await js(`getComputedStyle(document.querySelector('[data-testid=sales-list]')).direction === 'ltr'`) && (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-sales')
await click('[data-testid=sales-next]')
check('next: page 2 shows the last 5', await waitFor(`${settled} && ${rows}.length === 5 && document.querySelector('[data-testid=sales-range]').textContent === '21–25 sur 25' && document.querySelector('[data-testid=sales-page]').textContent === 'Page 2 sur 2'`, 20000))
check('next is inert on the last page', await js(`document.querySelector('[data-testid=sales-next]').getAttribute('aria-disabled') === 'true'`))
check('page 2 holds the oldest sale (moved 40 days back)', await js(`[...${rows}].some(r => r.dataset.receipt === ${JSON.stringify(sales[3].receiptNo)})`))

// ── method filter ────────────────────────────────────────────────────────────
await setVal('[data-testid=sales-method]', 'card')
check('method filter: back to page 1, 6 card sales + their sum', await waitFor(state(6, `6 ventes · ${frMoney(sumOf(card))}`), 20000), await text('[data-testid=sales-summary]'))
check('method filter: only card badges, no pagination', await js(`[...${rows}].every(r => r.querySelector('[data-method]').dataset.method === 'card') && !document.querySelector('[data-testid=sales-pagination]')`))
await setVal('[data-testid=sales-method]', '')

// ── periods ──────────────────────────────────────────────────────────────────
await click('[data-testid=period-today]')
check('Aujourd’hui: 20 sales (5 are older)', await waitFor(state(20, '20 ventes'), 20000), await text('[data-testid=sales-summary]'))
check('period buttons expose aria-pressed', await js(`document.querySelector('[data-testid=period-today]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-testid=period-all]').getAttribute('aria-pressed') === 'false'`))
await click('[data-testid=period-30d]')
check('30 jours: 23 sales', await waitFor(state(20, '23 ventes'), 20000), await text('[data-testid=sales-summary]'))
await click('[data-testid=period-custom]')
await setVal('[data-testid=sales-from]', ymd(daysAgo(45))); await setVal('[data-testid=sales-to]', ymd(daysAgo(35)))
check('custom range 45→35 days ago: the 2 old sales', await waitFor(state(2, `2 ventes · ${frMoney(sumOf([sales[3], sales[4]]))}`), 20000), await text('[data-testid=sales-summary]'))
await setVal('[data-testid=sales-from]', ymd(daysAgo(5))); await setVal('[data-testid=sales-to]', ymd(daysAgo(15)))
check('start after end: inline error, list kept', await waitFor(`/doit précéder/.test(document.querySelector('[data-testid=sales-range-error]')?.textContent || '') && ${rows}.length === 2`, 5000))
const future = new Date(); future.setFullYear(future.getFullYear() + 1)
await setVal('[data-testid=sales-from]', ymd(future)); await setVal('[data-testid=sales-to]', ymd(future))
check('no match: empty state', await waitFor(`/Aucune vente ne correspond/.test(document.querySelector('[data-testid=sales-empty]')?.textContent || '')`, 20000))
await js(`document.querySelector('[data-testid=sales-empty] button').click(); true`)
check('reset: all 25 again, filters cleared', await waitFor(state(20, '25 ventes'), 20000) && await js(`document.querySelector('[data-testid=period-all]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-testid=sales-method]').value === '' && !document.querySelector('[data-testid=sales-reset]')`))

// ── detail ───────────────────────────────────────────────────────────────────
await click(`tr[data-receipt="${special.receiptNo}"]`)
check('row click opens the detail dialog', await waitFor(`document.querySelector('[data-testid=sale-detail]')?.open === true`, 5000))
check('detail: title, both items with quantities', await js(`(() => { const d = document.querySelector('[data-testid=sale-detail]'); const t = d.querySelectorAll('[data-testid=sale-items] tbody tr'); return d.textContent.includes(${JSON.stringify('Ticket ' + special.receiptNo)}) && t.length === 2 && t[0].textContent.includes(${JSON.stringify(special.items[0].name)}) && t[0].children[1].textContent.trim() === '2' })()`))
check('detail: discount (10 %), VAT 20 %, total = API', await js(`(() => { const q = (s) => document.querySelector('[data-testid=' + s + ']')?.textContent || ''; return /Remise \\(10 %\\)/.test(q('sale-discount')) && q('sale-discount').includes(${JSON.stringify(frMoney(special.discount))}) && q('sale-tax').includes('TVA 20 %') && q('sale-tax').includes(${JSON.stringify(frMoney(special.taxAmount))}) && q('sale-total').includes(${JSON.stringify(frMoney(special.total))}) })()`))
check('detail: card, customer, note', await js(`(() => { const d = document.querySelector('[data-testid=sale-detail]'); return d.querySelector('[data-method=card]') && /Salma Bennani/.test(d.textContent) && /Livraison à domicile/.test(d.textContent) })()`))
check('detail: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-sale-detail')
await esc()
check('Escape closes the detail dialog', await js(`!document.querySelector('dialog[open]')`))

// ── ar, en ───────────────────────────────────────────────────────────────────
await goto('/ar/portal/sales')
check('ar: RTL, Arabic summary, نقداً, amounts in درهم', await waitFor(`${state(20, '25 عملية بيع')} && getComputedStyle(document.querySelector('[data-testid=sales-list]')).direction === 'rtl' && /نقداً/.test(document.querySelector('[data-testid=sales-list]').textContent) && /درهم/.test(document.querySelector('[data-testid=sales-summary]').textContent) && document.querySelector('[data-testid=shell-title]').textContent === 'المبيعات'`), await text('[data-testid=sales-summary]'))
await shot('ar-1440-sales')
await goto('/en/portal/sales')
check('en: English summary, columns and period labels', await waitFor(`${state(20, '25 sales')} && /Payment/.test(document.querySelector('[data-testid=sales-list] thead').textContent) && document.querySelector('[data-testid=period-7d]').textContent === '7 days'`))

// ── 375 px ───────────────────────────────────────────────────────────────────
await view(375, 812)
await goto('/fr/portal/sales'); await waitFor(`document.querySelectorAll('[data-testid=sales-list] li').length === 20`)
check('375 px: card list, filters fit, no horizontal scroll', await js(`getComputedStyle(document.querySelector('[data-testid=sales-list] table').parentElement).display === 'none' && document.documentElement.scrollWidth <= innerWidth`))
await shot('fr-375-sales')
await js(`document.querySelector('[data-testid=sales-list] li[data-receipt="${special.receiptNo}"] button')?.scrollIntoView(); document.querySelector('[data-testid=sales-list] li[data-receipt="${special.receiptNo}"] button')?.click(); true`)
check('375 px: tapping a card opens the detail, no horizontal scroll', await waitFor(`document.querySelector('[data-testid=sale-detail]')?.open === true && document.documentElement.scrollWidth <= innerWidth`, 5000))
await shot('fr-375-sale-detail')

const relevant = problems.filter((p) => !/Failed to load resource|401|409|422/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
