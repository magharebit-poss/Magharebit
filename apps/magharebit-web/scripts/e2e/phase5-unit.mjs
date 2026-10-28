// Phase 5 pure helpers: Morocco day boundaries (incl. Ramadan UTC+0), CSV escaping + BOM, the XLSX writer,
// Arabic-tolerant search patterns. No server needed. Run: APP_DIR=. node scripts/e2e/phase5-unit.mjs
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'

const APP = resolve(process.env.APP_DIR || process.cwd())
const appRequire = createRequire(`${APP}/package.json`)
const ts = appRequire('typescript')
const fflatePath = appRequire.resolve('fflate')
const tmp = mkdtempSync(join(tmpdir(), 'mgh-p5-'))
mkdirSync(join(tmp, 'export'))
for (const f of ['zoned-time', 'regex', 'admin-search', 'export/csv', 'export/xlsx']) {
  let out = ts.transpileModule(readFileSync(`${APP}/src/lib/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  out = out.replace(/require\("fflate"\)/g, `require(${JSON.stringify(fflatePath)})`)
  writeFileSync(join(tmp, `${f}.js`), out)
}
const req = createRequire(join(tmp, 'x.js'))
const Z = req('./zoned-time.js'), S = req('./admin-search.js'), C = req('./export/csv.js'), X = req('./export/xlsx.js')
const { unzipSync, strFromU8 } = appRequire('fflate')

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const iso = (d) => d.toISOString()

// ── Morocco days ──────────────────────────────────────────────────────────────
check('Casablanca is UTC+1 in October', Z.tzOffsetMs(new Date('2026-10-27T12:00:00Z')) === 3_600_000)
check('Casablanca is UTC+0 during Ramadan (1 March 2026)', Z.tzOffsetMs(new Date('2026-03-01T12:00:00Z')) === 0, String(Z.tzOffsetMs(new Date('2026-03-01T12:00:00Z'))))
check('23:30 UTC is already the next day in Casablanca', Z.zonedDateKey(new Date('2026-10-27T23:30:00Z')) === '2026-10-28')
check('today starts at 23:00 UTC the evening before', iso(Z.zonedDayStart(new Date('2026-10-27T23:30:00Z'))) === '2026-10-27T23:00:00.000Z')
check('yesterday start = 24 h earlier on a normal day', iso(Z.zonedDayStart(new Date('2026-10-27T10:00:00Z'), undefined, -1)) === '2026-10-25T23:00:00.000Z')
check('during Ramadan a day starts at 00:00 UTC', iso(Z.zonedDayStart(new Date('2026-03-01T10:00:00Z'))) === '2026-03-01T00:00:00.000Z')
// Find the day the clock changes after Ramadan 2026 and check that day's start and the next one are both local midnights.
let switchDay = null
for (let d = 0; d < 80; d++) { const t = new Date(Date.UTC(2026, 1, 1 + d, 12)); if (Z.tzOffsetMs(t) !== Z.tzOffsetMs(new Date(t.getTime() - 86_400_000))) { switchDay = t; break } }
check('found an offset change around Ramadan 2026', !!switchDay, switchDay && iso(switchDay))
if (switchDay) {
  const start = Z.zonedDayStart(switchDay), next = Z.zonedDayStart(switchDay, undefined, 1)
  const localMidnight = (d) => new Date(d.getTime() + Z.tzOffsetMs(d)).toISOString().slice(11, 19) === '00:00:00'
  check('day starts on both sides of the change are local midnight', localMidnight(start) && localMidnight(next) && Z.zonedDateKey(start) === iso(switchDay).slice(0, 10), `${iso(start)} / ${iso(next)}`)
}
check('zonedStartOfKey parses a day and rejects junk', iso(Z.zonedStartOfKey('2026-10-28')) === '2026-10-27T23:00:00.000Z' && Z.zonedStartOfKey('2026-02-30') === null && Z.zonedStartOfKey('x') === null)

// ── CSV ───────────────────────────────────────────────────────────────────────
check('formula-looking text gets an apostrophe', C.csvCell('=HYPERLINK("http://x")') === `"'=HYPERLINK(""http://x"")"` && C.csvCell('+212600') === "'+212600" && C.csvCell('@SUM(A1)') === "'@SUM(A1)" && C.csvCell('-1') === "'-1")
check('real numbers are not touched (negative too)', C.csvCell(-5) === '-5' && C.csvCell(12.5) === '12.5' && C.csvCell(null) === '')
check('commas, quotes, newlines are quoted per RFC 4180', C.csvCell('a,b') === '"a,b"' && C.csvCell('say "hi"') === '"say ""hi"""' && C.csvCell('l1\nl2') === '"l1\nl2"')
const csv = C.toCsv({ name: 't', headers: ['المتجر', 'Total'], rows: [['مخبزة الأمل', 12.5], ['Épicerie', null]] })
check('CSV starts with a UTF-8 BOM, CRLF lines, Arabic kept as is', csv.startsWith('﻿المتجر,Total\r\n') && csv.includes('مخبزة الأمل,12.5\r\n') && csv.endsWith('Épicerie,\r\n'))

// ── XLSX ──────────────────────────────────────────────────────────────────────
check('column names A, Z, AA, ZZ, AAA', ['A', 'Z', 'AA', 'ZZ', 'AAA'].join() === [0, 25, 26, 701, 702].map(X.columnName).join())
const bin = X.toXlsx({ name: 'leads: [test]?', headers: ['Shop', 'Amount', 'Note'], rows: [['Café <&> "Atlas"', 1234.5, '=1+1'], ['مخبزة', null, 'x\u0001y']], rtl: true })
const files = unzipSync(bin)
check('xlsx is a zip with the six required parts', ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'].every((f) => files[f]), Object.keys(files).join(' '))
const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])
const wb = strFromU8(files['xl/workbook.xml'])
check('header row bold (s="1"), frozen, right-to-left for Arabic', sheet.includes('<c r="A1" s="1" t="inlineStr">') && sheet.includes('state="frozen"') && sheet.includes('rightToLeft="1"'))
check('numbers are numeric cells, text is escaped inline text', sheet.includes('<c r="B2"><v>1234.5</v></c>') && sheet.includes('Café &lt;&amp;&gt; &quot;Atlas&quot;') && sheet.includes('<t xml:space="preserve">مخبزة</t>'))
check('a formula-looking string stays a string (never <f>)', sheet.includes('<t xml:space="preserve">=1+1</t>') && !sheet.includes('<f>'))
check('control characters dropped, empty cells skipped, dimension set', sheet.includes('>xy<') && !sheet.includes('r="B3"') && sheet.includes('<dimension ref="A1:C3"/>'))
check('sheet name cleaned of : [ ] ?', wb.includes('<sheet name="leads   test"'), wb.match(/<sheet name="[^"]*"/)?.[0])
const long = strFromU8(unzipSync(X.toXlsx({ name: 'x'.repeat(40), headers: ['a'], rows: [] }))['xl/workbook.xml'])
check('sheet name capped at 31 characters', long.includes(`<sheet name="${'x'.repeat(31)}"`))
check('every XML part declares UTF-8 and is non-empty', Object.values(files).every((u) => strFromU8(u).startsWith('<?xml version="1.0" encoding="UTF-8"')))

// ── Search pattern ────────────────────────────────────────────────────────────
const m = (q, text) => new RegExp(S.searchPattern(S.normaliseQuery(q)), 'i').test(text)
check('alef variants match each other (احمد finds أحمد)', m('احمد', 'متجر أحمد') && m('أحمد', 'متجر احمد') && m('امل', 'مخبزة الأمل'))
check('ta marbuta / ha and ya / alef maqsura match', m('مخبزه', 'مخبزة الأمل') && m('مصطفى', 'مصطفي'))
check('tashkeel in the stored text is skipped, in the query stripped', m('مخبزة', 'مَخْبَزَة') && m('مَخبزة', 'مخبزة'))
check('Latin search is case-insensitive "contains"', m('atlas', 'Café ATLAS Rabat') && !m('atlax', 'Café ATLAS'))
check('regex characters are literal (no injection, no error)', m('a+b(', 'shop a+b( x') && !m('a+b(', 'shop aab x') && m('.*', 'x.*y') && !m('.*', 'xy'))
check('queries under 2 characters are rejected; long ones capped at 64', S.normaliseQuery(' a ') === '' && S.normaliseQuery('x'.repeat(100)).length === 64)
check('pattern has no nested quantifiers', !/\)\*|\]\*\)\*|\+\)\+/.test(S.searchPattern('مخبزة الأمل')))
check('pattern has no \\u escapes (MongoDB PCRE2 rejects them)', !/\\u/.test(S.searchPattern('مخبزة الأمل')))

console.log(`\n${pass} passed, ${fail} failed`)
process.exitCode = fail ? 1 : 0
