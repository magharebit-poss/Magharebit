// installerUrl(): configured URL wins; the placeholder exists ONLY under NODE_ENV=development; production never fakes a URL.
// No server needed. Run: APP_DIR=. node scripts/e2e/downloads-unit.mjs
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const APP = process.env.APP_DIR || process.cwd()
const ts = createRequire(`${APP}/package.json`)('typescript')
const tmp = mkdtempSync(join(tmpdir(), 'mgh-dl-'))
writeFileSync(join(tmp, 'downloads.js'), ts.transpileModule(readFileSync(`${APP}/src/lib/downloads.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)
const D = createRequire(join(tmp, 'x.js'))('./downloads.js')

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const set = (o) => { for (const [k, v] of Object.entries(o)) { if (v === undefined) delete process.env[k]; else process.env[k] = v } }
const none = { DOWNLOAD_WINDOWS_URL: undefined, DOWNLOAD_ANDROID_URL: undefined, NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL: undefined, NEXT_PUBLIC_DOWNLOAD_ANDROID_URL: undefined }

set({ ...none, NODE_ENV: 'development' })
check('development, nothing configured: placeholder paths for both platforms', D.installerUrl('windows') === '/api/dev-installer/windows' && D.installerUrl('android') === '/api/dev-installer/android')
set({ ...none, NODE_ENV: 'production' })
check('production, nothing configured: empty (503 "not available yet"), never a fake URL', D.installerUrl('windows') === '' && D.installerUrl('android') === '')
set({ ...none, NODE_ENV: 'test' })
check('any other NODE_ENV (test): empty as well', D.installerUrl('windows') === '')
set({ ...none, NODE_ENV: 'development', DOWNLOAD_WINDOWS_URL: ' https://downloads.example.test/pos.exe ' })
check('a configured URL wins in development (trimmed); the other platform still uses the placeholder', D.installerUrl('windows') === 'https://downloads.example.test/pos.exe' && D.installerUrl('android') === '/api/dev-installer/android')
set({ ...none, NODE_ENV: 'production', DOWNLOAD_ANDROID_URL: 'https://downloads.example.test/pos.apk' })
check('production uses only what is configured', D.installerUrl('android') === 'https://downloads.example.test/pos.apk' && D.installerUrl('windows') === '')
set({ ...none, NODE_ENV: 'production', NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL: 'https://old.example.test/pos.exe' })
check('legacy NEXT_PUBLIC_DOWNLOAD_* name still accepted', D.installerUrl('windows') === 'https://old.example.test/pos.exe')

console.log(`\n${pass} passed, ${fail} failed`)
process.exitCode = fail ? 1 : 0
