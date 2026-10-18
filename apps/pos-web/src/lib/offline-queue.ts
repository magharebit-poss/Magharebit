// offline-queue.ts — Tauri local SQLite queue bridge for offline transaction capture.
// Browser callers get safe no-op stubs; only the Tauri desktop shell exercises
// the real invoke() paths.

import { invoke } from '@tauri-apps/api/core';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Online/offline detection
// Uses a lightweight ping to the backend /health endpoint.
// navigator.onLine alone is unreliable (true even when the backend
// is down but LAN is up).
export async function isBackendReachable(backendUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 s timeout
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Queue a transaction locally (Tauri only).
export async function queueTransactionLocally(
  localId: string,
  tenantId: string,
  shiftId: string,
  payload: object,
  tokenSnapshot: string,
): Promise<void> {
  if (!isTauri()) {
    // Browser dev mode: log and no-op
    console.warn('[offline-queue] Not in Tauri — cannot queue locally.', localId);
    return;
  }
  return invoke('queue_transaction', {
    localId,
    tenantId,
    shiftId,
    payloadJson: JSON.stringify(payload),
    tokenSnapshot,
  });
}

export async function getPendingCount(tenantId: string): Promise<number> {
  if (!isTauri()) return 0;
  return invoke('get_pending_count', { tenantId });
}

export async function getPendingTransactions(
  tenantId: string,
  limit: number = 50,
): Promise<PendingTransaction[]> {
  if (!isTauri()) return [];
  return invoke('get_pending_transactions', { tenantId, limit });
}

export async function markTransactionSynced(
  localId: string,
  serverResponse: string,
): Promise<void> {
  if (!isTauri()) return;
  return invoke('mark_transaction_synced', { localId, serverResponse });
}

export async function markTransactionFailed(
  localId: string,
  error: string,
): Promise<void> {
  if (!isTauri()) return;
  return invoke('mark_transaction_failed', { localId, error });
}

export interface PendingTransaction {
  local_id: string;
  tenant_id: string;
  shift_id: string;
  payload_json: string;
  token_snapshot: string | null;
  created_at: number;
  retry_count: number;
  last_error: string | null;
}
