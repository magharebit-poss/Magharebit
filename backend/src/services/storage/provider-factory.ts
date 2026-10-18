import type { StorageProvider } from './provider.js';
import { LocalStorageProvider } from './local-storage.js';

export function getStorageProvider(): StorageProvider {
  const provider = process.env['STORAGE_PROVIDER'] ?? 'local';
  if (provider === 'local') {
    return new LocalStorageProvider();
  }
  // Future: 's3' → new S3StorageProvider()
  throw new Error(`Unknown STORAGE_PROVIDER: ${provider}`);
}
