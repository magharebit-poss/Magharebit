// Landing demo video + WhatsApp dispatch (the notification paths that exist in this app), on a dev server.
//
// Video (/fr): with NO source configured the section says so and the modal shows "bientôt disponible" (the real
// reason nothing plays today); with a real same-origin .webm the modal opens a <video> that actually plays (readyState,
// currentTime advances, not paused, MIME type on the <source>); with the file corrupted or missing the visitor gets a
// readable error with a direct link instead of a black box. Chrome records a real 2 s .webm itself (no ffmpeg needed);
// it is written to public/media/ for the run and always deleted.
//
// Dispatch (a mock Green API on 127.0.0.1 — nothing real is ever contacted): a sale returns before the WhatsApp
// calls are done and the calls still arrive afterwards (after()); a hanging Green API is cut off by the send timeout
// instead of holding the daily-report loop; the daily-report run stops at its time budget and says how many
// merchants it did not reach (`remaining`, `incomplete`).
//
// The caller starts the dev server with:
//   NEXT_PUBLIC_DEMO_VIDEO_URL=/media/_e2e-demo.webm   (MODE=full)  — unset/empty for MODE=baseline
//   GREEN_API_INSTANCE_ID=TEST GREEN_API_API_TOKEN=TOKEN GREEN_API_BASE_URL=http://127.0.0.1:4545
//   GREEN_API_TIMEOUT_MS=1500 DAILY_REPORT_TIME_BUDGET_MS=2500 MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=<DB>
// Run: APP_DIR=. BASE=http://localhost:3004 MONGODB_DB=<DB> CHROME=… PROFILE=… [OUT=…] [MODE=baseline|full] [ENV_FILE=.env.development.local] node scripts/e2e/landing-video-dispatch-e2e.mjs
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const B = process.env.BASE || 'http://localhost:3004'
const MODE = process.env.MODE || 'full'
const APP = resolve(process.env.APP_DIR || process.cwd())
const OUT = process.env.OUT; if (OUT) mkdirSync(OUT, { recursive: true })
const ENV = readFileSync(resolve(APP, process.env.ENV_FILE || '.env.local'), 'utf8')
const SECRET = (ENV.match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim()
const CRON_SECRET = (ENV.match(/^CRON_SECRET=(.*)$/m) || [])[1]?.trim()
const WEBM = resolve(APP, 'public/media/_e2e-demo.webm')
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { for (let i = 0; ; i++) { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET' || i >= 3) throw e; await sleep(300) } } }
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

let mongo, db, mock, chrome, ws
const cleanup = async () => {
  try { rmSync(WEBM, { force: true }) } catch {}
  try { chrome?.kill() } catch {}
  try { await new Promise((r) => (mock ? mock.close(r) : r())) } catch {}
  try { await mongo?.close() } catch {}
}
process.on('exit', () => { try { rmSync(WEBM, { force: true }) } catch {} })

// ── Chrome ───────────────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9357', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9357/json')).json(); if (targets.length) break } catch {} await sleep(500) }
ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const problems = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') problems.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0])
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 90000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e, gesture = false) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: gesture })).result?.result?.value
const waitFor = async (e, ms = 60000, gesture = false) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e, gesture)) return true; await sleep(300) } return false }
const shot = async (n) => { if (!OUT) return; const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')) }
const goto = async (u) => { await send('Page.navigate', { url: B + u }); await sleep(1000) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true })

const sectionBtn = `document.querySelector('#video button[aria-haspopup=dialog]')`
const openVideo = async () => { await waitFor(`!!${sectionBtn} && Object.keys(${sectionBtn}).some(k => k.startsWith('__react'))`, 120000); await js(`${sectionBtn}.click(); true`, true) }
const closeVideo = async () => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(400) }

