import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createLogger } from '../../monitoring/logger';

const log = createLogger({ service: 'demo-routes' });

interface DemoRequestBody {
  companyName: string;
  country: string;
  storeCount: number;
  email: string;
  phone?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function demoRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /marketing/demo-request
   * Validates and stores demo requests. Rate limited: 5/hour per IP.
   * No email sending in MVP.
   */
  fastify.post<{ Body: DemoRequestBody }>(
    '/marketing/demo-request',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (request: FastifyRequest<{ Body: DemoRequestBody }>, reply) => {
      const { companyName, country, storeCount, email, phone } = request.body;

      // Validate required fields
      if (!companyName?.trim()) {
        return reply.status(400).send({ error: 'اسم الشركة مطلوب' });
      }
      if (!isValidEmail(email)) {
        return reply.status(400).send({ error: 'البريد الإلكتروني غير صحيح' });
      }
      if (!storeCount || storeCount < 1) {
        return reply.status(400).send({ error: 'عدد المتاجر يجب أن يكون 1 على الأقل' });
      }

      try {
        await fastify.pg.query(
          `INSERT INTO demo_requests
             (id, company_name, country, store_count, email, phone, submitted_at)
           VALUES
             (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
          [companyName.trim(), country ?? 'المغرب', storeCount, email.trim(), phone?.trim() ?? null],
        );

        log.info({ country, storeCount }, 'demo request received');
        return reply.status(200).send({ success: true });
      } catch (err: unknown) {
        log.error({ err: err instanceof Error ? err : undefined }, 'demo request insert failed');
        return reply.status(500).send({ error: 'خطأ داخلي في الخادم' });
      }
    },
  );
}
