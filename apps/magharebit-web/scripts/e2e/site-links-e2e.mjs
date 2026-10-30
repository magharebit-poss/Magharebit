// Every link on the public pages resolves. Headless Chrome opens the home page (ar/fr/en) and /fr/features at
// desktop width with both navbar menus opened by their chevron buttons, and at 375 px with the mobile menu and its
// sections expanded, then collects every <a href>. Each same-origin target must answer 200 (after redirects),
// each #anchor must exist on its target page, and no link may be "#" or empty. External links are listed, not fetched.
// Also checks the navbar labels: "Produits"/"Secteurs" are real links and their chevron opens the menu.
// Run against `next start` (or a warm `next dev`): BASE=http://localhost:3021 CHROME=<chrome.exe> PROFILE=<tmp> node scripts/e2e/site-links-e2e.mjs
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'

const B = process.env.BASE || 'http://localhost:3021'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9349', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9349/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
// Every CDP call has a timeout: a hung call must fail the run, not stall it.
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); res({ result: {} }) }, 60000); pending.set(i, (d) => { clearTimeout(t); res(d) }); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
const waitFor = async (e, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(e)) return true; await sleep(300) } return false }
const hydrated = `(() => { const b = document.querySelector('nav a'); return !!b && Object.keys(b).some(k => k.startsWith('__react')) })()`
const collect = `[...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim().slice(0, 40) }))`

await send('Page.enable'); await send('Runtime.enable')
const found = new Map() // href -> first page it was seen on
const add = (page, links) => { for (const l of links || []) if (!found.has(l.href)) found.set(l.href, { page, text: l.text }) }

for (const path of ['/ar', '/fr', '/en', '/fr/features']) {
  // desktop: open both menus with the chevron buttons
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: B + path })
  check(`${path} desktop hydrates`, await waitFor(hydrated))
  await sleep(800)
  add(path, await js(collect))
  const chevrons = await js(`[...document.querySelectorAll('nav button[aria-haspopup="true"]')].length`)
  for (let i = 0; i < chevrons; i++) {
    await js(`document.querySelectorAll('nav button[aria-haspopup="true"]')[${i}].click()`)
    await sleep(300)
    add(path, await js(collect))
    if (path === '/fr') {
      const st = await js(`(() => { const b = document.querySelectorAll('nav button[aria-haspopup="true"]')[${i}]; const label = b.previousElementSibling; return { expanded: b.getAttribute('aria-expanded'), name: b.getAttribute('aria-label'), labelHref: label?.getAttribute('href') } })()`)
      check(`/fr menu ${i + 1}: label is a link, chevron opens the menu`, st.expanded === 'true' && /^\/fr\/(features|sectors)$/.test(st.labelHref || '') && /^Menu /.test(st.name || ''), JSON.stringify(st))
      await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`); await sleep(200)
      check(`/fr menu ${i + 1}: Escape closes it`, (await js(`document.querySelectorAll('nav button[aria-haspopup="true"]')[${i}].getAttribute('aria-expanded')`)) === 'false')
    }
  }
  if (path === '/fr') check('/fr has two menu chevrons (Produits, Secteurs)', chevrons === 2, String(chevrons))

  // mobile: open the menu and every collapsible section in it
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: B + path })
  await waitFor(hydrated)
  await sleep(800)
  await js(`(() => { const b = [...document.querySelectorAll('nav button')].find(b => b.offsetParent && b.getAttribute('aria-expanded') !== null && !b.hasAttribute('aria-haspopup')); b && b.click(); return !!b })()`)
  await sleep(500)
  await js(`[...document.querySelectorAll('button[aria-expanded="false"]')].filter(b => b.offsetParent).forEach(b => b.click())`)
  await sleep(500)
  add(path + ' (mobile)', await js(collect))
}
chrome.kill()

// ── resolve every link ───────────────────────────────────────────────────────
const bad = [...found.entries()].filter(([h]) => !h || h === '#' || h.trim() === '')
check('no link is "#" or empty', bad.length === 0, bad.map(([h, v]) => `"${h}" (${v.text}) on ${v.page}`).join(', '))

const htmlCache = new Map()
const getPage = async (url) => {
  if (!htmlCache.has(url)) {
    let r
    for (let i = 0; i < 3; i++) { try { r = await fetch(url, { redirect: 'follow' }); break } catch { await sleep(2000) } }
    htmlCache.set(url, r ? { status: r.status, html: await r.text() } : { status: 0, html: '' })
  }
  return htmlCache.get(url)
}
const external = []
for (const [href, { page }] of found) {
  if (!href || href === '#') continue
  if (/^(mailto|tel|sms):/i.test(href)) continue
  const base = new URL(page.replace(' (mobile)', ''), B)
  const u = new URL(href, base)
  if (u.origin !== new URL(B).origin) { external.push(u.origin); continue }
  const target = u.origin + u.pathname
  const { status, html } = await getPage(target)
  if (status !== 200) { check(`${href} → 200`, false, `${status} (seen on ${page})`); continue }
  if (u.hash) {
    const anchor = decodeURIComponent(u.hash.slice(1))
    check(`${href} → 200 and #${anchor} exists`, html.includes(`id="${anchor}"`), `seen on ${page}`)
  } else pass++
}
console.log(`\n${found.size} distinct links checked; external origins (not fetched): ${[...new Set(external)].join(', ') || 'none'}`)
console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
