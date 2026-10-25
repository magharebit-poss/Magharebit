import { GreenApiProvider, type GreenApiCredentials } from './green-api.js';
import type { WhatsAppProvider } from './provider.js';

/**
 * Returns a NEW provider on every call (never cached), so a tenant's credentials
 * can never be reused for another tenant. Pass the tenant's own credentials when
 * it has them; otherwise the shared environment credentials are used.
 */
export function getWhatsAppProvider(tenantCreds?: GreenApiCredentials): WhatsAppProvider {
  const provider = process.env['WHATSAPP_PROVIDER'] ?? 'green-api';
  if (provider === 'green-api') {
    return new GreenApiProvider(tenantCreds);
  }
  // Future: 'meta-cloud-api' → new MetaCloudApiProvider()
  throw new Error(`Unknown WHATSAPP_PROVIDER: ${provider}`);
}
