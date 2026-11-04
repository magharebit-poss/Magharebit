// sync-drain.ts — Background drain that replays queued offline transactions
// once the backend is reachable. Runs every 30 s inside the Tauri desktop shell.

import {
  isTauri,
  isBackendReachable,
  getPendingTransactions,
  getPendingCount,
  markTransactionSynced,
  markTransactionFailed,
  markTransactionRejected,
} from './offline-queue';
import { classifySaleStatus } from './sale-identity';

const DRAIN_INTERVAL_MS = 30_000;
const MAX_RETRY_COUNT = 5;

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';

let drainHandle: ReturnType<typeof setInterval> | null = null;

/** Start the 30 s drain loop. Idempotent — safe to call multiple times. */
export function startSyncDrain(
  tenantId: string,
  backendUrl: string,
  onQueueChange: (count: number) => void,
): void {
  if (drainHandle) return; // already running
  drainHandle = setInterval(() => {
    void drainOnce(tenantId, backendUrl, onQueueChange);
  }, DRAIN_INTERVAL_MS);
}

/** Stop the drain loop (call on POS page unmount). */
export function stopSyncDrain(): void {
  if (drainHandle) {
    clearInterval(drainHandle);
    drainHandle = null;
  }
}

export async function drainOnce(
  tenantId: string,
  backendUrl: string,
  onQueueChange: (count: number) => void,
): Promise<void> {
  const reachable = await isBackendReachable(backendUrl);
  if (!reachable) return;

  const pending = await getPendingTransactions(tenantId, 50);
  if (pending.length === 0) return;

  // Resolve endpoint: Tauri calls backend directly, browser goes through Next proxy.
  const transactionsUrl = isTauri()
    ? `${BACKEND_URL}/transactions`
    : '/api/transactions';

  for (const tx of pending) {
    if (tx.retry_count >= MAX_RETRY_COUNT) continue;

    if (!tx.token_snapshot) {
      console.warn('[sync-drain] Skipping tx with no token snapshot', tx.local_id);
      continue;
    }

    try {
      const payload = JSON.parse(tx.payload_json) as unknown;
      const res = await fetch(transactionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tx.token_snapshot}`,
        },
        body: JSON.stringify(payload),
      });
      const verdict = classifySaleStatus(res.status);
      if (verdict === 'ok') {
        // 200 with replayed:true (the sale already reached the server) is a success like any other.
        const data = (await res.json().catch(() => ({}))) as unknown;
        await markTransactionSynced(tx.local_id, JSON.stringify(data));
      } else if (verdict === 'conflict' || verdict === 'invalid') {
        // 409 (the id belongs to a different sale) or 400 (the server will never accept this body):
        // a retry cannot change the answer. Reject it: the row stays for a manager, out of the drain
        // and the badge, and is never deleted automatically.
        await markTransactionRejected(
          tx.local_id,
          verdict === 'conflict' ? 'client_tx_id_conflict' : 'invalid_sale',
        );
      } else {
        const err = await res.text().catch(() => `HTTP ${res.status}`);
        await markTransactionFailed(tx.local_id, err);
      }
    } catch (e) {
      await markTransactionFailed(
        tx.local_id,
        e instanceof Error ? e.message : 'unknown',
      );
    }
  }

  const remaining = await getPendingCount(tenantId);
  onQueueChange(remaining);
}
