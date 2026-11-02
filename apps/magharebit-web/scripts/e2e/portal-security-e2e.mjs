// Security regression suite for /api/portal/* and /api/auth/* (API only, no browser). Two real merchants are created
// through the signup APIs; merchant B then attacks merchant A.
//   Tenant isolation: B cannot read, change or delete A's product, customer, supplier, purchase order, employee or
//     campaign (404, and A's data is unchanged afterwards).
//   Injection / types: operator objects in login and product bodies are refused (400/422, never 500, nothing stored);
//     unknown keys never reach MongoDB.
//   LAW 1: a manual stock adjustment cannot take stock below zero (atomic), a non-number delta is refused.
//   PIN: 10 attempts per login / 15 min, then 429 even for the right PIN; comparison is constant time (code review).
//   Tokens: HMAC-SHA256 tokens verify; tampered, exp-less and expired tokens are refused; the previous sha256 format
//     is still accepted during the transition window; the cookie is HttpOnly, SameSite=Lax, Path=/.
// Reported, not asserted (needs a human-reviewed fix, see the audit): a portal sale larger than the stock still
// drives stock negative.
// Drops its database. Run: APP_DIR=. BASE=… MONGODB_DB=… [ENV_FILE=.env.development.local] node scripts/e2e/portal-security-e2e.mjs
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3021'
const APP = resolve(process.env.APP_DIR || process.cwd())
const ENV = readFileSync(resolve(APP, process.env.ENV_FILE || '.env.local'), 'utf8')
const SECRET = (ENV.match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient, ObjectId } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_sec')
await db.dropDatabase()
await db.collection('customers').createIndex({ merchantId: 1, phone: 1 }, { unique: true })
await db.collection('suppliers').createIndex({ merchantId: 1, name: 1 }, { unique: true })
await db.collection('employees').createIndex({ merchantId: 1, loginId: 1 }, { unique: true })
await db.collection('transactions').createIndex({ receiptNo: 1, merchantId: 1 }, { unique: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { for (let i = 0; ; i++) { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET' || i >= 3) throw e; await sleep(300) } } }
const api = (path, { method = 'GET', body, cookie, raw } = {}) => fetch(B + path, { method, headers: { ...(body !== undefined || raw ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }

async function merchant(n) {
  const local = `066${n}` + String(Date.now()).slice(-6); const phone = '212' + local.slice(1)
  await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
  const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
  const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
  const su = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: `Boutique ${n}`, sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
  const { licenseKey } = await su.json()
  // a real portal login (exercises the login route and its cookie)
  const login = await api('/api/portal/auth/login', { method: 'POST', body: { identifier: local, licenseKey } })
  return { local, licenseKey, login, cookie: cookieOf(login) }
}

const A = await merchant(1), Bm = await merchant(2)
check('two merchants signed in through /api/portal/auth/login', A.login.status === 200 && Bm.login.status === 200)
const setCookie = (A.login.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('portal_session=')) || ''
check('portal_session cookie: HttpOnly, SameSite=Lax, Path=/ (Secure is added in production)', /HttpOnly/i.test(setCookie) && /SameSite=lax/i.test(setCookie) && /Path=\//.test(setCookie), setCookie.replace(/=[^;]+/, '=…'))
const meA = await (await api('/api/portal/auth/me', { cookie: A.cookie })).json()
const merchantIdA = meA.merchantId ?? meA.merchant?.id ?? meA.id

// ── A's data ────────────────────────────────────────────────────────────────
await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'epicerie' }, cookie: A.cookie })
const prodA = (await (await api('/api/portal/products?limit=5', { cookie: A.cookie })).json()).products[0]
const custA = (await (await api('/api/portal/customers', { method: 'POST', body: { name: 'Client A', phone: '0611111111' }, cookie: A.cookie })).json()).customer
const suppA = (await (await api('/api/portal/suppliers', { method: 'POST', body: { name: 'Fournisseur A' }, cookie: A.cookie })).json()).supplier
const poA = (await (await api('/api/portal/purchase-orders', { method: 'POST', body: { supplierId: suppA.id, items: [{ productId: prodA.id, qtyOrdered: 2, unitCost: 1 }] }, cookie: A.cookie })).json()).order
const empA = (await (await api('/api/portal/employees', { method: 'POST', body: { name: 'Gérant A', loginId: 'gerant', pin: '4321', role: 'manager' }, cookie: A.cookie })).json()).employee
const campR = await api('/api/portal/whatsapp/campaigns', { method: 'POST', body: { title: 'Promo A', messageTemplate: 'Bonjour', targetAudience: 'all' }, cookie: A.cookie })
const campA = campR.ok ? ((await campR.json()).campaign ?? null) : null
check("merchant A's records created", !!(prodA && custA && suppA && poA && empA))

// ── tenant isolation: B against A ───────────────────────────────────────────
const probes = [
  ['product', `/api/portal/products/${prodA.id}`, { name: 'pwned' }],
  ['customer', `/api/portal/customers/${custA.id}`, { name: 'pwned' }],
  ['supplier', `/api/portal/suppliers/${suppA.id}`, { name: 'pwned' }],
  ['purchase order', `/api/portal/purchase-orders/${poA.id}`, { status: 'cancelled' }],
  ['employee', `/api/portal/employees/${empA.id}`, { name: 'pwned' }],
  ...(campA ? [['campaign', `/api/portal/whatsapp/campaigns/${campA.id}`, { title: 'pwned' }]] : []),
]
for (const [what, path, patch] of probes) {
  const g = await api(path, { cookie: Bm.cookie })
  const p = await api(path, { method: 'PATCH', body: patch, cookie: Bm.cookie })
  check(`IDOR: B cannot read or change A's ${what}`, g.status === 404 && p.status === 404, `GET ${g.status} PATCH ${p.status}`)
}
const delP = await api(`/api/portal/products/${prodA.id}`, { method: 'DELETE', cookie: Bm.cookie })
const delE = await api(`/api/portal/employees/${empA.id}`, { method: 'DELETE', cookie: Bm.cookie })
const rcv = await api(`/api/portal/purchase-orders/${poA.id}/receive`, { method: 'POST', body: { items: [{ productId: prodA.id, qtyReceive: 1 }] }, cookie: Bm.cookie })
const adj = await api(`/api/portal/products/${prodA.id}/adjust`, { method: 'POST', body: { delta: -1, reason: 'manual_remove' }, cookie: Bm.cookie })
const hist = await api(`/api/portal/customers/${custA.id}/transactions`, { cookie: Bm.cookie })
check("IDOR: B cannot delete, receive, adjust or list A's history", [delP, delE, rcv, adj].every((r) => r.status === 404) && (hist.status === 404 || (hist.ok && (await hist.json()).transactions?.length === 0)), [delP, delE, rcv, adj, hist].map((r) => r.status).join(' '))
const pin = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'gerant', pin: '4321' }, cookie: Bm.cookie })
check("IDOR: B cannot sign in as A's employee with the right PIN", pin.status === 401, String(pin.status))
const listB = await (await api('/api/portal/customers', { cookie: Bm.cookie })).json()
const txB = await (await api('/api/portal/transactions?limit=100', { cookie: Bm.cookie })).json()
check("lists are scoped: B sees none of A's customers or sales", listB.total === 0 && txB.total === 0)
const prodAafter = (await (await api(`/api/portal/products/${prodA.id}`, { cookie: A.cookie })).json()).product
const empAafter = (await (await api('/api/portal/employees', { cookie: A.cookie })).json()).employees.find((e) => e.id === empA.id)
check("A's data is unchanged after the attacks", prodAafter?.name === prodA.name && prodAafter.stock === prodA.stock && prodAafter.isActive && empAafter?.isActive)
check('a merchantId in the body is ignored (sale is booked to the session merchant)', await (async () => {
  const r = await api('/api/portal/transactions', { method: 'POST', body: { merchantId: merchantIdA, items: [{ productId: prodA.id, qty: 1 }], paymentMethod: 'cash', taxRate: 0 }, cookie: Bm.cookie })
  return r.status === 404 || r.status === 422
})())

// ── injection / types ───────────────────────────────────────────────────────
const inj = await api('/api/portal/auth/login', { method: 'POST', body: { identifier: { $ne: null }, licenseKey: { $gt: '' } } })
check('login: operator objects → 400, not 500, no session', inj.status === 400 && !(inj.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('portal_session=')), String(inj.status))
const injArr = await api('/api/portal/auth/login', { method: 'POST', raw: '[1,2]' })
check('login: a JSON array → 400', injArr.status === 400, String(injArr.status))
const bad = [
  [{ price: { $gt: 0 } }, 'price_invalid'],
  [{ stock: -5 }, 'stock_invalid'],
  [{ stock: 'beaucoup' }, 'stock_invalid'],
  [{ name: { $set: 'x' } }, 'name_invalid'],
  [{ name: 'x'.repeat(500) }, 'name_invalid'],
  [{ isActive: 'yes' }, 'isActive_invalid'],
  [{ $set: { merchantId: 'other' }, merchantId: 'other' }, 'no_fields_to_update'],
]
for (const [patch, code] of bad) {
  const r = await api(`/api/portal/products/${prodA.id}`, { method: 'PATCH', body: patch, cookie: A.cookie })
  const j = await r.json().catch(() => ({}))
  check(`product PATCH ${JSON.stringify(patch).slice(0, 40)} → 422 ${code}`, r.status === 422 && j.error === code, `${r.status} ${j.error}`)
}
const stored = await db.collection('products').findOne({ _id: new ObjectId(prodA.id) })
check('nothing of the above reached MongoDB', stored.merchantId === merchantIdA && typeof stored.price === 'number' && stored.stock >= 0 && typeof stored.name === 'string' && stored.name.length < 200)
const okPatch = await api(`/api/portal/products/${prodA.id}`, { method: 'PATCH', body: { price: 12.5, stock: 40, unit: 'mL', name: 'Huile' }, cookie: A.cookie })
check('a valid PATCH (incl. a UI unit outside the old type) still works', okPatch.status === 200 && (await okPatch.json()).product?.price === 12.5)
const badId = await api('/api/portal/products/not-an-id', { method: 'PATCH', body: { price: 1 }, cookie: A.cookie })
check('a malformed id → 404, not 500', badId.status === 404, String(badId.status))
const badPost = await api('/api/portal/products', { method: 'POST', body: { name: 'X', category: 'Y', price: 1, stock: { $gt: 1 } }, cookie: A.cookie })
check('product POST with an operator object → 422', badPost.status === 422, String(badPost.status))
const nullPost = await api('/api/portal/products', { method: 'POST', body: { name: 'Sans stock', category: 'Divers', price: 3, stock: null, minStock: null, costPrice: null }, cookie: A.cookie })
check('product POST with empty optional fields (null) uses the defaults', nullPost.status === 201, String(nullPost.status))

// ── LAW 1: manual adjustments ───────────────────────────────────────────────
const neg = await api(`/api/portal/products/${prodA.id}/adjust`, { method: 'POST', body: { delta: -1000, reason: 'manual_remove' }, cookie: A.cookie })
const negJ = await neg.json().catch(() => ({}))
const afterNeg = (await (await api(`/api/portal/products/${prodA.id}`, { cookie: A.cookie })).json()).product
check('adjust −1000 on a stock of 40 → 409 stock_would_be_negative, stock untouched', neg.status === 409 && negJ.error === 'stock_would_be_negative' && afterNeg.stock === 40, `${neg.status} ${negJ.error} stock=${afterNeg.stock}`)
const nan = await api(`/api/portal/products/${prodA.id}/adjust`, { method: 'POST', body: { delta: 'abc', reason: 'manual_remove' }, cookie: A.cookie })
check('adjust with a non-number delta → 422 (used to store NaN)', nan.status === 422, String(nan.status))
const race = await Promise.all(Array.from({ length: 10 }, () => api(`/api/portal/products/${prodA.id}/adjust`, { method: 'POST', body: { delta: -5, reason: 'manual_remove' }, cookie: A.cookie })))
const afterRace = (await (await api(`/api/portal/products/${prodA.id}`, { cookie: A.cookie })).json()).product
check('10 concurrent −5 on a stock of 40: exactly 8 succeed, stock ends at 0, never below', race.filter((r) => r.status === 200).length === 8 && race.filter((r) => r.status === 409).length === 2 && afterRace.stock === 0, `ok=${race.filter((r) => r.status === 200).length} stock=${afterRace.stock}`)

// ── PIN brute force ─────────────────────────────────────────────────────────
const statuses = []
for (let i = 0; i < 10; i++) statuses.push((await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'gerant', pin: String(1000 + i) }, cookie: A.cookie })).status)
const eleventh = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'gerant', pin: '4321' }, cookie: A.cookie })
check('PIN: 10 wrong guesses are 401, the 11th attempt is 429 even with the right PIN', statuses.every((s) => s === 401) && eleventh.status === 429 && !!eleventh.headers.get('retry-after'), `${statuses.join(',')} → ${eleventh.status}`)
const other = await api('/api/portal/employees', { method: 'POST', body: { name: 'Caissier', loginId: 'caisse', pin: '1111', role: 'cashier' }, cookie: A.cookie })
const otherLogin = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: 'caisse', pin: '1111' }, cookie: A.cookie })
check('the limit is per login: another employee still signs in', other.status === 201 && otherLogin.status === 200, `${other.status} ${otherLogin.status}`)
const pinObj = await api('/api/portal/employees/pin-login', { method: 'POST', body: { loginId: { $ne: null }, pin: { $ne: null } }, cookie: A.cookie })
check('PIN login with operator objects → 422', pinObj.status === 422, String(pinObj.status))

