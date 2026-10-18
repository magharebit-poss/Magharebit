import type { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    pg: Pool;
    // Runtime license state. Flipped to false by background revalidation when a
    // previously-valid license becomes invalid (blocks new sales via 402 hook).
    licenseValid: boolean;
  }
}
