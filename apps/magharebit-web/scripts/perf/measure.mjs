// Page-load measurement in headless Chrome over CDP (no extra packages).
// Mobile profile: 375x812, 4x CPU slowdown, ~1.6 Mbps / 150 ms RTT ("Fast 3G"-like). Cold cache each run.
//
// A/B mode: BASES=http://localhost:3023,http://localhost:3021 loads every page on each server in
// turn (A, B, A, B, ...), so machine load spikes hit both sides equally. Medians are printed per server.
// Env: CHROME, PROFILE, BASES (or BASE; default http://localhost:3021),
//      PAGES (default /fr,/ar,/fr/pricing,/ar/features), RUNS (default 3)
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'

const BASES = (process.env.BASES || process.env.BASE || 'http://localhost:3021').split(',')
const PAGES = (process.env.PAGES || '/fr,/ar,/fr/pricing,/ar/features').split(',')
const RUNS = Number(process.env.RUNS || 3)
const KEYS = ['ttfb', 'fcp', 'lcp', 'load', 'cls', 'kb', 'requests', 'fonts', 'external']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9338', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9338/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const listeners = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } for (const l of listeners) l(d) }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value

await send('Page.enable'); await send('Network.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setCPUThrottlingRate', { rate: 4 })
await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
await send('Network.setCacheDisabled', { cacheDisabled: true })

// Record LCP/CLS in the page from the very first byte.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__perf = { lcp: 0, cls: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value }).observe({ type: 'layout-shift', buffered: true });
` })

async function loadOnce(base, path) {
  await send('Network.clearBrowserCache'); await send('Network.clearBrowserCookies')
  let bytes = 0, requests = 0, fonts = 0, external = 0, loaded = false
  const onEv = (d) => {
    if (d.method === 'Network.requestWillBeSent') { requests++; const u = d.params.request.url; if (!u.startsWith(base) && !u.startsWith('data:')) external++ }
    if (d.method === 'Network.loadingFinished') bytes += d.params.encodedDataLength
    if (d.method === 'Network.responseReceived' && d.params.type === 'Font') fonts++
    if (d.method === 'Page.loadEventFired') loaded = true
  }
  listeners.push(onEv)
  await send('Page.navigate', { url: base + path })
  for (let i = 0; i < 600 && !loaded; i++) await sleep(100)
  await sleep(3000) // let LCP settle and late requests finish
  const m = await js(`(() => { const n = performance.getEntriesByType('navigation')[0]; const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { ttfb: Math.round(n.responseStart), fcp: Math.round(fcp ? fcp.startTime : -1), lcp: Math.round(window.__perf.lcp), load: Math.round(n.loadEventEnd), cls: +window.__perf.cls.toFixed(3) } })()`)
  listeners.splice(listeners.indexOf(onEv), 1)
  return { ...m, kb: Math.round(bytes / 1024), requests, fonts, external }
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
for (const p of PAGES) {
  const runs = Object.fromEntries(BASES.map((b) => [b, []]))
  for (let r = 0; r < RUNS; r++) for (const b of BASES) runs[b].push(await loadOnce(b, p))
  for (const b of BASES) {
    const med = Object.fromEntries(KEYS.map((k) => [k, median(runs[b].map((x) => x[k]))]))
    console.log(p.padEnd(14), b.replace(/^https?:\/\//, '').padEnd(16), JSON.stringify(med))
  }
}
ws.close(); chrome.kill()