// ── tokens ──────────────────────────────────────────────────────────────────
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const hmac = (e) => createHmac('sha256', SECRET).update(e).digest('hex')
const legacy = (e) => createHash('sha256').update(`${e}:${SECRET}`).digest('hex')
const me = async (token) => (await api('/api/portal/auth/me', { cookie: `portal_session=${token}` })).status
const good = enc({ merchantId: merchantIdA, identifier: A.local, exp: Date.now() + 60_000 })
check('HMAC-signed token with exp → accepted', (await me(`${good}.${hmac(good)}`)) === 200)
check('the token the server issued is HMAC (not the old sha256 format)', (() => { const [e, s] = A.cookie.split('=')[1].split('.'); return s === hmac(e) })())
check('tampered payload (other merchant) with the original signature → 401', (await me(`${enc({ merchantId: 'x'.repeat(24), identifier: A.local, exp: Date.now() + 60_000 })}.${hmac(good)}`)) === 401)
const noExp = enc({ merchantId: merchantIdA, identifier: A.local })
check('token without exp → 401 (used to be valid forever)', (await me(`${noExp}.${hmac(noExp)}`)) === 401)
const expired = enc({ merchantId: merchantIdA, identifier: A.local, exp: Date.now() - 1000 })
check('expired token → 401', (await me(`${expired}.${hmac(expired)}`)) === 401)
check('previous sha256-format token → still accepted during the transition', (await me(`${good}.${legacy(good)}`)) === 200)
check('a token with an extra segment → 401', (await me(`${good}.${hmac(good)}.x`)) === 401)

// ── reported, not asserted ─────────────────────────────────────────────────
const p2 = (await (await api('/api/portal/products?limit=5', { cookie: A.cookie })).json()).products.find((p) => p.id !== prodA.id)
await api(`/api/portal/products/${p2.id}`, { method: 'PATCH', body: { stock: 2 }, cookie: A.cookie })
const over = await api('/api/portal/transactions', { method: 'POST', body: { items: [{ productId: p2.id, qty: 5 }], paymentMethod: 'cash', taxRate: 0 }, cookie: A.cookie })
const p2after = (await (await api(`/api/portal/products/${p2.id}`, { cookie: A.cookie })).json()).product
console.log(`INFO  open finding SEC-03 (human fix): sale of 5 with stock 2 → ${over.status}, stock now ${p2after.stock}`)

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
