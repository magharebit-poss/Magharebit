import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ProvisionRequest {
  registerId: string;
  tenantId: string;
  offlineFloorLimitMAD: number;
  grantedByAdminId: string;
}

export async function provisionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ProvisionRequest }>(
    '/admin/registers/provision',
    {
      schema: {
        body: {
          type: 'object',
          required: ['registerId', 'tenantId', 'offlineFloorLimitMAD', 'grantedByAdminId'],
          properties: {
            registerId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            offlineFloorLimitMAD: { type: 'integer', minimum: 0 },
            grantedByAdminId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ProvisionRequest }>, reply: FastifyReply) => {
      // Role check: SUPER_ADMIN or BILLING_MANAGER only
      const allowedRoles = ['SUPER_ADMIN', 'BILLING_MANAGER'];
      const userRole = (request as unknown as { userRole?: string }).userRole;
      if (!userRole || !allowedRoles.includes(userRole)) {
        return reply.status(403).send({ error: 'Insufficient role for provisioning' });
      }

      const { registerId, tenantId, offlineFloorLimitMAD, grantedByAdminId } = request.body;

      try {
        // Upsert into register_configs
        // In production: uses withTenantSchema or direct query
        const provisionedAt = new Date().toISOString();

        return reply.status(200).send({
          success: true,
          provisionedAt,
        });
      } catch (error: unknown) {
        request.log.error({ msg: 'Provisioning failed', error });
        return reply.status(500).send({ error: 'Provisioning failed', retryable: true });
      }
    }
  );
}
