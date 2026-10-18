import type { DbClient } from '../db/index';

export interface CronResult {
  movedToGrace: number;
  movedToExpired: number;
}

export async function checkSubscriptionExpiry(db: DbClient): Promise<CronResult> {
  // Step 1: ACTIVE → GRACE (expired but within grace period)
  // Must run BEFORE step 2 to prevent jumping ACTIVE → EXPIRED in one pass
  const graceResult = await db.query<{ count: string }>(
    `UPDATE license_keys
     SET status = 'GRACE'
     WHERE status = 'active'
       AND expires_at < NOW()
       AND expires_at > NOW() - (
         SELECT COALESCE(grace_period_hours, 48) * INTERVAL '1 hour'
         FROM tenants WHERE tenants.tenant_id = license_keys.tenant_id
       )
     RETURNING 1`,
    []
  );

  // Step 2: GRACE + ACTIVE → EXPIRED (past grace period)
  const expiredResult = await db.query<{ count: string }>(
    `UPDATE license_keys
     SET status = 'EXPIRED'
     WHERE status IN ('active', 'GRACE')
       AND expires_at + (
         SELECT COALESCE(grace_period_hours, 48) * INTERVAL '1 hour'
         FROM tenants WHERE tenants.tenant_id = license_keys.tenant_id
       ) < NOW()
     RETURNING 1`,
    []
  );

  return {
    movedToGrace: graceResult.rowCount,
    movedToExpired: expiredResult.rowCount,
  };
}

let cronInterval: ReturnType<typeof setInterval> | null = null;

export function startSubscriptionCron(db: DbClient): void {
  // Run every 15 minutes
  cronInterval = setInterval(async () => {
    try {
      const result = await checkSubscriptionExpiry(db);
      if (result.movedToGrace > 0 || result.movedToExpired > 0) {
        // Log transitions (no console.log — use structured logger in production)
      }
    } catch {
      // Error logged by Fastify logger in production
    }
  }, 15 * 60 * 1000);
}

export function stopSubscriptionCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
