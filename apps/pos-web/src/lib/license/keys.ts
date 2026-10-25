// Trusted license-signing PUBLIC keys. Public keys only: a private key must never be added here.
// Source of truth for the format and the test vector: GreenGo-web/apps/magharebit-web/docs/pos-license-contract.md

export interface TrustedKey {
  /** Key id, matched exactly against the token header `kid`. */
  kid: string;
  /** Raw 32-byte Ed25519 public key, base64url (the JWK `x` value). */
  x: string;
}

/**
 * Production keys. EMPTY on purpose until the server answers `GET /api/licenses/jwks` with 200
 * (contract section 3.6). Copy each production JWK's `kid` and `x` here, then ship; rotation adds a
 * new entry while the old one stays until its tokens expire. With an empty set a production build
 * rejects every v2 token.
 */
export const PRODUCTION_KEYS: readonly TrustedKey[] = [];

/** Contract section 6 test key. Never trusted by a production build. */
export const TEST_KEYS: readonly TrustedKey[] = [
  { kid: 'test-vector-1', x: 'fcISkcYB-FLx2RII_D0cJYNF1By2hNyy9rgl3WfsHLk' },
];

/**
 * The key set a build trusts. A production build (NODE_ENV === 'production', which `next build`
 * inlines) trusts the production keys only; every other build also trusts the test key.
 */
export function getTrustedKeys(isProduction: boolean = process.env.NODE_ENV === 'production'): readonly TrustedKey[] {
  return isProduction ? PRODUCTION_KEYS : [...PRODUCTION_KEYS, ...TEST_KEYS];
}
