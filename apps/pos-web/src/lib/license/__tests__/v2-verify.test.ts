import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTrustedKeys, TEST_KEYS, type TrustedKey } from '../keys';
import {
  verifyEd25519Auto,
  verifyEd25519Noble,
  verifyLicenseV2,
  type VerifyOptions,
} from '../v2-verify';

// ── Contract section 6 test vector (TEST KEY ONLY) ─────────────────────────
const VECTOR =
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6InRlc3QtdmVjdG9yLTEifQ.eyJpc3MiOiJodHRwczovL21hZ2hhcmViaXQuY29tIiwiYXVkIjoibWFnaGFyZWJpdC1wb3MiLCJzdWIiOiIyMTI2MDAwMDAwMDEiLCJqdGkiOiJMSUMtVEVTVFZFQ1RPUi0wMDAxIiwiaWF0IjoxNzkwMDAwMDAwLCJuYmYiOjE3OTAwMDAwMDAsImV4cCI6MTgwNTAwMDAwMCwicmVmcmVzaEJ5IjoxNzkwNjA0ODAwLCJzY2hlbWEiOjIsInBsYW4iOiJCdXNpbmVzcyIsInRyaWFsIjpmYWxzZSwibWF4UmVnaXN0ZXJzIjozLCJtYXhCcmFuY2hlcyI6MiwiZmVhdHVyZXMiOlsiYmFzaWNfcG9zIiwicmVjZWlwdHMiLCJpbnZlbnRvcnkiLCJkaXNjb3VudHMiXSwibWFjaGluZUlkIjoiUE9TLURFTU8tMDEifQ.84nUFqrWKzLAb9kohRGwXFHBZopcxwxQZNSFhA_ddoJY2crw71YiHCTLWTfLaby9PaP1TQ7GOiRyLQ4LomRBDg';
const NOW = 1790100000;          // inside the vector's validity and before refreshBy
const NBF = 1790000000;
const REFRESH_BY = 1790604800;
const EXP = 1805000000;
const H72 = 72 * 3600;

const baseOpts: VerifyOptions = {
  keys: TEST_KEYS,
  now: NOW,
  expectedAud: 'magharebit-pos',
  machineId: 'POS-DEMO-01',
};

// ── Local signing key for the cases the vector cannot cover ────────────────
const b64u = (b: Buffer | string): string => Buffer.from(b).toString('base64url');
const pair = generateKeyPairSync('ed25519');
const localKey: TrustedKey = {
  kid: 'local-test',
  x: (pair.publicKey.export({ format: 'jwk' }) as { x: string }).x,
};
const goodClaims = {
  iss: 'https://magharebit.com', aud: 'magharebit-pos', sub: '212600000001', jti: 'LIC-LOCAL-0001',
  iat: NBF, nbf: NBF, exp: EXP, refreshBy: REFRESH_BY, schema: 2, plan: 'Business', trial: false,
  maxRegisters: 3, maxBranches: 2, features: ['basic_pos'], machineId: 'POS-DEMO-01',
};
function mint(opts: {
  claims?: Record<string, unknown>;
  header?: Record<string, unknown>;
  key?: KeyObject;
  rawSignature?: string;
} = {}): string {
  const header = opts.header ?? { alg: 'EdDSA', typ: 'JWT', kid: 'local-test' };
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify({ ...goodClaims, ...(opts.claims ?? {}) }));
  const sig = opts.rawSignature ?? b64u(sign(null, Buffer.from(`${h}.${p}`), opts.key ?? pair.privateKey));
  return `${h}.${p}.${sig}`;
}
const local = (over: Partial<VerifyOptions> = {}): VerifyOptions => ({ ...baseOpts, keys: [localKey], ...over });

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('contract vector (section 6)', () => {
  it('valid at now=1790100000, with the contract claims', async () => {
    const r = await verifyLicenseV2(VECTOR, baseOpts);
    expect(r.status).toBe('valid');
    expect(r.claims?.machineId).toBe('POS-DEMO-01');
    expect(r.claims?.plan).toBe('Business');
    expect(r.claims?.maxRegisters).toBe(3);
    expect(r.claims?.maxBranches).toBe(2);
    expect(r.claims?.features).toEqual(['basic_pos', 'receipts', 'inventory', 'discounts']);
  });

  it('refreshBy + 1 -> refresh_due', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: REFRESH_BY + 1 })).status).toBe('refresh_due');
  });
  it('refreshBy exactly -> still valid', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: REFRESH_BY })).status).toBe('valid');
  });
  it('refreshBy + 72h exactly -> refresh_due; +1 -> lapsed', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: REFRESH_BY + H72 })).status).toBe('refresh_due');
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: REFRESH_BY + H72 + 1 })).status).toBe('lapsed');
  });
  it('exp -> expired (no grace); exp - 1 is already lapsed (refresh long overdue)', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: EXP })).status).toBe('expired');
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: EXP + 1000 })).status).toBe('expired');
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, now: EXP - 1 })).status).toBe('lapsed');
  });
  it('the real current date -> lapsed (expired once the vector exp has passed)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const r = await verifyLicenseV2(VECTOR, { ...baseOpts, now });
    expect(r.status).toBe(now < EXP ? 'lapsed' : 'expired');
  });
  it('tampered payload -> bad_signature', async () => {
    const [h, p, s] = VECTOR.split('.') as [string, string, string];
    const flipped = p.slice(0, 20) + (p[20] === 'A' ? 'B' : 'A') + p.slice(21);
    const r = await verifyLicenseV2(`${h}.${flipped}.${s}`, baseOpts);
    expect(r.status).toBe('bad_signature');
    expect(r.claims).toBeNull();
  });
  it('tampered signature -> bad_signature', async () => {
    const [h, p, s] = VECTOR.split('.') as [string, string, string];
    const flipped = s.slice(0, 10) + (s[10] === 'A' ? 'B' : 'A') + s.slice(11);
    expect((await verifyLicenseV2(`${h}.${p}.${flipped}`, baseOpts)).status).toBe('bad_signature');
  });
  it('wrong machineId -> machine_mismatch (claims still returned, signature was good)', async () => {
    const r = await verifyLicenseV2(VECTOR, { ...baseOpts, machineId: 'POS-OTHER' });
    expect(r.status).toBe('machine_mismatch');
    expect(r.claims?.machineId).toBe('POS-DEMO-01');
  });
  it('wrong audience / issuer -> bad_format', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, expectedAud: 'someone-else' })).status).toBe('bad_format');
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, expectedIss: 'https://evil.example' })).status).toBe('bad_format');
  });
});

