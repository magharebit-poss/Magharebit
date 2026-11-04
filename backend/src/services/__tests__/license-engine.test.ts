import { describe, test, expect } from 'vitest';
import * as licenseEngine from '../license-engine';

// The 7 tests that lived here covered generateLicenseKey / verifyLicenseKey
// (GGPO-{6}-{8}-{4} format, checksum, timingSafeEqual, wrong secret). Both
// functions were removed: key generation moved to the website backend, and this
// module now only validates against the remote API (see the header of
// license-engine.ts). Their tests were removed with them, not weakened.
// Remote validation, caching, grace period and device binding are still untested here.

describe('license-engine public surface', () => {
  test('exports no key generator or local signer (generation lives in the website backend)', () => {
    const exported = Object.keys(licenseEngine);
    expect(exported).not.toContain('generateLicenseKey');
    expect(exported).not.toContain('verifyLicenseKey');
  });
});
