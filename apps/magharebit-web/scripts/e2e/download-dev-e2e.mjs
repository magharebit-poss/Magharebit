// The license-gated download flow under `next dev` with NO installer URLs configured: sign up through the real API,
// get the trial key, download Windows and Android, receive the placeholder file. API only (no browser).
// Start: MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_v2 NEXT_DIST_DIR=.next-dev npx next dev -p 3027
//        (DOWNLOAD_*_URL must be unset). Run: APP_DIR=. BASE=http://localhost:3027 MONGODB_DB=magharebit_v2 node scripts/e2e/download-dev-e2e.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3027'
const APP = process.env.APP_DIR || process.cwd()
const SECRET = (readFileSync(`${APP}/.env.local`, 'utf8').match(/^NEXTAUTH_SECRET=(.*)$/m) || [])[1]?.trim()
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_v2')
await db.collection('rate_limits').deleteMany({})

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
// `next dev` can reset the very first request to a route while it compiles it: retry a few times
const post = async (path, body, cookie) => { for (let i = 0; ; i++) { try { return await fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }) } catch (e) { if (i >= 4) throw e; await new Promise((r) => setTimeout(r, 3000)) } } }
const findOtp = (phone, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${phone}:${SECRET}`).digest('hex') === hash) return String(n); return null }

const local = '0662' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
check('send-otp accepts the phone', (await post('/api/auth/send-otp', { phone: local, locale: 'fr' })).ok)
const doc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const otp = findOtp(phone, doc.otp_hash)
const ver = await post('/api/auth/verify-otp', { phone: local, otp, locale: 'fr' })
check('verify-otp accepts the code and sets the sign-up session', ver.ok && /mgh_session=/.test(cookieOf(ver)))
const done = await post('/api/auth/complete-signup', { phone: local, storeName: 'Dev Download Shop', sector: 'epicerie', city: 'Rabat', locale: 'fr' }, cookieOf(ver))
const body = await done.json()
const cookie = cookieOf(done)
check('complete-signup returns the real trial key and opens the portal session', done.ok && /^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$/.test(body.licenseKey || '') && /portal_session=/.test(cookie), body.licenseKey)

for (const p of ['windows', 'android']) {
  const r = await fetch(`${B}/api/download/${p}?locale=fr`, { redirect: 'manual', headers: { cookie } })
  const loc = r.headers.get('location') || ''
  check(`${p}: gated route answers 302 to the local placeholder (no 503)`, r.status === 302 && new URL(loc, B).pathname === `/api/dev-installer/${p}` && /no-store/.test(r.headers.get('cache-control') || ''), `${r.status} ${loc}`)
  const f = await fetch(new URL(loc, B))
  const text = await f.text()
  check(`${p}: placeholder downloads as an attachment, plain text, clearly labelled`, f.status === 200 && /attachment; filename="magharebit-pos-DEV-PLACEHOLDER-/.test(f.headers.get('content-disposition') || '') && /^text\/plain/.test(f.headers.get('content-type') || '') && /DEVELOPMENT PLACEHOLDER/.test(text))
}
const anon = await fetch(`${B}/api/download/windows?locale=fr`, { redirect: 'manual' })
check('without a session the gate still sends people to the portal login', anon.status === 302 && new URL(anon.headers.get('location'), B).pathname === '/fr/portal/login')
check('unknown platform on the dev route -> 404', (await fetch(`${B}/api/dev-installer/linux`)).status === 404)
const page = await (await fetch(`${B}/fr/download`)).text()
check('/download shows both download buttons in development (placeholder configured)', page.includes('/api/download/windows') && page.includes('/api/download/android'))

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exitCode = fail ? 1 : 0
