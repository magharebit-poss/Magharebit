// Portal login localisation (ar/fr/en) in headless Chrome. Bug: /portal/login stayed Arabic whatever the language.
// Checks: the URL locale drives every string (title, labels, button, features, links), <html dir>/the page direction,
// the identifier field direction and alignment (phone/email are always LTR, text on the start side of the page),
// the language switcher (links, aria-current, switching changes the URL, direction and text, keeps ?next=), a bare
// /portal/login redirects to a locale, translated API errors (empty form, unknown license key), a real sign-in from
// the French page lands on /fr/portal/dashboard, 375 px layout, no presentational inline styles, no console errors.
// Drops its database.
// Run: APP_DIR=. BASE=… MONGODB_DB=… CHROME=… PROFILE=… [OUT=…] [ENV_FILE=.env.development.local] node scripts/e2e/portal-login-e2e.mjs
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
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_login')
await db.dropDatabase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const rawFetch = globalThis.fetch
globalThis.fetch = async (...a) => { try { return await rawFetch(...a) } catch (e) { if (e?.cause?.code !== 'ECONNRESET') throw e; await sleep(200); return rawFetch(...a) } }
const api = (path, { method = 'GET', body, cookie, headers = {}, redirect } = {}) => fetch(B + path, { method, redirect, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
const cookieOf = (r) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
const findOtp = (id, hash) => { for (let n = 100000; n <= 999999; n++) if (createHash('sha256').update(`${n}:${id}:${SECRET}`).digest('hex') === hash) return String(n); return null }

// a real merchant to sign in with
const local = '0669' + String(Date.now()).slice(-6)
const phone = '212' + local.slice(1)
await api('/api/auth/send-otp', { method: 'POST', body: { phone: local, locale: 'fr' } })
const otpDoc = await db.collection('otp_sessions').findOne({ phone }, { sort: { created_at: -1 } })
const ver = await api('/api/auth/verify-otp', { method: 'POST', body: { phone: local, otp: findOtp(phone, otpDoc.otp_hash), locale: 'fr' } })
const signup = await api('/api/auth/complete-signup', { method: 'POST', body: { phone: local, storeName: 'Boutique Test', sector: 'epicerie', city: 'Fès', locale: 'fr' }, cookie: cookieOf(ver) })
const { licenseKey } = await signup.json()
check('a merchant exists to sign in with', !!licenseKey)

// a bare URL goes to a locale (next-intl), honouring the browser language
const bare = await api('/portal/login', { redirect: 'manual', headers: { 'accept-language': 'fr-FR,fr;q=0.9' } })
check('/portal/login (no locale) redirects to a locale route', bare.status >= 300 && bare.status < 400 && /^\/(ar|fr|en)\/portal\/login/.test(new URL(bare.headers.get('location'), B).pathname), `${bare.status} ${bare.headers.get('location')}`)

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9356', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await rawFetch('http://127.0.0.1:9356/json')).json(); if (targets.length) break } catch {} await sleep(500) }
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
const click = (sel) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el?.click(); return !!el })()`)
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const hydrated = `(() => { const i = document.querySelector('[data-testid=login-identifier]'); return !!i && Object.keys(i).some(k => k.startsWith('__react')) })()`
const page = (lang) => `document.querySelector('[data-testid=login-page]')?.dataset.lang === ${JSON.stringify(lang)}`
const noPresentationalStyle = `[...document.querySelectorAll('[data-testid=login-page] [style]')].filter(e => !e.hasAttribute('data-dynamic') && e.tagName !== 'IMG' /* next/image writes its own style on the logo */).map(e => e.tagName + '.' + String(e.className).slice(0, 40))`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await view(1440)

const EXPECT = {
  ar: { title: 'مرحباً بعودتك', identifier: 'رقم الهاتف أو البريد الإلكتروني', license: 'مفتاح الترخيص', submit: 'تسجيل الدخول', feature: 'يعمل بدون اتصال بالإنترنت', dir: 'rtl' },
  fr: { title: 'Bon retour', identifier: 'Téléphone ou e-mail', license: 'Clé de licence', submit: 'Se connecter', feature: 'Fonctionne sans connexion Internet', dir: 'ltr' },
  en: { title: 'Welcome back', identifier: 'Phone or email', license: 'License key', submit: 'Sign in', feature: 'Works without an Internet connection', dir: 'ltr' },
}
for (const lang of ['ar', 'fr', 'en']) {
  const e = EXPECT[lang]
  await goto(`/${lang}/portal/login`)
  await waitFor(`${hydrated}`)
  check(`${lang}: title, labels, button and feature list are in ${lang}`, await js(`(() => { const t = (s) => document.querySelector(s)?.textContent?.trim(); const p = document.querySelector('[data-testid=login-page]'); return t('[data-testid=login-title]') === ${JSON.stringify(e.title)} && t('label[for=login-identifier]') === ${JSON.stringify(e.identifier)} && t('label[for=login-license]') === ${JSON.stringify(e.license)} && t('[data-testid=login-submit]') === ${JSON.stringify(e.submit)} && p.textContent.includes(${JSON.stringify(e.feature)}) })()`), await text('[data-testid=login-title]'))
  const arabicLeak = await js(`/[\\u0600-\\u06FF]/.test(document.querySelector('[data-testid=login-page]').textContent)`)
  check(`${lang}: ${lang === 'ar' ? 'Arabic script present' : 'no Arabic script anywhere on the page'}`, lang === 'ar' ? arabicLeak : !arabicLeak)
  check(`${lang}: page direction is ${e.dir} (html, wrapper, computed)`, await js(`document.documentElement.getAttribute('dir') === ${JSON.stringify(e.dir)} && document.querySelector('[data-testid=login-page]').getAttribute('dir') === ${JSON.stringify(e.dir)} && getComputedStyle(document.querySelector('[data-testid=login-page]')).direction === ${JSON.stringify(e.dir)} && document.documentElement.lang === ${JSON.stringify(lang)}`))
  check(`${lang}: phone/email field is LTR, text on the page's start side`, await js(`(() => { const i = document.querySelector('[data-testid=login-identifier]'); const cs = getComputedStyle(i); return cs.direction === 'ltr' && cs.textAlign === ${JSON.stringify(lang === 'ar' ? 'right' : 'left')} })()`))
  check(`${lang}: brand column on the ${lang === 'ar' ? 'right' : 'left'}, form on the other side (mirrored)`, await js(`(() => { const b = document.querySelector('[data-testid=login-zellige]').parentElement.getBoundingClientRect(); const f = document.querySelector('[data-testid=login-submit]').getBoundingClientRect(); return ${lang === 'ar'} ? b.left > f.left : b.left < f.left })()`))
  check(`${lang}: switcher marks the current language, hrefs per locale`, await js(`(() => { const n = document.querySelector('[data-testid=login-lang]'); const cur = n.querySelector('[aria-current=true]'); return cur?.dataset.lang === ${JSON.stringify(lang)} && ['ar','fr','en'].every(l => n.querySelector('a[data-lang=' + l + ']').getAttribute('href') === '/' + l + '/portal/login') })()`))
  check(`${lang}: no presentational inline styles`, (await js(noPresentationalStyle)).length === 0, (await js(noPresentationalStyle)).join(', '))
  await shot(`${lang}-1440-login`)
}

