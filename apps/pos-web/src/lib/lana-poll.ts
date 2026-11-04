// Lana QR polling rules. Pure logic (no React, no network) so the safety rules can be tested.
//
// The danger: once a QR code is on screen the customer may pay at any moment. If status checks start
// failing, "no answer" must never be read as "not paid" and must never lead to a second QR code.

/** Consecutive failed status checks before the screen stops saying "waiting" and says "cannot confirm". */
export const POLL_FAILURE_LIMIT = 3;

export type LanaScreen =
  | 'IDLE'
  | 'GENERATING'
  | 'QR_DISPLAY'
  | 'STATUS_UNKNOWN' // status checks keep failing: the customer may already have paid
  | 'PAID'
  | 'PAID_UNSAVED'
  | 'SUCCESS'
  | 'EXPIRED' // the SERVER said the session expired
  | 'ERROR';

export type PollReading = { ok: true; status: string } | { ok: false };
export type PollScreen = 'paid' | 'expired' | 'waiting' | 'unknown' | 'unchanged';
export interface PollStep {
  screen: PollScreen;
  failures: number;
}

/**
 * What one status check means. Only the server can say "expired". Failures never end the session:
 * from the third in a row the screen becomes 'unknown' and polling continues; one good answer that is
 * still pending brings the QR screen back.
 */
export function interpretPoll(failures: number, reading: PollReading): PollStep {
  if (!reading.ok) {
    const next = failures + 1;
    return { screen: next >= POLL_FAILURE_LIMIT ? 'unknown' : 'unchanged', failures: next };
  }
  if (reading.status === 'paid') return { screen: 'paid', failures: 0 };
  if (reading.status === 'expired') return { screen: 'expired', failures: 0 };
  return { screen: 'waiting', failures: 0 };
}

/**
 * A new QR code may be generated only when no earlier session could still be paid: before the first
 * one, after the server confirmed expiry, or after an initiate that never produced a QR. Never while a
 * QR was shown and its outcome is unknown.
 */
export function canGenerateNewQr(screen: LanaScreen, hasSession: boolean): boolean {
  switch (screen) {
    case 'IDLE':
    case 'EXPIRED':
      return true;
    case 'ERROR':
      return !hasSession;
    default:
      return false;
  }
}

// ── Cancelling while the payment status is unknown ───────────────────────────

export type CancelStep = 'none' | 'pin' | 'authorized' | 'closed';
export type CancelEvent = 'REQUEST' | 'AUTHORIZED' | 'CANCELLED' | 'DONE';

/**
 * The only way to leave with an unconfirmed payment: ask, manager PIN accepted, then acknowledge.
 * A stray DONE or AUTHORIZED without the PIN step changes nothing.
 */
export function reduceCancel(step: CancelStep, event: CancelEvent): CancelStep {
  switch (step) {
    case 'none':
      return event === 'REQUEST' ? 'pin' : step;
    case 'pin':
      if (event === 'AUTHORIZED') return 'authorized';
      if (event === 'CANCELLED') return 'none';
      return step;
    case 'authorized':
      return event === 'DONE' ? 'closed' : step;
    default:
      return step;
  }
}