await goto('/fr')
if (MODE === 'baseline') {
  await openVideo()
  check('NO source configured: the modal opens and says the demo video is not available yet', await waitFor(`/bientôt disponible/.test(document.querySelector('dialog[open]')?.textContent || '')`, 15000))
  check('NO source configured: the section badge says "Vidéo bientôt disponible"', await js(`/Vidéo bientôt disponible/.test(document.querySelector('#video').textContent)`))
  check('NO source configured: there is no <video> or <iframe> to play', await js(`!document.querySelector('dialog video') && !document.querySelector('dialog iframe')`))
  await shot('fr-baseline-no-video')
  await cleanup()
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

// ── record a real 2 s .webm in Chrome and put it in public/media for this run ──
const b64 = await js(`(async () => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm' }); const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r)); rec.start(100);
  const t0 = performance.now(); await new Promise((res) => { (function f() { const t = performance.now() - t0; x.fillStyle = '#0A2318'; x.fillRect(0, 0, 320, 180); x.fillStyle = '#F0B429'; x.fillRect((t / 10) % 300, 80, 20, 20); if (t < 2200) requestAnimationFrame(f); else res(); })(); });
  rec.stop(); await done;
  const buf = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()); let s = ''; for (const v of buf) s += String.fromCharCode(v); return btoa(s);
})()`)
mkdirSync(resolve(APP, 'public/media'), { recursive: true })
writeFileSync(WEBM, Buffer.from(b64, 'base64'))
// (a 2 s clip of a flat colour and one moving square compresses to a few KB: check for the WebM/EBML magic, not a size)
check('a real .webm was recorded for the test', existsSync(WEBM) && Buffer.from(b64, 'base64').subarray(0, 4).toString('hex') === '1a45dfa3', `${Buffer.from(b64, 'base64').length} bytes`)
const head = await fetch(B + '/media/_e2e-demo.webm', { headers: { range: 'bytes=0-99' } })
check('the file is served with range support and a video MIME type', head.status === 206 && head.headers.get('accept-ranges') === 'bytes' && /video\/webm/.test(head.headers.get('content-type') || ''), `${head.status} ${head.headers.get('content-type')} ${head.headers.get('accept-ranges')}`)

await goto('/fr')
await openVideo()
check('video configured: the modal opens a <video> with a webm <source>', await waitFor(`!!document.querySelector('dialog[open] video[data-testid=video-player] source[type="video/webm"]')`, 15000))
check('video plays: readyState >= 2, not paused, currentTime advances', await waitFor(`(() => { const v = document.querySelector('dialog[open] video'); return v && v.readyState >= 2 && !v.paused && v.currentTime > 0.1 })()`, 15000, true), JSON.stringify(await js(`(() => { const v = document.querySelector('dialog[open] video'); return v && { rs: v.readyState, paused: v.paused, t: v.currentTime, err: v.error?.code ?? null } })()`)))
check('no error panel while it plays', await js(`!document.querySelector('[data-testid=video-error]')`))
await shot('fr-video-playing')
await closeVideo()
check('Escape closes the modal and removes the player (playback stops)', await js(`!document.querySelector('dialog[open]') && !document.querySelector('dialog video')`))

// corrupt the file: the browser cannot decode it → readable error, not a black box
writeFileSync(WEBM, Buffer.from('this is not a video'.repeat(200)))
await openVideo()
check('undecodable file: the visitor gets an error message and a direct link', await waitFor(`/ne peut pas être lue/.test(document.querySelector('dialog[open] [data-testid=video-error]')?.textContent || '') && document.querySelector('dialog[open] [data-testid=video-error] a')?.getAttribute('href') === '/media/_e2e-demo.webm'`, 20000))
await shot('fr-video-error')
await closeVideo()
rmSync(WEBM, { force: true })
await openVideo()
check('missing file (404): the same readable error', await waitFor(`!!document.querySelector('dialog[open] [data-testid=video-error]')`, 20000))
await closeVideo()
await goto('/ar')
await openVideo()
check('ar: the error message is in Arabic', await waitFor(`/تعذّر تشغيل الفيديو/.test(document.querySelector('dialog[open] [data-testid=video-error]')?.textContent || '')`, 20000))
await closeVideo()
check('no uncaught exceptions on the landing page', problems.length === 0, problems.slice(0, 2).join(' | '))

// ═══ DISPATCH ═══════════════════════════════════════════════════════════════
mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
db = mongo.db(process.env.MONGODB_DB || 'magharebit_dispatch')
const calls = []   // what the mock Green API received
let mockMode = { delayMs: 0, hang: false }
mock = createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    calls.push({ at: Date.now(), url: req.url, body: (() => { try { return JSON.parse(body) } catch { return null } })() })
    if (mockMode.hang) return // never answers
    setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ idMessage: 'MOCK' + calls.length })) }, mockMode.delayMs)
  })
}).listen(4545, '127.0.0.1')
await new Promise((r) => mock.once('listening', r))

