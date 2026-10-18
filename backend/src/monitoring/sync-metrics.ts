/**
 * S4-002 — Structured log events for Production Stability metrics.
 *
 * These log calls feed Grafana/Loki dashboard queries for:
 *   - Sync success rate (logSyncBatchResult)
 *   - Floor exceeded frequency (logFloorExceeded)
 *   - License status transitions (logLicenseStatusChange)
 *   - Hardware error frequency (logHardwareError)
 *
 * PII rules:
 *   - logSyncBatchResult: logs counts only — NOT raw deductions or transactionRefs
 *   - logFloorExceeded: logs attemptedAmountCents only — NOT transactionRef
 *     (amount alone cannot link to a cardholder; combined with ref it could)
 */

import { createLogger } from './logger';

const metricsLogger = createLogger({ service: 'sync-metrics' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncBatchMetric {
  batchId: string;
  tenantId: string;
  registerId: string;
  deductionCount: number;
  acceptedCount: number;
  correctionEventCount: number;
  nominalYieldFlagCount: number;
  processingTimeMs: number;
}

export interface FloorMetric {
  registerId: string;
  tenantId: string;
  attemptedAmountCents: number;
  floorLimitCents: number;
}

// ---------------------------------------------------------------------------
// Metric log functions
// ---------------------------------------------------------------------------

/**
 * Logs sync batch outcome. Does NOT log raw deduction payloads.
 * processingTimeMs is the primary metric for sync performance monitoring.
 */
export function logSyncBatchResult(result: SyncBatchMetric): void {
  metricsLogger.info({
    event: 'sync_batch_result',
    batchId: result.batchId,
    tenantId: result.tenantId,
    registerId: result.registerId,
    deductionCount: result.deductionCount,
    acceptedCount: result.acceptedCount,
    correctionEventCount: result.correctionEventCount,
    nominalYieldFlagCount: result.nominalYieldFlagCount,
    processingTimeMs: result.processingTimeMs,
    // NOT logged: raw deductions array, transactionRefs, product details
  });
}

/**
 * Logs a floor-exceeded event.
 * Logs attempted amount and floor limit (both safe metrics).
 * Does NOT log transactionRef to prevent cardholder linkage.
 */
export function logFloorExceeded(event: FloorMetric): void {
  metricsLogger.warn({
    event: 'floor_exceeded',
    registerId: event.registerId,
    tenantId: event.tenantId,
    attemptedAmountCents: event.attemptedAmountCents,
    floorLimitCents: event.floorLimitCents,
    // NOT logged: transactionRef, cmiTokenRef, cashierName
  });
}

/**
 * Logs license status transitions for the Super-Admin health dashboard.
 */
export function logLicenseStatusChange(
  from: string,
  to: string,
  registerId: string,
  tenantId: string,
): void {
  metricsLogger.warn({
    event: 'license_status_change',
    from,
    to,
    registerId,
    tenantId,
  });
}

/**
 * Logs hardware errors for the register monitor dashboard.
 */
export function logHardwareError(
  device: string,
  code: string,
  registerId: string,
  tenantId: string,
): void {
  metricsLogger.error({
    event: 'hardware_error',
    device,
    code,
    registerId,
    tenantId,
  });
}