describe('header and key selection', () => {
  it('alg none -> bad_format', async () => {
    const h = b64u(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'local-test' }));
    const p = b64u(JSON.stringify(goodClaims));
    expect((await verifyLicenseV2(`${h}.${p}.`, local())).status).toBe('bad_format');
    expect((await verifyLicenseV2(`${h}.${p}.${b64u('x'.repeat(64))}`, local())).status).toBe('bad_format');
  });
  it('alg HS256 -> bad_format', async () => {
    const token = mint({ header: { alg: 'HS256', typ: 'JWT', kid: 'local-test' } });
    expect((await verifyLicenseV2(token, local())).status).toBe('bad_format');
  });
  it('typ other than JWT -> bad_format', async () => {
    expect((await verifyLicenseV2(mint({ header: { alg: 'EdDSA', typ: 'JWS', kid: 'local-test' } }), local())).status).toBe('bad_format');
  });
  it('unknown kid -> error, never a fallback to another trusted key', async () => {
    // Signed correctly by a key we DO trust, but labelled with a kid we do not hold.
    const token = mint({ header: { alg: 'EdDSA', typ: 'JWT', kid: 'not-held' } });
    const r = await verifyLicenseV2(token, local({ keys: [localKey, ...TEST_KEYS] }));
    expect(r.status).toBe('bad_signature');
    expect(r.reason).toBe('unknown_kid');
  });
  it('a token signed by a different key but labelled with a trusted kid -> bad_signature', async () => {
    const other = generateKeyPairSync('ed25519');
    expect((await verifyLicenseV2(mint({ key: other.privateKey }), local())).status).toBe('bad_signature');
  });
  it('a valid token under a key set that lacks its kid -> bad_signature', async () => {
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, keys: [localKey] })).reason).toBe('unknown_kid');
  });
});

