// Generates a NEW Ed25519 signing key for license tokens (v2).
//   node scripts/gen-license-keypair.mjs 2026-10
// Prints the two environment variables for the SERVER (secret store / .env.local) and the public JWK
// for information. Never commit the output and never put the private key in the POS build.
import { generateKeyPairSync } from 'node:crypto'

const kid = process.argv[2] || new Date().toISOString().slice(0, 7)
const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const der = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')
const jwk = publicKey.export({ format: 'jwk' })

console.log('# --- keep these two lines SECRET (server-side secret store only) ---')
console.log(`LICENSE_SIGNING_KID=${kid}`)
console.log(`LICENSE_SIGNING_PRIVATE_KEY=${der}`)
console.log('')
console.log('# --- public key (safe to share; served at /api/licenses/jwks) ---')
console.log(JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid, alg: 'EdDSA', use: 'sig' }))
console.log('')
console.log('# Rotation: set the NEW key as LICENSE_SIGNING_*, and put the OLD public JWK in')
console.log('# LICENSE_EXTRA_JWKS (JSON array) until every token it signed has expired.')
