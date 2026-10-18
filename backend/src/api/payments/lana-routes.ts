import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateUUIDv7 } from '../../utils/uuid-v7';

// Roles permitted to initiate and poll Lana payments (any active cashier).
const STAFF_ROLES = ['CASHIER', 'MANAGER', 'SUPERVISOR'] as const;

interface InitiateRequest {
  amount: number;
  transactionRef: string;
  registerId: string;
}

interface StatusParams {
  sessionId: string;
}

// In-memory mock store (production: PostgreSQL lana_sessions table)
const mockSessions = new Map<string, { status: string; amount: number; transactionRef: string; expiresAt: Date }>();

export async function lanaRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: InitiateRequest }>(
    '/payments/lana/initiate',
    {
      config: { allowedRoles: [...STAFF_ROLES] },
      schema: {
        body: {
          type: 'object',
          required: ['amount', 'transactionRef', 'registerId'],
          properties: {
            amount: { type: 'integer', minimum: 1 },
            transactionRef: { type: 'string' },
            registerId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: InitiateRequest }>, reply: FastifyReply) => {
      const { amount, transactionRef, registerId } = request.body;

      const sessionId = generateUUIDv7();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      // Mock Lana Cash API call — real SDK not yet available
      const qrCodeData = `LANA:${sessionId}:${amount}:MAD`;

      mockSessions.set(sessionId, {
        status: 'pending',
        amount,
        transactionRef,
        expiresAt,
      });

      return reply.status(200).send({
        qrCodeData,
        sessionId,
        expiresAt: expiresAt.toISOString(),
      });
    }
  );

  fastify.get<{ Params: StatusParams }>(
    '/payments/lana/status/:sessionId',
    { config: { allowedRoles: [...STAFF_ROLES] } },
    async (request: FastifyRequest<{ Params: StatusParams }>, reply: FastifyReply) => {
      const { sessionId } = request.params;
      const session = mockSessions.get(sessionId);

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Check expiry
      if (session.status === 'pending' && new Date() > session.expiresAt) {
        session.status = 'expired';
      }

      return reply.status(200).send({ status: session.status });
    }
  );
}

// Exported for webhook handler to update session status
export function markSessionPaid(sessionId: string): boolean {
  const session = mockSessions.get(sessionId);
  if (!session || session.status !== 'pending') return false;
  session.status = 'paid';
  return true;
}
