import { generateLicenseKey, verifyLicenseKey } from '../license-engine';

const TEST_SECRET = 'test-master-signing-secret-never-in-production';

describe('License Key Generation', () => {
  test('format matches GGPO-{6}-{8}-{4}', () => {
    const key = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const parts = key.split('-');
    expect(parts[0]).toBe('GGPO');
    expect(parts[1].length).toBe(6);
    expect(parts[2].length).toBe(8);
    expect(parts[3].length).toBe(4);
    expect(key).toMatch(/^GGPO-[A-Z0-9]{6}-[A-Z0-9]{8}-[A-Z0-9]{4}$/);
  });

  test('checksum verifies correctly', () => {
    const key = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const result = verifyLicenseKey(key, TEST_SECRET);
    expect(result.valid).toBe(true);
    expect(result.tenantPrefix).toBe('01905A');
  });

  test('two keys for same tenant differ (random component)', () => {
    const key1 = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const key2 = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    expect(key1).not.toBe(key2);
  });
});

describe('License Key Verification', () => {
  test('valid key returns { valid: true }', () => {
    const key = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const result = verifyLicenseKey(key, TEST_SECRET);
    expect(result.valid).toBe(true);
  });

  test('tampered checksum returns { valid: false } — uses timingSafeEqual', () => {
    // timingSafeEqual prevents timing attacks — verified in implementation
    const key = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const tampered = key.slice(0, -4) + 'ZZZZ';
    const result = verifyLicenseKey(tampered, TEST_SECRET);
    expect(result.valid).toBe(false);
    expect(result.tenantPrefix).toBeNull();
  });

  test('wrong length components return false', () => {
    expect(verifyLicenseKey('GGPO-ABC-12345678-1234', TEST_SECRET).valid).toBe(false);
    expect(verifyLicenseKey('GGPO-ABCDEF-1234-1234', TEST_SECRET).valid).toBe(false);
    expect(verifyLicenseKey('NOTGGPO-ABCDEF-12345678-1234', TEST_SECRET).valid).toBe(false);
  });

  test('wrong secret returns false', () => {
    const key = generateLicenseKey('01905a00-0001-7000-8000-000000000001', TEST_SECRET);
    const result = verifyLicenseKey(key, 'wrong-secret');
    expect(result.valid).toBe(false);
  });
});