// switching language on the page itself
await goto('/ar/portal/login?next=' + encodeURIComponent('/api/download/windows?locale=ar'))
await waitFor(`${hydrated}`)
await click('[data-testid=login-lang] a[data-lang=fr]')
check('switcher AR → FR: URL becomes /fr/portal/login and ?next= is kept', await waitFor(`location.pathname === '/fr/portal/login' && location.search.includes('next=')`, 20000), await js(`location.pathname + location.search`))
check('switcher AR → FR: content and direction follow without a manual reload', await waitFor(`${page('fr')} && document.querySelector('[data-testid=login-title]').textContent === 'Bon retour' && document.documentElement.getAttribute('dir') === 'ltr'`, 20000))
await click('[data-testid=login-lang] a[data-lang=en]')
check('switcher FR → EN', await waitFor(`location.pathname === '/en/portal/login' && ${page('en')} && document.querySelector('[data-testid=login-title]').textContent === 'Welcome back'`, 20000))
await click('[data-testid=login-lang] a[data-lang=ar]')
check('switcher EN → AR: RTL again', await waitFor(`location.pathname === '/ar/portal/login' && ${page('ar')} && document.documentElement.getAttribute('dir') === 'rtl' && document.querySelector('[data-testid=login-title]').textContent === 'مرحباً بعودتك'`, 20000))
check('links keep the current locale (signup, demo, home)', await js(`(() => { const h = [...document.querySelectorAll('[data-testid=login-page] a')].map(a => a.getAttribute('href')); return h.includes('/ar/auth/signup') && h.includes('/ar/demo') && h.includes('/ar') })()`))

