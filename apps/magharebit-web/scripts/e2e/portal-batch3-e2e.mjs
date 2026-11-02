// Phase 3.3 batch 3 — portal Purchases (Achats) + Employees (Employés) in headless Chrome (fr/ar/en) on real data.
// Purchases: KPIs = API counts per status, suppliers tab (list, inactive badge, search, no match, add with translated
// validation/duplicate/email errors, edit + persisted), new order (active suppliers only, validation, cost pre-filled
// from the catalogue, live total, draft created), send, partial then full receipt (stock really increases by the
// received quantities, statuses partial → received), cancel with in-dialog confirmation, status filters, 375 px.
// Employees: empty state, add (validation, login suggestion, PIN mismatch, duplicate login 409 translated), edit role,
// PIN change proven through the PIN-login API, deactivate (confirm) / show inactive / reactivate, API type checks.
// No presentational inline styles, no console errors. Drops its database.
// Run: APP_DIR=. BASE=… MONGODB_DB=… CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/portal-batch3-e2e.mjs
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
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_b3')
await db.dropDatabase()
// The server creates its indexes once per process; rebuild the unique ones a long-running dev server would not recreate
await db.collection('suppliers').createIndex({ merchantId: 1, name: 1 }, { unique: true })
await db.collection('employees').createIndex({ merchantId: 1, loginId: 1 }, { unique: true })
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
const local = '0668' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const signup = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: 'Épicerie Souss', sector: 'epicerie', city: 'Agadir', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await signup.json()
const cookie = cookieOf(signup)
await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'epicerie' }, cookie })
const prods = (await (await api('/api/portal/products?limit=100', { cookie })).json()).products
const p1 = prods.find((p) => p.costPrice > 0), p2 = prods.find((p) => p.id !== p1.id)
const stockOf = async (id) => (await (await api('/api/portal/products?limit=100', { cookie })).json()).products.find((p) => p.id === id)?.stock
const p1Stock0 = await stockOf(p1.id), p2Stock0 = await stockOf(p2.id)
const souss = (await (await api('/api/portal/suppliers', { method: 'POST', body: { name: 'Primeurs du Souss', phone: '0528123456', email: 'contact@souss.ma' }, cookie })).json()).supplier
const old = (await (await api('/api/portal/suppliers', { method: 'POST', body: { name: 'Ancien Grossiste' }, cookie })).json()).supplier
await api(`/api/portal/suppliers/${old.id}`, { method: 'PATCH', body: { isActive: false }, cookie })
check('catalogue + 2 suppliers (one inactive) through the API', prods.length >= 2 && !!souss?.id && !!old?.id)

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9355', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9355/json')).json(); if (targets.length) break } catch {} await sleep(500) }
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
// Sets an input/select/textarea value the way React sees it; `sel` may also be a JS expression returning the element
const setVal = (sel, v, expr = false) => js(`(() => { const el = ${expr ? sel : `document.querySelector(${JSON.stringify(sel)})`}; const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return !!el })()`)
const esc = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300) }
const toastHas = (re) => `${re}.test(document.querySelector('[data-testid=shell-toasts]')?.textContent || '')`
const kpi = (k) => `(document.querySelector('[data-testid=kpi-${k}] p:last-child')?.textContent || '').trim()`
const noPresentationalStyle = `[...document.querySelectorAll('#main-content [style], dialog[open] [style]')].filter(e => !e.hasAttribute('data-dynamic')).map(e => e.tagName + '.' + String(e.className).slice(0, 40))`
const settled = (sel) => `document.querySelector('${sel}')?.getAttribute('aria-busy') === 'false'`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

