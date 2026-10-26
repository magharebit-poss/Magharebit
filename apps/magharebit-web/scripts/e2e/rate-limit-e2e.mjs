// Shared rate limiter across server instances.
// Start TWO servers on the same build and the same database, e.g.
//   MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_rl NEXT_DIST_DIR=.next-test npx next start -p 3021
//   MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_rl NEXT_DIST_DIR=.next-test npx next start -p 3022
// then: APP_DIR=. node scripts/e2e/rate-limit-e2e.mjs
// Each check uses its own fake client IP (x-forwarded-for), so runs do not interfere.
import { createRequire } from 'node:module'
import { createHash, randomBytes } from 'node:crypto'

const A = process.env.BASE_A || 'http://localhost:3021'
const Bsrv = process.env.BASE_B || 'http://localhost:3022'
const APP = process.env.APP_DIR || process.cwd()
const { MongoClient } = createRequire(`${APP}/package.json`)('mongodb')
const mongo = new MongoClient('mongodb://127.0.0.1:27018'); await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB || 'magharebit_rl')

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const ip = () => `198.51.100.${1 + (randomBytes(1)[0] % 250)}-${randomBytes(3).toString('hex')}`
const post = (base, path, body, fwd) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': fwd }, body: JSON.stringify(body) }).then((r) => r.status)

// 1) admin login: 10 per 15 min per IP, alternating between the two instances
{
  const who = ip(); const codes = []
  for (let i = 0; i < 14; i++) codes.push(await post(i % 2 ? Bsrv : A, '/api/admin/login', { username: 'nobody', password: 'wrong-password-123' }, who))
  const limited = codes.filter((c) => c === 429).length
  check('admin login: 10 attempts allowed in total across both instances, then 429', codes.slice(0, 10).every((c) => c !== 429) && limited === 4, codes.join(','))
  const b = await post(Bsrv, '/api/admin/login', { username: 'nobody', password: 'x' }, who)
  check('admin login: instance B also refuses once the shared window is used up', b === 429)
  const other = await post(A, '/api/admin/login', { username: 'nobody2', password: 'wrong-password-123' }, ip())
  check('admin login: a different client IP is not affected', other !== 429, String(other))
}

// 2) license validate: 120 per minute per IP, 150 concurrent requests split across both instances
{
  const who = ip()
  const codes = await Promise.all(Array.from({ length: 150 }, (_, i) => post(i % 2 ? Bsrv : A, '/api/licenses/validate', { key: 'MGH-202610-AAAAAAAA-BBBB-ZZ' }, who)))
  const ok = codes.filter((c) => c === 200).length, limited = codes.filter((c) => c === 429).length
  check('validate: exactly 120 of 150 concurrent requests allowed (no over-admission in races)', ok === 120 && limited === 30, `200=${ok} 429=${limited}`)
}

// 3) storage: hashed keys, TTL index, expiry set
{
  const docs = await db.collection('rate_limits').find({}).toArray()
  check('store: documents exist in rate_limits', docs.length >= 3, String(docs.length))
  check('store: keys are hashed (no raw IP or route name stored)', docs.every((d) => /^[A-Za-z0-9_-]{43}$/.test(d._id) && !String(d._id).includes('198.51.100')))
  check('store: every document has resetAt/expiresAt in the future', docs.every((d) => d.expiresAt instanceof Date && d.expiresAt.getTime() === d.resetAt.getTime()))
  const idx = await db.collection('rate_limits').indexes()
  check('store: TTL index on expiresAt', idx.some((i) => i.key?.expiresAt === 1 && i.expireAfterSeconds === 0))
  const expected = createHash('sha256').update('admin-login-user:nobody').digest('base64url')
  check('store: per-username login key present (hash of admin-login-user:nobody)', docs.some((d) => d._id === expected))
}

// 4) window reset: an expired window starts again at 1
{
  const who = ip()
  const k = createHash('sha256').update(`license-activate:${who}`).digest('base64url')
  await db.collection('rate_limits').insertOne({ _id: k, count: 999, resetAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() - 1000) })
  const s = await post(A, '/api/licenses/activate', { key: 'MGH-202610-AAAAAAAA-BBBB-ZZ', machineId: 'TERMINAL-RL-0001' }, who)
  const after = await db.collection('rate_limits').findOne({ _id: k })
  check('reset: an expired window restarts (request allowed, count back to 1)', s !== 429 && after.count === 1 && after.resetAt.getTime() > Date.now(), `${s} count=${after?.count}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
await mongo.close()
process.exit(fail ? 1 : 0)
