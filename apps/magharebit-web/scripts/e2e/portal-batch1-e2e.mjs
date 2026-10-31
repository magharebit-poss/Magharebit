// Phase 3.1 — portal dashboard + products (fr/ar/en) in headless Chrome, on real data created through the APIs:
// starter catalogue + 2 real sales. Dashboard: greeting, KPIs and the 7-day chart equal the API totals (no invented
// figures), recent sales, license key, language + direction, no presentational inline styles. Products: validation,
// create, edit, adjust, low-stock badge/alert/filter (incl. the dashboard link), delete through the confirm dialog,
// Escape, translated labels and units, 375 px layouts, no console errors. Drops its database.
// Start: MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_b1 npx next start -p 3021   (or next dev)
// Run:   APP_DIR=. BASE=… MONGODB_DB=magharebit_b1 CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/portal-batch1-e2e.mjs
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
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_b1')
await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
const api = (path, { method = 'GET', body, cookie } = {}) => fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }
const frMoney = (n) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} MAD`
const arMoney = (n) => `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} درهم`

// ── data through the real APIs ───────────────────────────────────────────────
const local = '0665' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const signup = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: 'Épicerie Atlas', sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await signup.json()
const cookie = cookieOf(signup)
const seed = await (await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'epicerie' }, cookie })).json()
check('starter catalogue seeded through the API', seed.seeded > 2, String(seed.seeded))
const list = await (await api('/api/portal/products?limit=50', { cookie })).json()
const [p1, p2] = list.products
for (const items of [[{ productId: p1.id, qty: 2 }], [{ productId: p2.id, qty: 1 }, { productId: p1.id, qty: 1 }]]) {
  const r = await api('/api/portal/transactions', { method: 'POST', body: { items, paymentMethod: 'cash', taxRate: 0 }, cookie })
  check('a real sale recorded through the API', r.status === 201 || r.ok, String(r.status))
}
const me = await (await api('/api/portal/auth/me', { cookie })).json()
const todayTotal = me.today.totalRevenue
check('API says 2 sales today', me.today.totalTransactions === 2, JSON.stringify(me.today))

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9352', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9352/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
  // React's warnings put the details (e.g. the duplicate key) in the arguments after the format string
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push('ERR ' + d.params.args.slice(1).map((a) => a.value ?? a.description).join(' | ').slice(0, 200) + ' :: ' + String(d.params.args[0]?.value ?? '').slice(0, 90))
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, captureBeyondViewport: false }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const view = (w, h = 900) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 })
const goto = async (u) => { await send('Page.navigate', { url: B + u }); await sleep(800) }
const text = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null`)
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return !!el })()`)
const dashReady = `!!document.querySelector('[data-testid=kpi-sales-value]') && !!document.querySelector('[data-testid=weekly-total]') && document.querySelector('[data-testid=weekly-total]').textContent !== '—' && !document.querySelector('[data-testid=recent-sales] .animate-pulse')`
const noPresentationalStyle = `[...document.querySelectorAll('#main-content [style]')].filter(e => !e.hasAttribute('data-dynamic')).map(e => e.tagName + '.' + String(e.className).slice(0, 40))`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

await view(1440)
await goto('/fr/portal/login')
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setLogin = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setLogin(0, local); await setLogin(1, licenseKey)
await click('form button[type=submit]')
check('signed in to the portal', await waitFor(`location.pathname === '/fr/portal/dashboard'`))

// ── dashboard (fr) ───────────────────────────────────────────────────────────
check('fr dashboard loads its data', await waitFor(dashReady))
check('fr: greeting uses the store name', (await text('[data-testid=dash-hello]')) === 'Bonjour, Épicerie Atlas')
check('fr: sales KPI = API total for today', (await text('[data-testid=kpi-sales-value]')) === frMoney(todayTotal), `${await text('[data-testid=kpi-sales-value]')} vs ${frMoney(todayTotal)}`)
check('fr: tickets KPI = 2', (await text('[data-testid=kpi-tickets-value]')) === '2')
check('fr: 7-day chart total = real sales (no invented figures)', (await text('[data-testid=weekly-total]')) === frMoney(todayTotal) && !(await js(`document.body.innerText.includes('8,307') || document.body.innerText.includes('8 307')`)))
check('fr: today\'s bar is the only one with sales', await js(`(() => { const bars = [...document.querySelectorAll('[data-bar]')]; return bars.length === 7 && parseFloat(bars[6].style.height) === 100 && bars.slice(0, 6).every(b => parseFloat(b.style.height) === 2) })()`))
check('fr: recent sales list the 2 sales, payment translated', await js(`(() => { const rows = document.querySelectorAll('[data-testid=recent-sales] tbody tr'); return rows.length === 2 && [...rows].every(r => r.textContent.includes('Espèces')) })()`))
check('fr: license card shows the real key', (await text('[data-testid=license-key]')) === licenseKey)
check('fr: page content is LTR and French', await js(`getComputedStyle(document.querySelector('[data-testid=kpi-sales]')).direction === 'ltr' && document.querySelector('[data-testid=kpi-sales]').textContent.includes('Ventes du jour')`))
check('fr: no presentational inline styles (only data-driven sizes)', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
check('no fake app version on the download card', !(await js(`document.querySelector('[data-testid=app-card]').textContent.includes('v2.1.0')`)))
await shot('fr-1440-dashboard')

// ── dashboard (ar, en) ───────────────────────────────────────────────────────
await goto('/ar/portal/dashboard'); await waitFor(dashReady)
check('ar: RTL, Arabic labels, amounts in درهم', await js(`getComputedStyle(document.querySelector('[data-testid=kpi-sales]')).direction === 'rtl' && document.querySelector('[data-testid=kpi-sales]').textContent.includes('مبيعات اليوم')`) && (await text('[data-testid=kpi-sales-value]')) === arMoney(todayTotal), await text('[data-testid=kpi-sales-value]'))
check('ar: greeting', (await text('[data-testid=dash-hello]')) === 'مرحباً، Épicerie Atlas')
await shot('ar-1440-dashboard')
await goto('/en/portal/dashboard'); await waitFor(dashReady)
check('en: English labels', await js(`document.querySelector('[data-testid=kpi-sales]').textContent.includes('Sales today') && document.querySelector('[data-testid=weekly-sales]').textContent.includes('Sales over the last 7 days')`))

// ── products (fr) ────────────────────────────────────────────────────────────
await goto('/fr/portal/products')
check('fr products: catalogue count', await waitFor(`/^${seed.seeded} produits au catalogue$/.test(document.querySelector('[data-testid=products-count]')?.textContent || '')`), await text('[data-testid=products-count]'))
check('fr products: table rows with price in MAD and a unit', await waitFor(`(() => { const rows = document.querySelectorAll('[data-testid=products-list] tbody tr'); return rows.length > 2 && /MAD/.test(rows[0].textContent) })()`, 20000))
await shot('fr-1440-products')

await click('[data-testid=product-add]'); await sleep(300)
check('add dialog opens with focus inside', await js(`document.querySelector('[data-testid=product-form]').open && document.querySelector('[data-testid=product-form]').contains(document.activeElement)`))
await click('[data-testid=product-save]'); await sleep(200)
check('validation message in French', (await text('[data-testid=form-error]')) === 'Le nom est obligatoire.')
await setVal('[data-testid=f-name]', 'Msemen maison'); await setVal('[data-testid=f-category]', 'Boulangerie'); await setVal('[data-testid=f-price]', '4.5')
await click('[data-testid=product-save]')
check('create: dialog closes, toast, row appears', await waitFor(`!document.querySelector('[data-testid=product-form]').open && /Produit ajouté/.test(document.querySelector('[data-testid=shell-toasts]').textContent) && !!document.querySelector('tr[data-product="Msemen maison"]')`, 20000))
check('new product has stock 0 ≤ alert 5: amber row + "Stock bas" badge', await js(`(() => { const r = document.querySelector('tr[data-product="Msemen maison"]'); return /Stock bas/.test(r.textContent) && getComputedStyle(r).backgroundColor === 'rgb(255, 251, 235)' })()`))
check('the low-stock alert banner counts it', await waitFor(`/sous le seuil/.test(document.querySelector('[data-testid=low-alert]')?.textContent || '')`, 5000))

await click('tr[data-product="Msemen maison"] button[aria-label="Modifier"]'); await sleep(300)
await setVal('[data-testid=f-price]', '5'); await click('[data-testid=product-save]')
check('edit: new price shown', await waitFor(`/5,00 MAD/.test(document.querySelector('tr[data-product="Msemen maison"]')?.textContent || '')`, 20000))

await click('tr[data-product="Msemen maison"] button[aria-label="Ajuster le stock"]'); await sleep(300)
await click('[data-testid=adjust-confirm]'); await sleep(200)
check('adjust: zero refused with a French message', await js(`/différente de zéro/.test(document.querySelector('[data-testid=product-adjust]').textContent)`))
await setVal('[data-testid=adjust-delta]', '12'); await click('[data-testid=adjust-confirm]')
check('adjust +12: stock 12, no longer low', await waitFor(`(() => { const r = document.querySelector('tr[data-product="Msemen maison"]'); return !!r && /(^|\\D)12 pièce/.test(r.textContent) && !/Stock bas/.test(r.textContent) })()`, 20000))

await click('tr[data-product="Msemen maison"] button[aria-label="Supprimer"]'); await sleep(300)
check('delete asks in a dialog (not window.confirm)', await js(`document.querySelector('[data-testid=product-delete]').open && /Msemen maison/.test(document.querySelector('[data-testid=product-delete]').textContent)`))
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300)
check('Escape cancels: product still there', await js(`!document.querySelector('[data-testid=product-delete]').open && !!document.querySelector('tr[data-product="Msemen maison"]')`))
await click('tr[data-product="Msemen maison"] button[aria-label="Supprimer"]'); await sleep(300)
await click('[data-testid=product-delete-confirm]')
check('confirmed delete removes it', await waitFor(`!document.querySelector('tr[data-product="Msemen maison"]') && /Produit supprimé/.test(document.querySelector('[data-testid=shell-toasts]').textContent)`, 20000))
check('fr products: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))

// low-stock filter, opened from the dashboard KPI link
await api('/api/portal/products', { method: 'POST', body: { name: 'Harcha', category: 'Boulangerie', price: 3, stock: 1, minStock: 5 }, cookie })
await goto('/fr/portal/dashboard'); await waitFor(dashReady)
await click('[data-testid=kpi-low]')
check('dashboard low-stock KPI opens products with the filter on', await waitFor(`location.pathname === '/fr/portal/products' && document.querySelector('[data-testid=products-low]')?.checked === true`))
check('filter shows only low-stock products', await waitFor(`(() => { const rows = [...document.querySelectorAll('[data-testid=products-list] tbody tr')]; return rows.length >= 1 && rows.every(r => /Stock bas/.test(r.textContent)) && rows.some(r => r.dataset.product === 'Harcha') })()`, 20000))
await setVal('[data-testid=products-search]', 'zzzz-introuvable')
check('no match: empty state with "clear filters"', await waitFor(`/Aucun produit ne correspond/.test(document.querySelector('[data-testid=products-empty]')?.textContent || '')`, 20000))

// ── products (ar) ────────────────────────────────────────────────────────────
await goto('/ar/portal/products')
check('ar products: Arabic count, RTL, Arabic units', await waitFor(`/في الكتالوج/.test(document.querySelector('[data-testid=products-count]')?.textContent || '')`) && await waitFor(`document.querySelectorAll('[data-testid=products-list] tbody tr').length > 2`) && await js(`getComputedStyle(document.querySelector('[data-testid=products-list]')).direction === 'rtl' && /قطعة|كغ|ل\\b|علبة/.test(document.querySelector('[data-testid=products-list] tbody').textContent)`))
await shot('ar-1440-products')

// ── 375 px ───────────────────────────────────────────────────────────────────
await view(375, 812)
await goto('/fr/portal/products'); await waitFor(`document.querySelectorAll('[data-testid=products-list] li').length > 2`)
check('375 px products: card list, no horizontal scroll', await js(`getComputedStyle(document.querySelector('[data-testid=products-list] table').parentElement).display === 'none' && document.documentElement.scrollWidth <= innerWidth`))
await shot('fr-375-products')
await goto('/ar/portal/dashboard'); await waitFor(dashReady)
check('375 px dashboard (ar): no horizontal scroll, KPIs stacked', await js(`document.documentElement.scrollWidth <= innerWidth && getComputedStyle(document.querySelector('[data-testid=kpi-sales]').parentElement).gridTemplateColumns.split(' ').length === 1`))
await shot('ar-375-dashboard')

const relevant = problems.filter((p) => !/Failed to load resource|401/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
