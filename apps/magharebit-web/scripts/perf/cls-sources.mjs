// Prints each layout shift (value, time) and the elements that moved. Env: CHROME, PROFILE, URL
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
rmSync(process.env.PROFILE, { recursive: true, force: true })
const chrome = spawn(process.env.CHROME, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.PROFILE}`, '--remote-debugging-port=9340', 'about:blank'], { stdio: 'ignore' })
let targets
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9340/json')).json(); if (targets.length) break } catch {} await sleep(500) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setCPUThrottlingRate', { rate: 4 })
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__shifts = [];
  const describe = (n) => { if (!n || !n.tagName) return String(n && n.nodeName); let s = n.tagName.toLowerCase(); if (n.id) s += '#' + n.id; if (n.className && typeof n.className === 'string') s += '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.'); return s + ' "' + (n.textContent || '').trim().slice(0, 40) + '"' };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => describe(s.node) + ' ' + JSON.stringify([s.previousRect.y, s.currentRect.y, s.previousRect.height, s.currentRect.height])) }) }).observe({ type: 'layout-shift', buffered: true });
` })
await send('Page.navigate', { url: process.env.URL })
await sleep(Number(process.env.WAIT || 30000))
const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shifts)', returnByValue: true })
const shifts = JSON.parse(r.result.result.value)
console.log('total CLS', shifts.reduce((a, s) => a + s.v, 0).toFixed(3))
for (const s of shifts) { console.log(s.v, '@', s.t, 'ms'); for (const x of s.src) console.log('    ', x) }
ws.close(); chrome.kill()
