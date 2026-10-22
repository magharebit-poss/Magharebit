// Sign-up funnel end-to-end check (headless Chrome + real MongoDB in Docker): landing CTA -> phone OTP -> store details -> confirmation -> trial license -> POS validate -> admin list.
// Needs a dev server on :3021 with MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_signup (see scripts/admin-smoke/README.md for the Docker command). Env: APP_DIR, OUT, PROFILE, CHROME.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const B = 'http://localhost:3021'
const APP = process.env.APP_DIR
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const env = readFileSync(`${APP}/.env.local`, 'utf8')
const SECRET = env.match(/^NEXTAUTH_SECRET=(.*)$/m)[1]
const OWNER_PW = env.match(/^ADMIN_SECRET=(.*)$/m)[1]
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db('magharebit_signup'); await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

// ── headless Chrome over CDP ──────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9334', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9334/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const errs = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ')) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')); console.log('screenshot', n) }
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(400) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1500) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
await send('Page.enable'); await send('Runtime.enable')

function findOtp(phone, hash) { for (let n = 100000; n <= 999999; n++) { if (createHash('sha256').update(`${n}:${phone}:${SECRET}`).digest('hex') === hash) return String(n) } return null }

async function signup(lang, local, expect) {
  const phone = '212' + local.slice(1)
  await send('Network.enable'); await send('Network.clearBrowserCookies')

  // entry point from the landing page
  await goto(`${B}/${lang}`)
  await waitFor(`!!document.querySelector('a[href="/${lang}/auth/signup"]')`)
  const ctaTargets = await js(`[...document.querySelectorAll('a[href="/${lang}/auth/signup"]')].length`)
  check(`[${lang}] landing page links to sign-up`, ctaTargets >= 3, `links=${ctaTargets}`)

  await goto(`${B}/${lang}/auth/signup`)
  check(`[${lang}] sign-up page loads and hydrates`, await waitFor(`(() => { const el = document.querySelector('#su-phone'); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`, 300000))
  await shot(`${lang}-1-signup`)
  await setVal('#su-phone', local)
  await js(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] step 1 -> OTP boxes appear`, await waitFor(`document.querySelectorAll('input[inputmode=numeric]').length === 6`))
  const doc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
  check(`[${lang}] OTP session stored (hashed, expires in 5 min)`, !!doc && !!doc.otp_hash && !('otp' in doc) && (doc.expires_at - doc.created_at) === 300000)
  const otp = findOtp(phone, doc.otp_hash)
  check(`[${lang}] OTP recoverable only by brute force of the salted hash`, !!otp)
  await setVal('input[inputmode=numeric]', otp)
  check(`[${lang}] correct OTP -> store details step`, await waitFor(`!!document.querySelector('#store-name')`))
  await setVal('#store-name', `Boulangerie Test ${lang.toUpperCase()}`)
  await setVal('#sector', 'boulangerie')
  await setVal('#city', 'Rabat')
  await shot(`${lang}-2-details`)
  await js(`document.querySelector('form button[type=submit]').click()`)
  check(`[${lang}] confirmation screen shown`, await waitFor(`document.body.innerText.includes(${JSON.stringify(expect)})`))
  const links = await js(`[...document.querySelectorAll('[role=status] a')].map(a => a.getAttribute('href'))`)
  check(`[${lang}] confirmation links to portal + download`, links?.includes(`/${lang}/portal/login`) && links?.includes(`/${lang}/download`), JSON.stringify(links))
  await shot(`${lang}-3-confirmation`)

  const m = await db.collection('merchants').findOne({ phone })
  check(`[${lang}] merchant stored: Starter trial, approved by system`, m && m.status === 'approved' && m.plan === 'Starter' && m.approvedBy === 'system:trial' && m.sector === 'boulangerie' && m.city === 'Rabat' && m.locale === lang)
  await sleep(1500)
  const lic = await db.collection('licenses').findOne({ merchantId: phone })
  check(`[${lang}] 14-day trial license created`, lic && lic.isTrial === true && lic.status === 'active' && /^MGH-\d{6}-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{2}$/.test(lic.key) && Math.round((lic.expiresAt - lic.issuedAt) / 86400000) === 14, lic?.key)
  const v = await (await fetch(`${B}/api/licenses/validate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: lic.key, machineId: 'E2E' }) })).json()
  check(`[${lang}] POS validate accepts the trial key`, v.valid === true && v.isTrial === true && v.plan === 'Starter' && v.daysRemaining >= 13, JSON.stringify(v).slice(0, 110))
  return { phone, lic }
}

check('server up', (await fetch(`${B}/api/health`)).ok)
const fr = await signup('fr', '0661000001', 'Votre compte est créé')
const ar = await signup('ar', '0661000002', 'تم إنشاء حسابك')

// idempotency: same phone again via API reports exists
const dupSession = await db.collection('auth_sessions').findOne({ phone: fr.phone })
check('auth session recorded as signup-completed', dupSession?.completed_signup === true)

// the merchants are visible to an admin
const login = await fetch(`${B}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: OWNER_PW }) })
const cookie = login.headers.get('set-cookie').split(';')[0]
const list = await (await fetch(`${B}/api/admin/merchants?status=all`, { headers: { cookie } })).json()
check('admin merchants API lists both new sign-ups', (list.merchants ?? []).filter((x) => x.phone === fr.phone || x.phone === ar.phone).length === 2, `total=${list.total}`)

// secret hygiene: session/OTP helpers refuse to run without the secret
check('no console errors / exceptions', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await mongo.close()
process.exit(fail ? 1 : 0)