describe('claims and time rules (local signing key)', () => {
  it('a well-formed local token is valid', async () => {
    expect((await verifyLicenseV2(mint(), local())).status).toBe('valid');
  });
  it('schema other than 2 -> bad_format', async () => {
    expect((await verifyLicenseV2(mint({ claims: { schema: 3 } }), local())).status).toBe('bad_format');
    expect((await verifyLicenseV2(mint({ claims: { schema: 1 } }), local())).status).toBe('bad_format');
  });
  it('wrong claim types -> bad_format', async () => {
    expect((await verifyLicenseV2(mint({ claims: { exp: '1805000000' } }), local())).status).toBe('bad_format');
    expect((await verifyLicenseV2(mint({ claims: { features: 'basic_pos' } }), local())).status).toBe('bad_format');
    expect((await verifyLicenseV2(mint({ claims: { maxRegisters: -1 } }), local())).status).toBe('bad_format');
  });
  it('nbf inside the 300 s skew is accepted; beyond it is not_yet_valid', async () => {
    const t = (n: number) => mint({ claims: { nbf: NOW + n } });
    expect((await verifyLicenseV2(t(299), local())).status).toBe('valid');
    expect((await verifyLicenseV2(t(300), local())).status).toBe('valid');
    expect((await verifyLicenseV2(t(301), local())).status).toBe('not_yet_valid');
  });
  it('clock rollback: more than 24 h behind the highest trusted time', async () => {
    const day = 24 * 3600;
    expect((await verifyLicenseV2(mint(), local({ highestTrustedTime: NOW + day }))).status).toBe('valid');
    expect((await verifyLicenseV2(mint(), local({ highestTrustedTime: NOW + day + 1 }))).status).toBe('clock_rollback');
    expect((await verifyLicenseV2(mint(), local({ highestTrustedTime: NOW + 30 * day }))).status).toBe('clock_rollback');
  });
  it('a rolled-back clock never extends validity (an expired token is not rescued)', async () => {
    // Real time is past exp, device clock set back inside the validity window: rollback wins.
    const r = await verifyLicenseV2(mint(), local({ now: EXP - 10, highestTrustedTime: EXP + 10 * 24 * 3600 }));
    expect(r.status).toBe('clock_rollback');
  });
});

describe('never throws', () => {
  it.each([
    ['empty string', ''],
    ['one part', 'abc'],
    ['two parts', 'a.b'],
    ['four parts', 'a.b.c.d'],
    ['bad base64', '!!!.@@@.###'],
    ['non-JSON header', `${b64u('not json')}.${b64u('{}')}.${b64u('x')}`],
    ['oversized', 'a'.repeat(20000)],
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['object', {}],
  ])('%s -> bad_format', async (_name, input) => {
    const r = await verifyLicenseV2(input, baseOpts);
    expect(r.status).toBe('bad_format');
    expect(r.claims).toBeNull();
  });
  it('a verifier that throws is reported as bad_signature', async () => {
    const r = await verifyLicenseV2(VECTOR, { ...baseOpts, verifyEd25519: async () => { throw new Error('boom'); } });
    expect(r.status).toBe('bad_signature');
  });
  it('the token never appears in the result', async () => {
    const r = await verifyLicenseV2(VECTOR, { ...baseOpts, machineId: 'x' });
    expect(JSON.stringify(r)).not.toContain(VECTOR.slice(0, 40));
  });
});

describe('trusted key set (production vs other builds)', () => {
  it('a non-production build trusts the test key and accepts the vector', async () => {
    const keys = getTrustedKeys(false);
    expect(keys.some((k) => k.kid === 'test-vector-1')).toBe(true);
    expect((await verifyLicenseV2(VECTOR, { ...baseOpts, keys })).status).toBe('valid');
  });
  it('a production build rejects test-vector-1', async () => {
    const keys = getTrustedKeys(true);
    expect(keys.some((k) => k.kid === 'test-vector-1')).toBe(false);
    const r = await verifyLicenseV2(VECTOR, { ...baseOpts, keys });
    expect(r.status).toBe('bad_signature');
    expect(r.reason).toBe('unknown_kid');
  });
  it('NODE_ENV=production selects the production set by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getTrustedKeys().some((k) => k.kid === 'test-vector-1')).toBe(false);
    vi.stubEnv('NODE_ENV', 'test');
    expect(getTrustedKeys().some((k) => k.kid === 'test-vector-1')).toBe(true);
  });
  it('keys.ts holds public material only', () => {
    for (const k of getTrustedKeys(false)) {
      expect(Object.keys(k).sort()).toEqual(['kid', 'x']);
      expect(Buffer.from(k.x, 'base64url')).toHaveLength(32);
    }
  });
});

describe('Ed25519 backends', () => {
  const [h, p, s] = VECTOR.split('.') as [string, string, string];
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = new Uint8Array(Buffer.from(s, 'base64url'));
  const pub = new Uint8Array(Buffer.from(TEST_KEYS[0]!.x, 'base64url'));

  it('noble verifies the contract vector and rejects a changed byte', async () => {
    expect(await verifyEd25519Noble(pub, sig, data)).toBe(true);
    expect(await verifyEd25519Noble(pub, sig, new TextEncoder().encode(`${h}.${p}x`))).toBe(false);
  });
  it('falls back to noble when Web Crypto has no Ed25519, and still verifies the vector', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new DOMException('Unrecognized algorithm name', 'NotSupportedError'));
    expect(await verifyEd25519Auto(pub, sig, data)).toBe(true);
    expect((await verifyLicenseV2(VECTOR, baseOpts)).status).toBe('valid');
  });
  it('a Web Crypto "false" is final: no second chance for a bad signature', async () => {
    // The real vector signature is valid, so noble would answer true if Auto ever fell back to it.
    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(false);
    expect(await verifyEd25519Auto(pub, sig, data)).toBe(false);
  });
});
