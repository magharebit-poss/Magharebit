import { GreenApiProvider } from './green-api.js';
import type { WhatsAppProvider } from './provider.js';

export function getWhatsAppProvider(): WhatsAppProvider {
  const provider = process.env['WHATSAPP_PROVIDER'] ?? 'green-api';
  if (provider === 'green-api') {
    return new GreenApiProvider();
  }
  // Future: 'meta-cloud-api' → new MetaCloudApiProvider()
  throw new Error(`Unknown WHATSAPP_PROVIDER: ${provider}`);
}
