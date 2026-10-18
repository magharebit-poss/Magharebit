import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Stable per-install device identifier.
 *
 * Generated once and persisted to backend/data/device-id.json (gitignored) so
 * the backend identifies itself to the license validation API consistently
 * across restarts. Not a secret — it is an opaque install UUID.
 */

const DATA_DIR = resolve(process.cwd(), 'data');
const DEVICE_ID_FILE = resolve(DATA_DIR, 'device-id.json');

/** True if a device-id file is persisted on disk (i.e. filesystem persistence works). */
export function isDeviceIdPersisted(): boolean {
  return existsSync(DEVICE_ID_FILE);
}

export function getOrCreateDeviceId(): string {
  // Return the persisted id if present and valid.
  try {
    if (existsSync(DEVICE_ID_FILE)) {
      const raw = readFileSync(DEVICE_ID_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { id?: string };
      if (parsed.id && typeof parsed.id === 'string') {
        return parsed.id;
      }
    }
  } catch {
    // Corrupt/unreadable file → regenerate below.
  }

  const id = randomUUID();
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      DEVICE_ID_FILE,
      JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
  } catch {
    // Filesystem not writable (e.g. read-only container) → return ephemeral id.
    // The env-var fallback (LICENSE_DEVICE_ID) covers this case in the verifier.
  }
  return id;
}
