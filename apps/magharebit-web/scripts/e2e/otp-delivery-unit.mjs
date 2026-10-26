// OTP delivery layer against a MOCK Infobip server (no real account needed). No dev server, no database.
// Checks request shape (path, App auth header, body), response/error mapping, config guards and provider selection.
// It cannot prove the real Infobip account accepts these requests: do the live test described in src/lib/otp-delivery/infobip.ts.
// Run: APP_DIR=. node scripts/e2e/otp-delivery-unit.mjs
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const APP = process.env.APP_DIR || process.cwd()
const ts = createRequire(`${APP}/package.json`)('typescript')
const tmp = mkdtempSync(join(tmpdir(), 'mgh-otp-'))
mkdirSync(join(tmp, 'otp-delivery'))
const tr = (src) => ts.transpileModule(readFileSync(src, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
for (const f of ['types', 'messages', 'infobip', 'legacy', 'index']) writeFileSync(join(tmp, 'otp-delivery', `${f}.js`), tr(`${APP}/src/lib/otp-delivery/${f}.ts`))
writeFileSync(join(tmp, 'whatsapp.js'), tr(`${APP}/src/lib/whatsapp.ts`))
const D = createRequire(join(tmp, 'x.js'))('./otp-delivery/index.js')

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }

// Mock Infobip: records the last request, answers according to `mode`.
let last = null, mode = 'ok'
const server = createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)).on('end', () => {
    last = { method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers['content-type'], body: b ? JSON.parse(b) : null }
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }
    if (mode === 'ok') return send(200, { messages: [{ messageId: 'MSG-123', status: { groupId: 1, groupName: 'PENDING', name: 'PENDING_ACCEPTED' } }] })
    if (mode === 'rejected') return send(200, { messages: [{ messageId: 'MSG-9', status: { groupId: 5, groupName: 'REJECTED', name: 'REJECTED_SENDER' } }] })
    if (mode === '401') return send(401, { requestError: { serviceException: { messageId: 'UNAUTHORIZED', text: 'Invalid login details' } } })
    if (mode === '400') return send(400, { requestError: { serviceException: { messageId: 'BAD_REQUEST', text: 'Bad request' } } })
    if (mode === '429') return send(429, {})
    if (mode === '500') return send(500, 'oops')
    if (mode === 'slow') return setTimeout(() => send(200, {}), 3000)
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const set = (o) => { for (const [k, v] of Object.entries(o)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
const clean = { INFOBIP_BASE_URL: undefined, INFOBIP_API_KEY: undefined, INFOBIP_SMS_SENDER: undefined, INFOBIP_WHATSAPP_SENDER: undefined, INFOBIP_WHATSAPP_TEMPLATE: undefined, INFOBIP_TIMEOUT_MS: undefined, OTP_SMS_PROVIDER: undefined, OTP_WHATSAPP_PROVIDER: undefined }
const full = { INFOBIP_BASE_URL: `http://127.0.0.1:${port}/`, INFOBIP_API_KEY: 'test-key-123', INFOBIP_SMS_SENDER: 'MAGHAREBIT', INFOBIP_WHATSAPP_SENDER: '212600000099', OTP_SMS_PROVIDER: 'infobip', OTP_WHATSAPP_PROVIDER: 'infobip' }

// ── provider selection and configuration guards ───────────────────────────────
set(clean)
check('default SMS provider is twilio, WhatsApp is green-api (nothing changes until the env is set)', D.providerFor('sms').name === 'twilio' && D.providerFor('whatsapp').name === 'green-api')
set({ OTP_SMS_PROVIDER: 'infobip', OTP_WHATSAPP_PROVIDER: 'infobip' })
check('OTP_*_PROVIDER=infobip selects infobip for both channels', D.providerFor('sms').name === 'infobip' && D.providerFor('whatsapp').name === 'infobip')
set({ OTP_SMS_PROVIDER: 'green-api', OTP_WHATSAPP_PROVIDER: 'twilio' })
check('a provider that cannot carry the channel falls back instead of failing silently', D.providerFor('sms').name === 'twilio' && D.providerFor('whatsapp').name === 'green-api')
set({ OTP_SMS_PROVIDER: 'nonsense' })
check('unknown provider name falls back to the default', D.providerFor('sms').name === 'twilio')
set({ ...clean, OTP_SMS_PROVIDER: 'infobip' })
const nc = await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '123456', locale: 'fr' })
check('infobip selected but not configured: clean failure, no network call', nc.success === false && nc.error === 'infobip_not_configured' && last === null)

// ── SMS ───────────────────────────────────────────────────────────────────────
set(full); mode = 'ok'
const sms = await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '482913', locale: 'fr' })
check('SMS: success returns the Infobip messageId', sms.success && sms.messageId === 'MSG-123' && sms.provider === 'infobip', JSON.stringify(sms))
check('SMS: POST /sms/2/text/advanced on the configured host (trailing slash tolerated)', last.method === 'POST' && last.url === '/sms/2/text/advanced')
check('SMS: Authorization is "App <key>", JSON body', last.auth === 'App test-key-123' && /application\/json/.test(last.type))
check('SMS: body has destination, sender and the code text', last.body.messages[0].destinations[0].to === '212612345678' && last.body.messages[0].from === 'MAGHAREBIT' && last.body.messages[0].text.includes('482913'))
await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '482913', locale: 'ar' })
check('SMS: Arabic text is sent as UTF-8 and contains the code', last.body.messages[0].text.includes('482913') && /[؀-ۿ]/.test(last.body.messages[0].text))

