// Lists every request of one page load (url, type, size, start/end ms), slowest last. Env: CHROME, PROFILE, URL
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9339', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9339/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map(); const reqs = new Map(); let t0 = 0, loadAt = 0
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  const p = d.params
  if (d.method === 'Network.requestWillBeSent') { if (!t0) t0 = p.timestamp; reqs.set(p.requestId, { url: p.request.url.slice(0, 110), start: p.timestamp, type: p.type }) }
  if (d.method === 'Network.responseReceived' && reqs.has(p.requestId)) reqs.get(p.requestId).status = p.response.status
  if (d.method === 'Network.loadingFinished' && reqs.has(p.requestId)) Object.assign(reqs.get(p.requestId), { end: p.timestamp, kb: p.encodedDataLength / 1024 })
  if (d.method === 'Network.loadingFailed' && reqs.has(p.requestId)) Object.assign(reqs.get(p.requestId), { end: p.timestamp, failed: p.errorText })
  if (d.method === 'Page.loadEventFired') loadAt = p.timestamp }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
await send('Page.navigate', { url: process.env.URL })
for (let i = 0; i < 900 && !loadAt; i++) await sleep(100)
await sleep(2000)
const ms = (t) => (t ? Math.round((t - t0) * 1000) : -1)
console.log('load event at', ms(loadAt), 'ms')
for (const r of [...reqs.values()].sort((a, b) => (a.end ?? 1e12) - (b.end ?? 1e12)))
  console.log(String(ms(r.start)).padStart(6), String(ms(r.end)).padStart(6), (r.kb ?? 0).toFixed(1).padStart(7) + 'KB', String(r.status ?? '').padEnd(4), (r.type || '').padEnd(10), r.failed ? `FAILED ${r.failed} ` : '', r.url)
ws.close(); chrome.kill()
