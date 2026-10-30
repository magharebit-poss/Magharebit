// Phase 2 checks on a PRODUCTION build (next build + next start), real MongoDB:
//  A. served HTML: lang/dir per locale, hreflang cluster, canonical, og:locale, JSON-LD graph, no Google Fonts, sitemap alternates
//  B. lead capture modal in headless Chrome (fr + ar, desktop + 375 px): open, validate, submit, DB row, close, exit-intent
//  C. auth shell and signup stepper rendering
// Env: APP_DIR, OUT, PROFILE, CHROME, BASE (default http://localhost:3021), MONGODB_DB (default magharebit_signup)
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const B = process.env.BASE || 'http://localhost:3021'
const APP = process.env.APP_DIR || process.cwd()
const OUT = process.env.OUT; mkdirSync(OUT, { recursive: true })
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_signup')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const html = async (p) => (await fetch(B + p)).text()

// ── A. served HTML ───────────────────────────────────────────────────────────
const EXPECT = { ar: ['ar', 'rtl', 'ar_MA'], fr: ['fr', 'ltr', 'fr_MA'], en: ['en', 'ltr', 'en_US'] }
for (const [l, [lang, dir, ogl]] of Object.entries(EXPECT)) {
  const h = await html(`/${l}`)
  check(`[${l}] <html lang="${lang}" dir="${dir}"> is in the served HTML (no script needed)`, new RegExp(`<html[^>]*lang="${lang}"[^>]*dir="${dir}"|<html[^>]*dir="${dir}"[^>]*lang="${lang}"`).test(h))
  check(`[${l}] canonical points at the locale URL`, new RegExp(`rel="canonical" href="[^"]*/${l}"`).test(h))
  const alt = [...h.matchAll(/<link[^>]*rel="alternate"[^>]*hreflang="([^"]+)"/gi)].map((m) => m[1]).sort()
  check(`[${l}] hreflang cluster: ar-MA, fr-MA, en, x-default`, JSON.stringify(alt) === JSON.stringify(['ar-MA', 'en', 'fr-MA', 'x-default']), alt.join(','))
  check(`[${l}] next-intl's own hreflang Link header is off (one source of truth)`, !/hreflang/i.test((await fetch(B + `/${l}`)).headers.get('link') || ''))
  check(`[${l}] og:locale = ${ogl}, siteName set`, h.includes(`property="og:locale" content="${ogl}"`) && h.includes('property="og:site_name" content="MAGHAREBIT POS"'))
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
  const graph = ld.find((x) => x['@graph'])?.['@graph'] ?? []
  const types = graph.map((n) => n['@type']).sort().join(',')
  check(`[${l}] JSON-LD @graph: Organization + SoftwareApplication + WebSite`, types === 'Organization,SoftwareApplication,WebSite', types)
  const app = graph.find((n) => n['@type'] === 'SoftwareApplication')
  check(`[${l}] SoftwareApplication targets Morocco, linked to the organization, no fake ratings`, app?.areaServed?.name === 'Morocco' && app?.audience?.geographicArea?.name === 'Morocco' && app?.publisher?.['@id']?.endsWith('#organization') && !JSON.stringify(ld).includes('aggregateRating') && !JSON.stringify(ld).includes('"review"'))
  check(`[${l}] no request to Google Fonts in the HTML`, !/fonts\.(googleapis|gstatic)\.com/.test(h))
  check(`[${l}] geo.region=MA and manifest/theme-color present`, h.includes('name="geo.region" content="MA"') && h.includes('rel="manifest"') && h.includes('name="theme-color" content="#0A2318"'))
}
// Phase 4: production builds point at the live domain even when .env.local says localhost; no unverified proof numbers
{
  const home = await html('/fr')
  check('canonical is https://magharebit.com/fr (a local NEXT_PUBLIC_BASE_URL never reaches a production build)', home.includes('<link rel="canonical" href="https://magharebit.com/fr"'))
  check('hreflang links all use https://magharebit.com', [...home.matchAll(/hrefLang="[^"]+" href="([^"]+)"/g)].length === 4 && [...home.matchAll(/hrefLang="[^"]+" href="([^"]+)"/g)].every((m) => m[1].startsWith('https://magharebit.com/')))
  const ldUrls = [...home.matchAll(/"(?:url|@id)":"([^"]+)"/g)].map((m) => m[1])
  check('JSON-LD urls and ids all start with https://magharebit.com', ldUrls.length > 0 && ldUrls.every((u) => u.startsWith('https://magharebit.com')), ldUrls.find((u) => !u.startsWith('https://magharebit.com')) || '')
  const sitemap = await html('/sitemap.xml'); const robotsTxt = await html('/robots.txt')
  check('sitemap and robots.txt use the live domain, no localhost anywhere', sitemap.includes('<loc>https://magharebit.com/fr') && !/localhost|127\.0\.0\.1/.test(sitemap + robotsTxt + home) && robotsTxt.includes('Sitemap: https://magharebit.com/sitemap.xml'))
  const og = await html('/ar'); check('og:url / twitter and metadata do not mention localhost either', !/localhost/.test(og))
  const PAGES = ['', '/about', '/clients', '/demo', '/features', '/pricing', '/faq', '/sectors']
  const bad = []
  for (const l of ['ar', 'fr', 'en']) for (const p of PAGES) {
    const h = (await html(`/${l}${p}`)).replace(/<script[\s\S]*?<\/script>/g, (m) => (m.includes('application/ld+json') ? m : '')).replace(/<style[\s\S]*?<\/style>/g, '')
    const text = h.replace(/<[^>]+>/g, ' ')
    const m = text.match(/(\+\s?500\b|\b500\s?\+|\b500\s(commer|merchants|stores|boutiques)|99[.,]9\s?%|\b4[.,]9\s?\/\s?5|أكثر من 500|500 تاجر|500 متجر)/)
    if (m) bad.push(`/${l}${p}: "${m[0]}"`)
  }
  check('no unverified proof numbers (500+ merchants, 99.9%, 4.9/5) on 24 marketing pages in ar/fr/en', bad.length === 0, bad.slice(0, 3).join(' | '))
}
const city = await html('/fr/caisse-enregistreuse-casablanca')
const cityLd = [...city.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
const cityNodes = cityLd.flatMap((x) => x['@graph'] ?? [x])
check('city page: Service (areaServed City Casablanca) + BreadcrumbList, no fake LocalBusiness', cityNodes.some((n) => n['@type'] === 'Service' && n.areaServed?.[0]?.name === 'Casablanca') && cityNodes.some((n) => n['@type'] === 'BreadcrumbList') && !cityNodes.some((n) => n['@type'] === 'LocalBusiness'))
const sector = await html('/fr/sectors/boulangerie')
const secLd = [...sector.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
check('sector page: BreadcrumbList with 3 levels', secLd.some((n) => n['@type'] === 'BreadcrumbList' && n.itemListElement.length === 3))
const sm = await html('/sitemap.xml')
check('sitemap: hreflang alternates for every URL', (sm.match(/hreflang="x-default"/g) || []).length >= 60 && sm.includes('hreflang="fr-MA"'), `${(sm.match(/<url>/g) || []).length} urls`)
const robots = await html('/robots.txt')
check('robots.txt: admin/portal/api disallowed, sitemap listed', /Disallow: \/admin\//.test(robots) && /Disallow: \/portal\//.test(robots) && /Sitemap: /.test(robots))
const nf = await fetch(B + '/ar/this-page-does-not-exist')
check('unknown page -> 404 (locale not-found renders inside the locale layout)', nf.status === 404 && (await nf.text()).includes('<html'))

// ── headless Chrome ──────────────────────────────────────────────────────────
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9341', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9341/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const errs = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  if (d.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('ERR ' + d.params.args.map((a) => a.value ?? a.description).join(' ')) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 60000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 74 }); if (r.result?.data) writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(r.result.data, 'base64')); console.log('screenshot', n) }
const waitFor = async (e, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const goto = async (u) => { await send('Page.navigate', { url: u }); await sleep(1200) }
const setVal = (sel, v) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const hydrated = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && Object.keys(el).some(k => k.startsWith('__react')) })()`
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

await db.collection('leads').deleteMany({})
const T = {
  fr: { store: 'Boulangerie Modal FR', phoneIn: '+212 6 12 34 56 78', phoneDb: '0612345678', type: 'bakery', city: 'Rabat' },
  ar: { store: 'مخبزة المودال', phoneIn: '07.11.22.33.44', phoneDb: '0711223344', type: 'cafe', city: 'فاس' },
}
for (const lang of ['fr', 'ar']) {
  const t = T[lang]
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
  await send('Network.clearBrowserCookies')
  await goto(`${B}/${lang}`)
  await js(`localStorage.clear()`)
  check(`[${lang}] home hydrates`, await waitFor(`${hydrated('[data-lead-modal]')}`, 120000))
  check(`[${lang}] no dialog before any trigger`, !(await js(`!!document.querySelector('dialog')`)))
  await js(`document.querySelector('[data-lead-modal]').click()`)
  check(`[${lang}] click on [data-lead-modal] opens the modal dialog`, await waitFor(`!!document.querySelector('dialog[open]')`))
  await sleep(500)
  const info = await js(`(() => { const d = document.querySelector('dialog[open]'); const cs = getComputedStyle(d); const panels = d.querySelectorAll('.grid > div'); const left = panels[0], right = panels[1];
    const r = (e) => e.getBoundingClientRect();
    return { dir: cs.direction, leftBg: getComputedStyle(left).backgroundColor, rightBg: getComputedStyle(right).backgroundColor, leftX: r(left).x, rightX: r(right).x, labelledby: d.getAttribute('aria-labelledby'), h2: d.querySelector('#lead-modal-title')?.innerText, benefits: d.querySelectorAll('ul li').length,
      submitH: r(d.querySelector('button[type=submit]')).height, closeW: r(d.querySelector('button[aria-label]')).width, focus: document.activeElement?.id } })()`)
  check(`[${lang}] benefits panel Deep Forest #0A2318, form panel Pine Green #0F3D2A`, info.leftBg === 'rgb(10, 35, 24)' && info.rightBg === 'rgb(15, 61, 42)', `${info.leftBg} | ${info.rightBg}`)
  // Fields on the dark shell: dark background, white text, dark native popup, options readable (not white on white)
  const fields = await js(`(() => { const c = (e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.color, s.colorScheme].join(' / ') }; const sel = document.getElementById('lm-type'); return { store: c(document.getElementById('lm-store')), phone: c(document.getElementById('lm-phone')), select: c(sel), option: c(sel.options[1]) } })()`)
  check(`[${lang}] inputs are dark with white text (no white blocks)`, fields.store === 'rgb(10, 35, 24) / rgb(255, 255, 255) / dark' && fields.phone === fields.store, fields.store)
  check(`[${lang}] select options: white text on Deep Forest, dark popup`, fields.option === 'rgb(10, 35, 24) / rgb(255, 255, 255) / dark' && fields.select.endsWith('/ dark'), `${fields.select} | ${fields.option}`)
  check(`[${lang}] benefits panel sits on the ${lang === 'ar' ? 'right (RTL start)' : 'left'} side`, lang === 'ar' ? info.leftX > info.rightX : info.leftX < info.rightX, `${info.leftX}/${info.rightX}`)
  check(`[${lang}] dialog is labelled, first field focused, direction ${lang === 'ar' ? 'rtl' : 'ltr'}`, info.labelledby === 'lead-modal-title' && !!info.h2 && info.focus === 'lm-store' && info.dir === (lang === 'ar' ? 'rtl' : 'ltr'))
  check(`[${lang}] touch targets: submit >= 48px, close >= 44px`, info.submitH >= 48 && info.closeW >= 44, `${info.submitH}/${info.closeW}`)
  await shot(`${lang}-1-modal-desktop`)

  // validation
  await js(`document.querySelector('dialog button[type=submit]').click()`)
  await sleep(300)
  const errs3 = await js(`[...document.querySelectorAll('dialog [id$="-err"]')].length`)
  check(`[${lang}] empty submit shows 3 inline errors and focuses the first field`, errs3 === 3 && (await js(`document.activeElement?.id`)) === 'lm-store')
  await setVal('#lm-store', t.store); await setVal('#lm-phone', '0412345678'); await setVal('#lm-type', t.type)
  await js(`document.querySelector('dialog button[type=submit]').click()`); await sleep(300)
  check(`[${lang}] a non-mobile number is rejected client-side`, (await js(`[...document.querySelectorAll('dialog [id$="-err"]')].map(e => e.id).join()`)) === 'lm-phone-err')
  await shot(`${lang}-2-modal-errors`)
  check(`[${lang}] nothing was stored by the invalid attempts`, (await db.collection('leads').countDocuments({ storeName: t.store })) === 0)

  // valid submit
  await setVal('#lm-phone', t.phoneIn); await setVal('#lm-city', t.city)
  await js(`document.querySelector('dialog button[type=submit]').click()`)
  check(`[${lang}] valid submit shows the success state`, await waitFor(`!!document.querySelector('dialog [role=status]')`, 30000))
  await sleep(400)
  const lead = await db.collection('leads').findOne({ storeName: t.store })
  check(`[${lang}] lead stored with normalised phone, type, city, locale`, !!lead && lead.phone === t.phoneDb && lead.businessType === t.type && lead.city === t.city && lead.locale === lang && lead.status === 'new', JSON.stringify(lead && { p: lead.phone, t: lead.businessType, l: lead.locale }))
  await shot(`${lang}-3-modal-success`)

  // close with Esc, remembered for 7 days
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  check(`[${lang}] Esc closes the modal and unlocks scrolling`, await waitFor(`!document.querySelector('dialog') && document.documentElement.style.overflow === ''`, 5000))
  check(`[${lang}] closing records the "seen" timestamp (no repeat exit-intent for 7 days)`, !!(await js(`localStorage.getItem('mgh_lead_modal_seen')`)))

  // phone layout
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await goto(`${B}/${lang}`)
  await waitFor(`${hydrated('[data-lead-modal]')}`, 120000)
  await js(`document.querySelector('[data-lead-modal]').click()`)
  await waitFor(`!!document.querySelector('dialog[open]')`)
  await sleep(400)
  const mob = await js(`(() => { const d = document.querySelector('dialog[open]'); const r = d.getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth, chips: d.querySelectorAll('ul.md\\\\:hidden li').length, sub: d.querySelector('button[type=submit]').getBoundingClientRect().height } })()`)
  check(`[${lang}] 375px: dialog fits the viewport, no horizontal overflow, benefits shown as chips`, mob.w <= mob.vw && mob.h <= mob.vh && mob.overflowX <= 0 && mob.chips === 3, JSON.stringify(mob))
  await shot(`${lang}-4-modal-mobile`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
}

// exit intent: desktop pointer leaving through the top after 20 s, once
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
await goto(`${B}/fr`)
await js(`localStorage.clear()`)
await goto(`${B}/fr`)
await waitFor(`${hydrated('[data-lead-modal]')}`, 120000)
const fire = `document.dispatchEvent(new MouseEvent('mouseout', { clientY: -2, relatedTarget: null, bubbles: true }))`
await js(fire); await sleep(500)
check('exit-intent: too early (before 20 s) does nothing', !(await js(`!!document.querySelector('dialog')`)))
await sleep(21000)
await js(fire)
check('exit-intent: after 20 s the modal opens when the pointer leaves through the top', await waitFor(`!!document.querySelector('dialog[open]')`, 5000))
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
await sleep(600)
await js(fire); await sleep(500)
check('exit-intent: not shown again after it was dismissed', !(await js(`!!document.querySelector('dialog')`)))
await goto(`${B}/fr/auth/signup`)
await js(`localStorage.clear()`)
await goto(`${B}/fr/auth/signup`)
await sleep(22000); await js(fire); await sleep(500)
check('exit-intent: never on the sign-up funnel', !(await js(`!!document.querySelector('dialog')`)))

// ── C. auth shell + signup stepper ───────────────────────────────────────────
for (const lang of ['ar', 'fr']) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false })
  await goto(`${B}/${lang}/auth/signup`)
  check(`[${lang}] signup page hydrates`, await waitFor(hydrated('#su-phone'), 120000))
  const s = await js(`(() => ({ steps: [...document.querySelectorAll('ol[aria-label=Progress] li')].map(li => li.innerText.trim()), current: document.querySelector('ol[aria-label=Progress] li[aria-current=step]')?.innerText.trim(), panel: !!document.querySelector('section[aria-label]') && getComputedStyle(document.querySelector('section[aria-label]')).display !== 'none', ctaH: document.querySelector('form button[type=submit]').getBoundingClientRect().height, inputH: document.querySelector('#su-phone').getBoundingClientRect().height, htmlLang: document.documentElement.lang, htmlDir: document.documentElement.dir }))()`)
  check(`[${lang}] labelled 3-step progress with the current step marked`, s.steps.length === 3 && !!s.current, JSON.stringify(s.steps))
  check(`[${lang}] desktop shows the benefits panel next to the form`, s.panel)
  check(`[${lang}] controls are >= 48px tall`, s.ctaH >= 48 && s.inputH >= 48, `${s.ctaH}/${s.inputH}`)
  check(`[${lang}] <html> lang/dir correct on the auth pages too`, s.htmlLang === lang && s.htmlDir === (lang === 'ar' ? 'rtl' : 'ltr'))
  await shot(`${lang}-5-signup-desktop`)
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await goto(`${B}/${lang}/auth/signup`)
  await waitFor(hydrated('#su-phone'), 60000)
  const m = await js(`({ overflowX: document.documentElement.scrollWidth - innerWidth, panel: getComputedStyle(document.querySelector('section[aria-label]')).display })`)
  check(`[${lang}] 375px: form only (benefits panel hidden), no horizontal overflow`, m.panel === 'none' && m.overflowX <= 0, JSON.stringify(m))
  await shot(`${lang}-6-signup-mobile`)
}

check('no console errors / exceptions', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await mongo.close()
process.exitCode = fail ? 1 : 0