// ── WhatsApp ──────────────────────────────────────────────────────────────────
const wa = await D.deliverOtp({ channel: 'whatsapp', phone: '212612345678', code: '777001', locale: 'ar' })
check('WhatsApp: success returns the Infobip messageId', wa.success && wa.messageId === 'MSG-123')
const m = last.body.messages[0]
check('WhatsApp: POST /whatsapp/1/message/template', last.url === '/whatsapp/1/message/template')
check('WhatsApp: from/to, default template name, language = locale', m.from === '212600000099' && m.to === '212612345678' && m.content.templateName === 'mgh_otp' && m.content.language === 'ar')
check('WhatsApp: code in body placeholder and copy-code button', m.content.templateData.body.placeholders[0] === '777001' && m.content.templateData.buttons[0].parameter === '777001' && m.content.templateData.buttons[0].type === 'URL')
set({ INFOBIP_WHATSAPP_TEMPLATE: 'custom_otp' }); await D.deliverOtp({ channel: 'whatsapp', phone: '212612345678', code: '1', locale: 'en' })
check('WhatsApp: INFOBIP_WHATSAPP_TEMPLATE overrides the template name', last.body.messages[0].content.templateName === 'custom_otp')
set({ INFOBIP_WHATSAPP_TEMPLATE: undefined })

// ── errors ────────────────────────────────────────────────────────────────────
for (const [md, expected] of [['rejected', 'infobip_rejected'], ['401', 'infobip_unauthorized'], ['400', 'infobip_bad_request'], ['429', 'infobip_rate_limited'], ['500', 'infobip_unavailable']]) {
  mode = md
  const r = await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '999999', locale: 'fr' })
  check(`error mapping: ${md} -> ${expected}`, r.success === false && r.error === expected, r.error)
  check(`error mapping: ${md} result never contains the code or the API key`, !JSON.stringify(r).includes('999999') && !JSON.stringify(r).includes('test-key-123'))
}
mode = 'slow'; set({ INFOBIP_TIMEOUT_MS: '300' })
const t0 = Date.now(); const slow = await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '1', locale: 'fr' })
check('timeout: slow provider gives infobip_timeout quickly', slow.error === 'infobip_timeout' && Date.now() - t0 < 2000, `${Date.now() - t0} ms`)
set({ INFOBIP_TIMEOUT_MS: undefined }); mode = 'ok'

set({ ...full, INFOBIP_SMS_SENDER: undefined })
check('guard: missing SMS sender is reported, not sent', (await D.deliverOtp({ channel: 'sms', phone: '212612345678', code: '1', locale: 'fr' })).error === 'infobip_sms_sender_missing')
set({ ...full, INFOBIP_WHATSAPP_SENDER: undefined })
check('guard: missing WhatsApp sender is reported, not sent', (await D.deliverOtp({ channel: 'whatsapp', phone: '212612345678', code: '1', locale: 'fr' })).error === 'infobip_whatsapp_sender_missing')
set({ ...full, INFOBIP_BASE_URL: 'abc123.api.infobip.com' })
check('base URL without scheme gets https://', (await import('node:module')).createRequire(join(tmp, 'x.js'))('./otp-delivery/infobip.js').infobipBaseUrl() === 'https://abc123.api.infobip.com')

server.closeAllConnections?.(); server.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exitCode = fail ? 1 : 0