const api = (path, { method = 'GET', body, cookie, headers = {} } = {}) => fetch(B + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }
const mkMerchant = async (n) => {
  const local = `067${n}` + String(Date.now()).slice(-6); const phone = '212' + local.slice(1)
  await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
  const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
  const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
  const su = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: `Boutique ${n}`, sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
  const cookie = cookieOf(su)
  const s = await api('/api/portal/settings', { method: 'PATCH', body: { whatsappEnabled: true, dailyReportEnabled: true, lowStockAlert: true, customerWhatsappReceiptEnabled: true, storePhone: '06' + String(10000000 + n * 1111111).slice(0, 8) }, cookie })
  await api('/api/portal/products/seed', { method: 'POST', body: { sector: 'epicerie' }, cookie })
  const prods = (await (await api('/api/portal/products?limit=100', { cookie })).json()).products
  return { local, cookie, prods, settingsStatus: s.status }
}
await db.dropDatabase()
await db.collection('customers').createIndex({ merchantId: 1, phone: 1 }, { unique: true })
await db.collection('transactions').createIndex({ receiptNo: 1, merchantId: 1 }, { unique: true })
const m1 = await mkMerchant(1)
check('merchant 1 created with WhatsApp alerts enabled (mock Green API)', m1.settingsStatus === 200 && m1.prods.length > 1, `settings ${m1.settingsStatus}`)

// low-stock product + a customer with a phone
const lp = m1.prods[0]
await api(`/api/portal/products/${lp.id}`, { method: 'PATCH', body: { stock: 3, minStock: 5 }, cookie: m1.cookie })
const cust = (await (await api('/api/portal/customers', { method: 'POST', body: { name: 'Salma', phone: '0661234567' }, cookie: m1.cookie })).json()).customer

// 1. a sale does not wait for the (slow) WhatsApp calls, and the calls still happen
mockMode = { delayMs: 3000, hang: false }; calls.length = 0
const t0 = Date.now()
const sale = await api('/api/portal/transactions', { method: 'POST', body: { items: [{ productId: lp.id, qty: 1 }], paymentMethod: 'cash', taxRate: 0, customerId: cust.id }, cookie: m1.cookie })
const saleMs = Date.now() - t0
check('sale returns 201 without waiting for WhatsApp (the mock answers after 3 s)', sale.status === 201 && saleMs < 2500, `${saleMs} ms`)
await sleep(5000)
check('after the response, both messages still reach the Green API (low-stock alert + customer receipt)', calls.length === 2, `${calls.length} calls`)
check('the loyalty update also ran after the response', await (async () => { for (let i = 0; i < 20; i++) { const c = (await (await api(`/api/portal/customers/${cust.id}`, { cookie: m1.cookie })).json()).customer; if (c?.visitCount === 1) return true; await sleep(300) } return false })())

// 2. a hanging Green API is cut off by the send timeout (1.5 s); the cron stops at its budget (2.5 s)
const m2 = await mkMerchant(2), m3 = await mkMerchant(3)
check('merchants 2 and 3 created', m2.settingsStatus === 200 && m3.settingsStatus === 200)
for (const m of [m1, m2, m3]) {
  const r = await api('/api/portal/transactions', { method: 'POST', body: { items: [{ productId: m.prods[2].id, qty: 1 }], paymentMethod: 'cash', taxRate: 0 }, cookie: m.cookie })
  if (r.status !== 201) console.log('sale for the report failed', r.status)
}
await db.collection('transactions').updateMany({}, { $set: { createdAt: new Date(Date.now() - 24 * 3600 * 1000) } })
mockMode = { delayMs: 0, hang: true }; calls.length = 0
const date = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10)
const cronHeaders = CRON_SECRET ? { authorization: `Bearer ${CRON_SECRET}` } : {}
const c0 = Date.now()
const cron = await api(`/api/cron/daily-report?date=${date}`, { method: 'POST', headers: cronHeaders })
const cronMs = Date.now() - c0
const cj = await cron.json().catch(() => ({}))
check('daily report with a Green API that never answers: the run ends (not stuck behind the first hang)', cron.status === 200 && cronMs < 12000, `${cron.status} in ${cronMs} ms ${JSON.stringify(cj)}`)
check('the stalled send was aborted by the timeout (counted as failed, not left pending)', cj.failed >= 1 && cj.sent === 0, JSON.stringify(cj))
check('the time budget stops the run and reports what it did not reach', cj.incomplete === true && cj.remaining >= 1 && cj.sent + cj.failed + cj.skipped + cj.remaining === cj.total, JSON.stringify(cj))

// 3. normal conditions: everything is delivered
mockMode = { delayMs: 0, hang: false }; calls.length = 0
const ok = await (await api(`/api/cron/daily-report?date=${date}`, { method: 'POST', headers: cronHeaders })).json()
check('with a healthy Green API the daily reports of all 3 merchants are sent', ok.sent === 3 && ok.failed === 0 && ok.incomplete === false && calls.length === 3, JSON.stringify(ok))

await cleanup()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
