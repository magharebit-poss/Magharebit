import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { syncDeductionsRequestSchema, syncDeductionsResponseSchema } from './sync-schemas';
import { adjudicateDeductions, AdjudicationError } from '../../services/deduction-adjudicator';
import type { SyncDeductionsRequest } from '../../services/deduction-adjudicator';
import { withTenantSchema } from '../../db/index';
import { logSyncBatchResult } from '../../monitoring/sync-metrics';

export async function syncRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SyncDeductionsRequest }>(
    '/sync/deductions',
    {
      schema: {
        body: syncDeductionsRequestSchema,
        response: { 200: syncDeductionsResponseSchema },
      },
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
          keyGenerator: (request: FastifyRequest) => request.tenantId,
        },
      },
    },
    async (request: FastifyRequest<{ Body: SyncDeductionsRequest }>, reply: FastifyReply) => {
      const { body } = request;

      // Tenant isolation: JWT tenantId must match body tenantId
      if (request.tenantId !== body.tenantId) {
        return reply.status(403).send({
          error: 'Tenant ID mismatch between token and request body',
        });
      }

      // S4-002: Record start time for processingTimeMs metric
      const adjudicationStartMs = Date.now();

      try {
        const response = await withTenantSchema(body.tenantId, async (client) => {
          return adjudicateDeductions(body, client);
        });

        // S4-002: Log sync batch result with processing time
        const processingTimeMs = Date.now() - adjudicationStartMs;
        logSyncBatchResult({
          batchId: body.batchId,
          tenantId: body.tenantId,
          registerId: body.registerId,
          deductionCount: body.deductions?.length ?? 0,
          acceptedCount: response.accepted?.length ?? 0,
          correctionEventCount: response.correctionEvents?.length ?? 0,
          nominalYieldFlagCount: response.nominalYieldFlags?.length ?? 0,
          processingTimeMs,
        });

        return reply.status(200).send(response);
      } catch (error: unknown) {
        if (error instanceof AdjudicationError) {
          request.log.error({
            msg: 'Adjudication error',
            code: error.code,
            batchId: body.batchId,
          });
          return reply.status(500).send({
            error: 'Internal adjudication error',
            retryable: true,
          });
        }

        request.log.error({
          msg: 'Unexpected error in sync endpoint',
          error: error instanceof Error ? error.message : 'unknown',
          batchId: body.batchId,
        });
        return reply.status(500).send({
          error: 'Transaction commit failed',
          retryable: true,
        });
      }
    }
  );
}