// translated errors
await goto('/fr/portal/login'); await waitFor(`${hydrated}`)
await click('[data-testid=login-submit]')
check('fr: empty form → translated API error', await waitFor(`/Saisissez votre numéro de téléphone/.test(document.querySelector('[data-testid=login-error]')?.textContent || '')`, 20000), await text('[data-testid=login-error]'))
await setVal('[data-testid=login-identifier]', local); await setVal('[data-testid=login-license]', 'MGH-202501-AAAAAAAA-BBBB-CC')
await click('[data-testid=login-submit]')
check('fr: unknown license key → translated error, no Arabic', await waitFor(`/clé de licence n’est pas valide/.test(document.querySelector('[data-testid=login-error]')?.textContent || '')`, 20000) && !(await js(`/[\\u0600-\\u06FF]/.test(document.querySelector('[data-testid=login-error]').textContent)`)), await text('[data-testid=login-error]'))
await goto('/en/portal/login'); await waitFor(`${hydrated}`)
await setVal('[data-testid=login-identifier]', local); await setVal('[data-testid=login-license]', 'MGH-202501-AAAAAAAA-BBBB-CC'); await click('[data-testid=login-submit]')
check('en: same error in English', await waitFor(`/license key is not valid/.test(document.querySelector('[data-testid=login-error]')?.textContent || '')`, 20000), await text('[data-testid=login-error]'))
await goto('/ar/portal/login'); await waitFor(`${hydrated}`)
await setVal('[data-testid=login-identifier]', local); await setVal('[data-testid=login-license]', 'MGH-202501-AAAAAAAA-BBBB-CC'); await click('[data-testid=login-submit]')
check('ar: same error in Arabic', await waitFor(`/مفتاح الترخيص غير صحيح/.test(document.querySelector('[data-testid=login-error]')?.textContent || '')`, 20000), await text('[data-testid=login-error]'))

// real sign-in from the French page
await goto('/fr/portal/login'); await waitFor(`${hydrated}`)
await setVal('[data-testid=login-identifier]', local); await setVal('[data-testid=login-license]', licenseKey)
check('license key is auto-formatted as typed', await js(`document.querySelector('[data-testid=login-license]').value === ${JSON.stringify(licenseKey)}`))
await click('[data-testid=login-submit]')
check('fr: sign-in lands on /fr/portal/dashboard', await waitFor(`location.pathname === '/fr/portal/dashboard'`, 60000))

// 375 px
await send('Network.clearBrowserCookies')
await view(375, 812)
await goto('/fr/portal/login'); await waitFor(`${hydrated}`)
check('375 px: brand column hidden, mobile logo shown, switcher visible, no horizontal scroll', await js(`(() => { const brand = document.querySelector('[data-testid=login-zellige]').parentElement; const sw = document.querySelector('[data-testid=login-lang]').getBoundingClientRect(); return getComputedStyle(brand).display === 'none' && !!document.querySelector('[data-testid=login-page] .md\\\\:hidden img, [data-testid=login-page] .md\\\\:hidden svg') && sw.width > 0 && sw.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth })()`))
check('375 px: inputs and button are at least 48 px tall', await js(`['login-identifier', 'login-license', 'login-submit'].every(t => document.querySelector('[data-testid=' + t + ']').getBoundingClientRect().height >= 48)`))
await shot('fr-375-login')
await goto('/ar/portal/login'); await waitFor(`${hydrated}`)
check('375 px ar: switcher sits at the start-opposite corner (left in RTL), no overflow', await js(`(() => { const sw = document.querySelector('[data-testid=login-lang]').getBoundingClientRect(); return sw.left < innerWidth / 2 && document.documentElement.scrollWidth <= innerWidth })()`))
await shot('ar-375-login')

const relevant = problems.filter((p) => !/Failed to load resource|401|403|409|422/.test(p))
check('no console errors or exceptions', relevant.length === 0, relevant.slice(0, 3).join(' | '))
chrome.kill()
console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
