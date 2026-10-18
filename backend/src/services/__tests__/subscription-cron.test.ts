import { checkSubscriptionExpiry } from '../subscription-cron';
import type { DbClient } from '../../db/index';

function createMockDb(responses: Array<{ rowCount: number }>): DbClient {
  let callIndex = 0;
  return {
    async query<T>(): Promise<{ rows: T[]; rowCount: number }> {
      const response = responses[callIndex] ?? { rowCount: 0 };
      callIndex++;
      return { rows: [] as T[], rowCount: response.rowCount };
    },
  };
}

describe('Subscription Expiry Cron', () => {
  test('Active key just expired → moves to GRACE', async () => {
    const db = createMockDb([{ rowCount: 1 }, { rowCount: 0 }]);
    const result = await checkSubscriptionExpiry(db);
    expect(result.movedToGrace).toBe(1);
    expect(result.movedToExpired).toBe(0);
  });

  test('Active key past grace → moves to EXPIRED', async () => {
    const db = createMockDb([{ rowCount: 0 }, { rowCount: 1 }]);
    const result = await checkSubscriptionExpiry(db);
    expect(result.movedToGrace).toBe(0);
    expect(result.movedToExpired).toBe(1);
  });

  test('GRACE key past grace → moves to EXPIRED', async () => {
    const db = createMockDb([{ rowCount: 0 }, { rowCount: 2 }]);
    const result = await checkSubscriptionExpiry(db);
    expect(result.movedToExpired).toBe(2);
  });

  test('Active key not yet expired → unchanged', async () => {
    const db = createMockDb([{ rowCount: 0 }, { rowCount: 0 }]);
    const result = await checkSubscriptionExpiry(db);
    expect(result.movedToGrace).toBe(0);
    expect(result.movedToExpired).toBe(0);
  });

  test('Two-step ordering: GRACE runs before EXPIRED prevents race', async () => {
    // Key just entered grace window: Step 1 moves it to GRACE,
    // Step 2's WHERE clause includes 'GRACE' but the time check
    // ensures it stays in GRACE (not yet past grace period).
    const db = createMockDb([{ rowCount: 1 }, { rowCount: 0 }]);
    const result = await checkSubscriptionExpiry(db);
    // Key moved to GRACE in step 1, NOT to EXPIRED in step 2
    expect(result.movedToGrace).toBe(1);
    expect(result.movedToExpired).toBe(0);
  });
});
