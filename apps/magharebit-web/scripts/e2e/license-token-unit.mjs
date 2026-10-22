// Unit checks for src/lib/license-token.ts (no server, no database).
//   node scripts/e2e/license-token-unit.mjs
// The TypeScript sources are transpiled to a temp folder so the module is tested as written.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { generateKeyPairSync } from 'node:crypto'

const APP = process.cwd()
const req = createRequire(`${APP}/package.json`)
const ts = req('typescript')
const tmp = mkdtempSync(join(tmpdir(), 'mgh-token-'))
for (const f of ['license-token', 'plans']) {
  const out = ts.transpileModule(readFileSync(`${APP}/src/lib/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  writeFileSync(join(tmp, `${f}.js`), out.outputText)
}
const T = createRequire(join(tmp, 'x.js'))('./license-token.js')

let pass = 0, fail = 0
const check = (n, ok, x = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`) }
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

// keys
const { privateKey } = generateKeyPairSync('ed25519')
const der = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
const pem = privateKey.export({ format: 'pem', type: 'pkcs8' })
const env = { LICENSE_SIGNING_PRIVATE_KEY: der, LICENSE_SIGNING_KID: '2026-10' }

check('no key configured -> not configured (fail closed)', T.loadSigningKey({}) === null && T.isSigningConfigured({}) === false && T.publicJwks({}) === null)
check('garbage key -> not configured', T.loadSigningKey({ LICENSE_SIGNING_PRIVATE_KEY: 'not-a-key' }) === null)
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' })
check('non-Ed25519 key rejected', T.loadSigningKey({ LICENSE_SIGNING_PRIVATE_KEY: rsa }) === null)
check('base64 DER and PEM both load to the same key', T.publicJwks(env)[0].x === T.publicJwks({ LICENSE_SIGNING_PRIVATE_KEY: pem, LICENSE_SIGNING_KID: '2026-10' })[0].x)

const key = T.loadSigningKey(env)
const jwks = { keys: T.publicJwks(env) }
check('JWKS entry is OKP/Ed25519/EdDSA with kid', jwks.keys[0].kty === 'OKP' && jwks.keys[0].crv === 'Ed25519' && jwks.keys[0].alg === 'EdDSA' && jwks.keys[0].kid === '2026-10' && Buffer.from(jwks.keys[0].x, 'base64url').length === 32)

// claims
const NOW = 1_790_000_000_000
const lic = { id: 'LIC-TEST-0001', merchantId: '212600000001', plan: 'Business', isTrial: false, expiresAt: new Date(NOW + 180 * 86400 * 1000) }
const claims = T.buildClaims(lic, 'POS-DEMO-01', NOW)
check('claims: plan limits from the plan table', claims.maxRegisters === 3 && claims.maxBranches === 2 && claims.features.includes('inventory') && claims.plan === 'Business')
check('claims: exp = license expiry in seconds; refreshBy = iat + 7 days', claims.exp === Math.floor(lic.expiresAt.getTime() / 1000) && claims.refreshBy === claims.iat + 7 * 86400)
check('claims: iss/aud/schema/machine/trial', claims.iss === 'https://magharebit.com' && claims.aud === 'magharebit-pos' && claims.schema === 2 && claims.machineId === 'POS-DEMO-01' && claims.trial === false)
const short = T.buildClaims({ ...lic, expiresAt: new Date(NOW + 2 * 86400 * 1000), isTrial: true, plan: 'Starter' }, 'M-1', NOW)
check('claims: refreshBy never later than exp; trial uses Starter limits', short.refreshBy === short.exp && short.trial === true && short.maxRegisters === 1)

// sign + verify
const token = T.signLicenseToken(claims, key)
const secs = Math.floor(NOW / 1000)
check('token is a 3-part JWT with EdDSA header and kid', token.split('.').length === 3 && JSON.parse(Buffer.from(token.split('.')[0], 'base64url')).alg === 'EdDSA' && JSON.parse(Buffer.from(token.split('.')[0], 'base64url')).kid === '2026-10')
check('signature is 64 bytes', Buffer.from(token.split('.')[2], 'base64url').length === 64)
check('verifies with the published JWKS', T.verifyLicenseToken(token, jwks, { nowSeconds: secs + 60, machineId: 'POS-DEMO-01' }).ok === true)
const [h, p, s] = token.split('.')
const tampered = `${h}.${b64u({ ...claims, maxRegisters: 99 })}.${s}`
check('tampered payload -> bad_signature', T.verifyLicenseToken(tampered, jwks, { nowSeconds: secs }).reason === 'bad_signature')
check('flipped signature byte -> bad_signature', T.verifyLicenseToken(`${h}.${p}.${s.slice(0, -2)}AA`, jwks, { nowSeconds: secs }).ok === false)
check('alg none rejected', T.verifyLicenseToken(`${b64u({ alg: 'none', typ: 'JWT', kid: '2026-10' })}.${p}.`, jwks, { nowSeconds: secs }).reason === 'bad_alg')
check('alg HS256 rejected', T.verifyLicenseToken(`${b64u({ alg: 'HS256', typ: 'JWT', kid: '2026-10' })}.${p}.${s}`, jwks, { nowSeconds: secs }).reason === 'bad_alg')
check('unknown kid rejected', T.verifyLicenseToken(token, { keys: [{ kid: 'other', x: jwks.keys[0].x }] }, { nowSeconds: secs }).reason === 'unknown_kid')
const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' }).x
check('wrong public key for the kid -> bad_signature', T.verifyLicenseToken(token, { keys: [{ kid: '2026-10', x: other }] }, { nowSeconds: secs }).reason === 'bad_signature')
check('machine mismatch rejected', T.verifyLicenseToken(token, jwks, { nowSeconds: secs, machineId: 'OTHER' }).reason === 'machine_mismatch')
check('expiry is a hard stop at exp (valid at exp-1, expired at exp)', T.verifyLicenseToken(token, jwks, { nowSeconds: claims.exp - 1 }).ok === true && T.verifyLicenseToken(token, jwks, { nowSeconds: claims.exp }).reason === 'expired')
check('not yet valid (more than 5 min early)', T.verifyLicenseToken(token, jwks, { nowSeconds: claims.nbf - 301 }).reason === 'not_yet_valid' && T.verifyLicenseToken(token, jwks, { nowSeconds: claims.nbf - 200 }).ok === true)
check('offline window: ok until refreshBy + 72h, then needs_refresh', T.verifyLicenseToken(token, jwks, { nowSeconds: claims.refreshBy + 72 * 3600, lastRefreshOk: false }).ok === true && T.verifyLicenseToken(token, jwks, { nowSeconds: claims.refreshBy + 72 * 3600 + 1, lastRefreshOk: false }).reason === 'needs_refresh')
check('wrong issuer / audience / schema rejected', ['iss', 'aud', 'schema'].every((f) => {
  const bad = T.signLicenseToken({ ...claims, [f]: f === 'schema' ? 3 : 'x' }, key)
  return T.verifyLicenseToken(bad, jwks, { nowSeconds: secs }).ok === false
}))
check('malformed tokens rejected', ['', 'a.b', 'a.b.c.d', 'x.y.z'].every((t) => T.verifyLicenseToken(t, jwks).ok === false))

// the published contract test vector must verify with this same verifier
const doc = readFileSync(`${APP}/docs/pos-license-contract.md`, 'utf8')
const vecToken = doc.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)[0]
const vecX = doc.match(/"x": "([A-Za-z0-9_-]{43})"/)[1]
const vec = T.verifyLicenseToken(vecToken, { keys: [{ kid: 'test-vector-1', x: vecX }] }, { nowSeconds: 1_790_000_100, machineId: 'POS-DEMO-01' })
check('contract test vector verifies with the reference verifier', vec.ok === true && vec.claims.plan === 'Business' && vec.claims.maxRegisters === 3)
check('contract test vector: expired at exp, needs refresh after refreshBy+72h', T.verifyLicenseToken(vecToken, { keys: [{ kid: 'test-vector-1', x: vecX }] }, { nowSeconds: 1_805_000_000 }).reason === 'expired' && T.verifyLicenseToken(vecToken, { keys: [{ kid: 'test-vector-1', x: vecX }] }, { nowSeconds: 1_790_604_800 + 259_201, lastRefreshOk: false }).reason === 'needs_refresh')

// rotation: extra retired keys are served alongside the current one
const retired = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' })
const rot = T.publicJwks({ ...env, LICENSE_EXTRA_JWKS: JSON.stringify([{ kty: 'OKP', crv: 'Ed25519', x: retired.x, kid: '2026-04', alg: 'EdDSA', use: 'sig' }]) })
check('rotation: current + retired key published', rot.length === 2 && rot[0].kid === '2026-10' && rot[1].kid === '2026-04')
check('rotation: malformed extra keys ignored', T.publicJwks({ ...env, LICENSE_EXTRA_JWKS: '{not json' }).length === 1)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
