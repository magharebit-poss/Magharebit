export type TimeDriftResult =
  | { valid: true }
  | { valid: false; driftSeconds: number };

const MAX_DRIFT_SECONDS = 300;

/**
 * Validates time drift between client-submitted timestamp and server clock.
 * ADR-006: if drift exceeds 5 minutes (300s), the batch is rejected.
 *
 * Pure function — no side effects, independently testable.
 */
export function checkTimeDrift(
  submittedAt: string,
  serverNow: Date
): TimeDriftResult {
  const clientTime = new Date(submittedAt).getTime();

  if (isNaN(clientTime)) {
    return { valid: false, driftSeconds: Infinity };
  }

  const driftMs = Math.abs(serverNow.getTime() - clientTime);
  const driftSeconds = Math.round(driftMs / 1000);

  if (driftSeconds > MAX_DRIFT_SECONDS) {
    return { valid: false, driftSeconds };
  }

  return { valid: true };
}
