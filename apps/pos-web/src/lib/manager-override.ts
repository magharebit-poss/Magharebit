// The manager-PIN call behind ManagerPinModal. It goes through apiFetch so it reaches the backend
// directly inside Tauri/Android (a relative /api URL does not exist there) and through the Next proxy
// in the browser, with the shift token attached either way.

import { apiFetch } from './api';

export interface ManagerOverrideResult {
  authorized: true;
  manager_id: string;
  action: string;
}

export type OverrideAttempt =
  | { ok: true; result: ManagerOverrideResult }
  /** `message` is the server's own text when it sent one; null means "use the generic invalid-PIN text". */
  | { ok: false; message: string | null };

type Send = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Ask the backend to authorise a restricted action with a manager PIN. The server records the override
 * (action, reference, note) in its audit table. A network failure or an unreadable reply rejects, so the
 * caller can show its "connection" error, exactly as before.
 */
export async function requestManagerOverride(
  input: { pin: string; action: string; referenceId?: string; note?: string },
  send: Send = apiFetch,
): Promise<OverrideAttempt> {
  const res = await send('/api/auth/manager-override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerPin: input.pin,
      action: input.action,
      referenceId: input.referenceId,
      note: input.note,
    }),
  });
  const data = (await res.json()) as unknown;
  const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  if (!res.ok || !('authorized' in obj)) {
    return { ok: false, message: typeof obj['message'] === 'string' ? obj['message'] : null };
  }
  return { ok: true, result: obj as unknown as ManagerOverrideResult };
}
