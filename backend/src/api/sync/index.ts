import type { FastifyInstance } from 'fastify';
import { syncRoutes } from './sync-routes';

export async function syncPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(syncRoutes);
}