await view(1440)
await goto('/fr/portal/login')
await waitFor(`(() => { const i = document.querySelectorAll('form input')[1]; return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`)
const setLogin = (idx, v) => js(`(() => { const el = [...document.querySelectorAll('form input')][${idx}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
await setLogin(0, local); await setLogin(1, licenseKey)
await click('form button[type=submit]')
check('signed in to the portal', await waitFor(`location.pathname === '/fr/portal/dashboard'`))

// ═══ PURCHASES ═══════════════════════════════════════════════════════════════
await goto('/fr/portal/purchases')
check('achats fr: title, KPIs all 0, empty orders state', await waitFor(`document.querySelector('[data-testid=shell-title]')?.textContent === 'Achats' && ${kpi('draft')} === '0' && ${kpi('pending')} === '0' && ${kpi('received')} === '0' && /Aucun bon de commande/.test(document.querySelector('[data-testid=orders-empty]')?.textContent || '')`))
check('achats fr: LTR, tabs expose aria-selected', await js(`getComputedStyle(document.querySelector('[data-testid=orders-list]')).direction === 'ltr' && document.querySelector('[data-testid=tab-orders]').getAttribute('aria-selected') === 'true'`))

// suppliers tab
await click('[data-testid=tab-suppliers]')
const suppRows = `document.querySelectorAll('[data-testid=suppliers-list] tbody tr')`
check('suppliers: both listed, inactive badge, count', await waitFor(`${settled('[data-testid=suppliers-list]')} && ${suppRows}.length === 2 && document.querySelector('tr[data-supplier="Ancien Grossiste"] [data-active="0"]')?.textContent.trim() === 'Inactif' && document.querySelector('[data-testid=suppliers-count]')?.textContent === '2 fournisseurs'`, 30000))
check('suppliers: phone + email shown', await js(`/0528123456/.test(document.querySelector('tr[data-supplier="Primeurs du Souss"]').textContent) && /contact@souss.ma/.test(document.querySelector('tr[data-supplier="Primeurs du Souss"]').textContent)`))
await setVal('[data-testid=suppliers-search]', 'souss')
check('suppliers: search filters', await waitFor(`${settled('[data-testid=suppliers-list]')} && ${suppRows}.length === 1 && ${suppRows}[0].dataset.supplier === 'Primeurs du Souss'`, 20000))
await setVal('[data-testid=suppliers-search]', 'zzz')
check('suppliers: no match + clear', await waitFor(`/Aucun fournisseur ne correspond/.test(document.querySelector('[data-testid=suppliers-empty]')?.textContent || '')`, 20000))
await js(`document.querySelector('[data-testid=suppliers-empty] button').click(); true`)
await waitFor(`${suppRows}.length === 2`, 20000)

await click('[data-testid=supplier-add]'); await sleep(300)
check('supplier add dialog opens with focus inside', await js(`document.querySelector('[data-testid=supplier-form]')?.open && document.querySelector('[data-testid=supplier-form]').contains(document.activeElement)`))
await click('[data-testid=supplier-save]'); await sleep(200)
check('supplier: name required (fr)', (await text('[data-testid=supplier-error]')) === 'Le nom est obligatoire.')
await setVal('[data-testid=s-name]', 'Primeurs du Souss'); await click('[data-testid=supplier-save]')
check('supplier: duplicate name from the API, translated', await waitFor(`(document.querySelector('[data-testid=supplier-error]')?.textContent || '') === 'Un fournisseur porte déjà ce nom.'`, 20000), await text('[data-testid=supplier-error]'))
await setVal('[data-testid=s-name]', 'Épices Atlas'); await setVal('[data-testid=s-email]', 'pas-un-email'); await click('[data-testid=supplier-save]')
check('supplier: invalid email from the API, translated', await waitFor(`/e-mail n’est pas valide/.test(document.querySelector('[data-testid=supplier-error]')?.textContent || '')`, 20000))
await setVal('[data-testid=s-email]', 'ventes@atlas.ma'); await setVal('[data-testid=s-phone]', '0522334455'); await click('[data-testid=supplier-save]')
check('supplier added: toast, row, count 3', await waitFor(`!document.querySelector('[data-testid=supplier-form]') && ${toastHas('/Fournisseur ajouté/')} && !!document.querySelector('tr[data-supplier="Épices Atlas"]') && document.querySelector('[data-testid=suppliers-count]').textContent === '3 fournisseurs'`, 20000))
await click('tr[data-supplier="Épices Atlas"] [data-testid=supplier-edit]'); await sleep(300)
check('supplier edit: form pre-filled, active toggle shown', await js(`document.querySelector('[data-testid=s-name]').value === 'Épices Atlas' && document.querySelector('[data-testid=s-email]').value === 'ventes@atlas.ma' && document.querySelector('[data-testid=s-active]').checked`))
await setVal('[data-testid=s-address]', 'Souk El Had, Agadir'); await click('[data-testid=supplier-save]')
await waitFor(`${toastHas('/Fournisseur enregistré/')}`, 20000)
const atlas = (await (await api('/api/portal/suppliers?search=Atlas', { cookie })).json()).suppliers[0]
check('supplier edit persisted through the API', atlas?.address === 'Souk El Had, Agadir' && atlas.isActive === true)
check('suppliers: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-suppliers')

// new order
await click('[data-testid=tab-orders]')
await waitFor(`!!document.querySelector('[data-testid=order-new]')`, 10000)
await click('[data-testid=order-new]')
check('new order: only active suppliers offered', await waitFor(`(() => { const o = [...document.querySelectorAll('[data-testid=order-supplier] option')].map(x => x.textContent); return o.includes('Primeurs du Souss') && o.includes('Épices Atlas') && !o.includes('Ancien Grossiste') })()`, 20000))
await click('[data-testid=order-save]'); await sleep(200)
check('new order: supplier required', (await text('[data-testid=order-error]')) === 'Choisissez un fournisseur.')
await setVal('[data-testid=order-supplier]', souss.id); await click('[data-testid=order-save]'); await sleep(200)
check('new order: at least one item', (await text('[data-testid=order-error]')) === 'Ajoutez au moins un article.')
await click('[data-testid=order-add-line]'); await sleep(200)
const line = (i, f) => `document.querySelectorAll('[data-testid=order-lines] li')[${i}].querySelector('[data-testid=${f}]')`
await setVal(line(0, 'line-product'), p1.id, true); await sleep(150)
check('new order: unit cost pre-filled from the catalogue', await js(`Number(${line(0, 'line-cost')}.value) === ${p1.costPrice}`), `${await js(`${line(0, 'line-cost')}.value`)} vs ${p1.costPrice}`)
await setVal(line(0, 'line-qty'), '10', true)
await click('[data-testid=order-add-line]'); await sleep(200)
check('new order: an item already chosen is disabled on the next line', await js(`[...${line(1, 'line-product')}.options].find(o => o.value === ${JSON.stringify(p1.id)}).disabled`))
await setVal(line(1, 'line-product'), p2.id, true); await setVal(line(1, 'line-qty'), '4', true); await setVal(line(1, 'line-cost'), '2.5', true)
const expTotal = 10 * p1.costPrice + 4 * 2.5
check('new order: live total', await waitFor(`document.querySelector('[data-testid=order-form-total]').textContent === ${JSON.stringify(frMoney(expTotal))}`, 5000), await text('[data-testid=order-form-total]'))
await setVal('[data-testid=order-notes]', 'Livraison avant 9 h')
await shot('fr-1440-order-form')
await click('[data-testid=order-save]')
const orderRows = `document.querySelectorAll('[data-testid=orders-list] tbody tr')`
check('order created: toast, draft row, KPI drafts = 1', await waitFor(`${toastHas('/Bon de commande créé/')} && ${orderRows}.length === 1 && ${orderRows}[0].querySelector('[data-status=draft]') && ${kpi('draft')} === '1'`, 20000))
const order = (await (await api('/api/portal/purchase-orders?limit=5', { cookie })).json()).orders[0]
check('order total = API total', await js(`${orderRows}[0].textContent.includes(${JSON.stringify(frMoney(order.totalCost))})`) && Math.abs(order.totalCost - expTotal) < 0.001)

// detail → send
await js(`${orderRows}[0].click(); true`)
check('detail: 2 lines, total, notes', await waitFor(`document.querySelector('[data-testid=order-detail]')?.open && document.querySelectorAll('[data-testid=order-items] tbody tr').length === 2 && document.querySelector('[data-testid=order-total]').textContent === ${JSON.stringify(frMoney(order.totalCost))} && /Livraison avant 9 h/.test(document.querySelector('[data-testid=order-detail]').textContent)`, 10000))
await click('[data-testid=order-detail-send]')
check('send: status Envoyée in the dialog, KPI pending = 1', await waitFor(`document.querySelector('[data-testid=order-detail] [data-status=ordered]')?.textContent === 'Envoyée' && ${kpi('pending')} === '1' && ${kpi('draft')} === '0'`, 20000))
await esc()
check('Escape closes the detail', await js(`!document.querySelector('dialog[open]')`))

// partial receipt
await click('[data-testid=order-receive]')
const rq = (name) => `document.querySelector('[data-testid=receive-qty][data-product=${JSON.stringify(name)}]')`
check('receive: quantities default to what remains', await waitFor(`${rq(p1.name)}?.value === '10' && ${rq(p2.name)}?.value === '4'`, 10000))
await setVal(rq(p1.name), '0', true); await setVal(rq(p2.name), '0', true); await click('[data-testid=receive-submit]'); await sleep(200)
check('receive: nothing entered is refused', (await text('[data-testid=receive-error]')) === 'Saisissez au moins une quantité.')
await setVal(rq(p1.name), '6', true)
await click('[data-testid=receive-submit]')
check('partial receipt: toast, detail shows Partielle and 6 received', await waitFor(`${toastHas('/Réception enregistrée/')} && document.querySelector('[data-testid=order-detail] [data-status=partial]') && document.querySelector('[data-testid=order-items] tr[data-product=${JSON.stringify(p1.name)}] [data-received]')?.dataset.received === '6'`, 20000))
check('partial receipt: stock +6 on the product', (await stockOf(p1.id)) === p1Stock0 + 6, `${await stockOf(p1.id)} vs ${p1Stock0} + 6`)
await click('[data-testid=order-detail-receive]')
check('second receipt: only the remainder is proposed', await waitFor(`${rq(p1.name)}?.value === '4' && ${rq(p2.name)}?.value === '4'`, 10000))
await click('[data-testid=receive-submit]')
check('full receipt: Reçue, KPI received = 1, pending = 0', await waitFor(`document.querySelector('[data-testid=order-detail] [data-status=received]') && ${kpi('received')} === '1' && ${kpi('pending')} === '0'`, 20000))
check('full receipt: stock = start + ordered on both products', (await stockOf(p1.id)) === p1Stock0 + 10 && (await stockOf(p2.id)) === p2Stock0 + 4)
check('received order: no cancel or receive action left', await js(`!document.querySelector('[data-testid=order-cancel]') && !document.querySelector('[data-testid=order-detail-receive]')`))
await shot('fr-1440-order-detail')
await esc()

// cancel (second order through the API)
const o2 = (await (await api('/api/portal/purchase-orders', { method: 'POST', body: { supplierId: souss.id, items: [{ productId: p2.id, qtyOrdered: 3, unitCost: 1 }] }, cookie })).json()).order
await goto('/fr/portal/purchases')
await waitFor(`${orderRows}.length === 2`, 30000)
await js(`document.querySelector('tr[data-order="${o2.id}"]').click(); true`)
await waitFor(`!!document.querySelector('[data-testid=order-cancel]')`, 10000)
await click('[data-testid=order-cancel]')
check('cancel asks for confirmation inside the dialog', await waitFor(`!!document.querySelector('[data-testid=order-cancel-confirm]') && /Le stock déjà reçu reste en place/.test(document.querySelector('[data-testid=order-detail]').textContent)`, 5000))
await click('[data-testid=order-cancel-confirm]')
const cancelT0 = Date.now()
check('cancelled: toast', await waitFor(`${toastHas('/Commande annulée/')}`, 20000), `${Date.now() - cancelT0} ms · ${await text('[data-testid=shell-toasts]')}`)
check('cancelled: status Annulée in the dialog', await waitFor(`!!document.querySelector('[data-testid=order-detail] [data-status=cancelled]')`, 20000))
await esc()

// status filters
await click('[data-testid=status-received]')
check('filter Reçue: 1 row', await waitFor(`${settled('[data-testid=orders-list]')} && ${orderRows}.length === 1 && ${orderRows}[0].querySelector('[data-status=received]') && document.querySelector('[data-testid=status-received]').getAttribute('aria-pressed') === 'true'`, 20000))
await click('[data-testid=status-partial]')
check('filter Partielle: empty state + show all', await waitFor(`/Aucune commande avec ce statut/.test(document.querySelector('[data-testid=orders-empty]')?.textContent || '')`, 20000))
await js(`document.querySelector('[data-testid=orders-empty] button').click(); true`)
check('show all: both orders back', await waitFor(`${settled('[data-testid=orders-list]')} && ${orderRows}.length === 2`, 20000))
check('orders: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-orders')

// ar / en
await goto('/ar/portal/purchases')
check('achats ar: RTL, Arabic tabs and statuses, درهم', await waitFor(`${orderRows}.length === 2 && getComputedStyle(document.querySelector('[data-testid=orders-list]')).direction === 'rtl' && document.querySelector('[data-testid=tab-suppliers]').textContent === 'الموردون' && /مُستلَم/.test(document.querySelector('[data-testid=orders-list]').textContent) && /درهم/.test(document.querySelector('[data-testid=orders-list]').textContent) && document.querySelector('[data-testid=shell-title]').textContent === 'المشتريات'`, 30000))
await shot('ar-1440-orders')
await goto('/en/portal/purchases')
check('achats en: English KPIs and filters', await waitFor(`${orderRows}.length === 2 && /Awaiting delivery/.test(document.body.textContent) && document.querySelector('[data-testid=status-cancelled]').textContent === 'Cancelled'`, 30000))

// 375 px
await view(375, 812)
await goto('/fr/portal/purchases')
check('achats 375 px: cards, no horizontal scroll', await waitFor(`document.querySelectorAll('[data-testid=orders-list] li').length === 2 && getComputedStyle(document.querySelector('[data-testid=orders-list] table').parentElement).display === 'none' && document.documentElement.scrollWidth <= innerWidth`, 30000))
await click('[data-testid=order-new]')
await waitFor(`!!document.querySelector('[data-testid=order-form]')?.open`, 5000)
await click('[data-testid=order-add-line]'); await sleep(300)
check('achats 375 px: new order dialog fits', await js(`(() => { const d = document.querySelector('[data-testid=order-form]').getBoundingClientRect(); return d.left >= 0 && d.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth })()`))
await shot('fr-375-order-form')
await esc()
await view(1440)

// ═══ EMPLOYEES ═══════════════════════════════════════════════════════════════
const cards = `document.querySelectorAll('[data-testid=employees-list] li[data-employee]')`
await goto('/fr/portal/employees')
check('employés fr: title + empty state', await waitFor(`document.querySelector('[data-testid=shell-title]')?.textContent === 'Employés' && /Aucun employé/.test(document.querySelector('[data-testid=employees-empty]')?.textContent || '')`, 30000))
await click('[data-testid=employee-add]'); await sleep(300)
await click('[data-testid=employee-save]'); await sleep(200)
check('employee: name required', (await text('[data-testid=employee-error]')) === 'Le nom est obligatoire.')
await setVal('[data-testid=e-name]', 'Fatima Zahra')
check('employee: login suggested from the name', await js(`document.querySelector('[data-testid=e-login]').value === 'fatimazahra'`))
check('employee: role help follows the role', await js(`/Encaisse les ventes/.test(document.querySelector('[data-testid=e-role-help]').textContent)`))
await setVal('[data-testid=e-pin]', '12'); await click('[data-testid=employee-save]'); await sleep(200)
check('employee: PIN too short', (await text('[data-testid=employee-error]')) === 'Le code PIN doit comporter 4 à 6 chiffres.')
await setVal('[data-testid=e-pin]', '1234'); await setVal('[data-testid=e-pin2]', '4321'); await click('[data-testid=employee-save]'); await sleep(200)
check('employee: PIN mismatch', (await text('[data-testid=employee-error]')) === 'Les deux codes PIN ne correspondent pas.')
check('employee: PIN fields are masked, digits only', await js(`document.querySelector('[data-testid=e-pin]').type === 'password' && document.querySelector('[data-testid=e-pin]').getAttribute('autocomplete') === 'new-password'`))
await setVal('[data-testid=e-pin2]', '1234'); await setVal('[data-testid=e-phone]', '0612345678')
await click('[data-testid=employee-save]')
check('employee added: toast, card, Caissier, count', await waitFor(`${toastHas('/Employé ajouté/')} && ${cards}.length === 1 && document.querySelector('li[data-employee=fatimazahra] [data-role=cashier]')?.textContent === 'Caissier' && document.querySelector('[data-testid=employees-count]').textContent === '1 employé'`, 20000))
await api('/api/portal/employees', { method: 'POST', body: { name: 'Youssef Amrani', loginId: 'youssef01', pin: '5555', role: 'manager' }, cookie })
await click('[data-testid=employee-add]'); await sleep(300)
await setVal('[data-testid=e-name]', 'Autre Youssef'); await setVal('[data-testid=e-login]', 'youssef01'); await setVal('[data-testid=e-pin]', '1111'); await setVal('[data-testid=e-pin2]', '1111')
await click('[data-testid=employee-save]')
check('employee: duplicate login from the API, translated', await waitFor(`(document.querySelector('[data-testid=employee-error]')?.textContent || '') === 'Cet identifiant est déjà utilisé.'`, 20000), await text('[data-testid=employee-error]'))
await esc()
await goto('/fr/portal/employees')
check('2 employees, Gérant badge', await waitFor(`${cards}.length === 2 && document.querySelector('li[data-employee=youssef01] [data-role=manager]')?.textContent === 'Gérant' && document.querySelector('[data-testid=employees-count]').textContent === '2 employés'`, 30000))

await click('li[data-employee=fatimazahra] [data-testid=employee-edit]'); await sleep(300)
check('edit: pre-filled, no login/PIN fields', await js(`document.querySelector('[data-testid=e-name]').value === 'Fatima Zahra' && !document.querySelector('[data-testid=e-login]') && !document.querySelector('[data-testid=e-pin]')`))
await setVal('[data-testid=e-role]', 'manager'); await setVal('[data-testid=e-phone]', '0699887766')
await click('[data-testid=employee-save]')
const editT0 = Date.now()
check('edit saved: toast', await waitFor(`${toastHas('/Employé enregistré/')}`, 20000), `${Date.now() - editT0} ms · ${await text('[data-testid=shell-toasts]')}`)
check('edit saved: badge Gérant', await waitFor(`!!document.querySelector('li[data-employee=fatimazahra] [data-role=manager]')`, 20000))
const fatima = (await (await api('/api/portal/employees', { cookie })).json()).employees.find((e) => e.loginId === 'fatimazahra')
check('edit persisted, PIN hash never returned', fatima?.role === 'manager' && fatima.phone === '0699887766' && !('pinHash' in fatima) && !('pin' in fatima))

await click('li[data-employee=fatimazahra] [data-testid=employee-pin]'); await sleep(300)
await setVal('[data-testid=pin-new]', '987654'); await setVal('[data-testid=pin-confirm]', '987650'); await click('[data-testid=pin-save]'); await sleep(200)
check('PIN change: mismatch refused', (await text('[data-testid=pin-error]')) === 'Les deux codes PIN ne correspondent pas.')
await setVal('[data-testid=pin-confirm]', '987654'); await click('[data-testid=pin-save]')
check('PIN change: toast', await waitFor(`${toastHas('/Code PIN de Fatima Zahra mis à jour/')}`, 20000))
const pinNew = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'fatimazahra', pin: '987654' }, cookie })
const pinOld = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'fatimazahra', pin: '1234' }, cookie })
check('PIN change is real: new PIN signs in, old one is refused', pinNew.status === 200 && pinOld.status === 401, `${pinNew.status} / ${pinOld.status}`)

await click('li[data-employee=youssef01] [data-testid=employee-deactivate]')
check('deactivate asks for confirmation', await waitFor(`document.querySelector('[data-testid=employee-off]')?.open && /historique de ventes est conservé/.test(document.querySelector('[data-testid=employee-off]').textContent)`, 5000))
await click('[data-testid=employee-off-confirm]')
check('deactivated: toast, card gone, count 1', await waitFor(`${toastHas('/Employé désactivé/')} && ${cards}.length === 1 && document.querySelector('[data-testid=employees-count]').textContent === '1 employé'`, 20000))
check('deactivated employee cannot sign in', (await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'youssef01', pin: '5555' }, cookie })).status === 401)
await click('[data-testid=employees-show-inactive]')
check('show inactive: card back with Désactivé badge', await waitFor(`${cards}.length === 2 && !!document.querySelector('li[data-employee=youssef01] [data-testid=employee-inactive]')`, 20000))
await click('li[data-employee=youssef01] [data-testid=employee-reactivate]')
check('reactivated: toast, can sign in again', await waitFor(`${toastHas('/Employé réactivé/')} && !document.querySelector('li[data-employee=youssef01] [data-testid=employee-inactive]')`, 20000) && (await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'youssef01', pin: '5555' }, cookie })).status === 200)
check('employees: no presentational inline styles', (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
await shot('fr-1440-employees')

const yid = (await (await api('/api/portal/employees', { cookie })).json()).employees.find((e) => e.loginId === 'youssef01').id
const badName = await api(`/api/portal/employees/${yid}`, { method: 'PATCH', body: { name: '  ' }, cookie })
const badActive = await api(`/api/portal/employees/${yid}`, { method: 'PATCH', body: { isActive: 'yes' }, cookie })
check('API: empty name and non-boolean isActive → 422', badName.status === 422 && badActive.status === 422, `${badName.status} / ${badActive.status}`)

await goto('/ar/portal/employees')
check('employés ar: RTL, Arabic roles and count', await waitFor(`${cards}.length === 2 && getComputedStyle(document.querySelector('[data-testid=employees-list]')).direction === 'rtl' && document.querySelector('li[data-employee=youssef01] [data-role]').textContent === 'مدير' && document.querySelector('[data-testid=employees-count]').textContent === 'موظفان' && document.querySelector('[data-testid=shell-title]').textContent === 'الموظفون'`, 30000), await text('[data-testid=employees-count]'))
await shot('ar-1440-employees')
await goto('/en/portal/employees')
check('employés en: English labels', await waitFor(`${cards}.length === 2 && document.querySelector('[data-testid=employees-count]').textContent === '2 employees' && /Last sign-in/.test(document.querySelector('[data-testid=employees-list]').textContent)`, 30000))
await view(375, 812)
await goto('/fr/portal/employees')
check('employés 375 px: one column, no horizontal scroll', await waitFor(`${cards}.length === 2 && document.documentElement.scrollWidth <= innerWidth && (() => { const [a, b] = [...${cards}].map(e => e.getBoundingClientRect()); return Math.abs(a.left - b.left) < 2 && b.top > a.top })()`, 30000))
await shot('fr-375-employees')

const relevant = problems.filter((p) => !/Failed to load resource|401|409|422/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
