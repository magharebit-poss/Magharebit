import type { DbClient } from '../db/index';
import { checkTimeDrift } from './time-integrity';

export class AdjudicationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AdjudicationError';
  }
}

export interface SyncDeductionEntry {
  deductionId: string;
  ingredientId: string;
  lotId: string | null;
  lotIdSource: 'active' | 'none';
  deductionGrams: number;
  outputProductId: string;
  saleTransactionId: string;
  createdAt: string;
  yieldPctUsed: number;
  source: 'actual' | 'nominal';
  managerOverrideId: string | null;
  managerStaffId: string | null;
  overrideReason: string | null;
}

export interface SyncDeductionsRequest {
  registerId: string;
  tenantId: string;
  batchId: string;
  submittedAt: string;
  deductions: SyncDeductionEntry[];
}

export interface CorrectionEvent {
  deductionId: string;
  ingredientId: string;
  requestedGrams: number;
  approvedGrams: number;
  shortfallGrams: number;
  reason: string;
}

export interface NominalYieldFlag {
  deductionId: string;
  ingredientId: string;
  yieldPctUsed: number;
  lotId: string | null;
}

export interface SyncDeductionsResponse {
  batchId: string;
  processedAt: string;
  accepted: string[];
  correctionEvents: CorrectionEvent[];
  nominalYieldFlags: NominalYieldFlag[];
  rejectedBatch: { reason: string; code: string } | null;
}

export async function adjudicateDeductions(
  request: SyncDeductionsRequest,
  client: DbClient
): Promise<SyncDeductionsResponse> {
  const serverNow = new Date();

  // Step 1: Time integrity check (ADR-006)
  const driftResult = checkTimeDrift(request.submittedAt, serverNow);
  if (!driftResult.valid) {
    return {
      batchId: request.batchId,
      processedAt: serverNow.toISOString(),
      accepted: [],
      correctionEvents: [],
      nominalYieldFlags: [],
      rejectedBatch: {
        reason: `Time drift of ${driftResult.driftSeconds}s exceeds maximum 300s. Re-sync device clock.`,
        code: 'TIME_DRIFT_EXCEEDED',
      },
    };
  }

  // Step 2: Idempotency check
  const existingBatch = await client.query<{ response_json: SyncDeductionsResponse }>(
    'SELECT response_json FROM processed_batches WHERE batch_id = $1',
    [request.batchId]
  );
  if (existingBatch.rows.length > 0) {
    return existingBatch.rows[0].response_json;
  }

  // Step 3: Sort by deductionId (UUIDv7 ascending = chronological order)
  const sorted = [...request.deductions].sort((a, b) =>
    a.deductionId.localeCompare(b.deductionId)
  );

  // Step 4: Load backend stock with FOR UPDATE lock
  const ingredientIds = [...new Set(sorted.map((d) => d.ingredientId))];
  const stockResult = await client.query<{
    ingredient_id: string;
    quantity_remaining_grams: string;
  }>(
    `SELECT ingredient_id, quantity_remaining_grams
     FROM backend_stock
     WHERE ingredient_id = ANY($1::uuid[])
       AND tenant_id = $2
     FOR UPDATE`,
    [ingredientIds, request.tenantId]
  );

  const stockMap = new Map<string, number>();
  for (const row of stockResult.rows) {
    stockMap.set(row.ingredient_id, parseFloat(row.quantity_remaining_grams));
  }

  // Step 5: Process each deduction in sorted order
  const accepted: string[] = [];
  const correctionEvents: CorrectionEvent[] = [];
  const nominalYieldFlags: NominalYieldFlag[] = [];

  for (const deduction of sorted) {
    const available = stockMap.get(deduction.ingredientId) ?? 0;

    if (available >= deduction.deductionGrams) {
      // FULL ACCEPT — appears in accepted[] only
      stockMap.set(deduction.ingredientId, available - deduction.deductionGrams);
      accepted.push(deduction.deductionId);
    } else if (available > 0) {
      // PARTIAL — appears in correctionEvents[] only, NOT accepted[]
      const approved = available;
      stockMap.set(deduction.ingredientId, 0);
      correctionEvents.push({
        deductionId: deduction.deductionId,
        ingredientId: deduction.ingredientId,
        requestedGrams: deduction.deductionGrams,
        approvedGrams: approved,
        shortfallGrams: deduction.deductionGrams - approved,
        reason: 'partial-stock',
      });
    } else {
      // ZERO STOCK — appears in correctionEvents[] only
      correctionEvents.push({
        deductionId: deduction.deductionId,
        ingredientId: deduction.ingredientId,
        requestedGrams: deduction.deductionGrams,
        approvedGrams: 0,
        shortfallGrams: deduction.deductionGrams,
        reason: 'stock-exhausted',
      });
    }

    // Flag nominal yield regardless of stock outcome (Constraint C)
    if (deduction.source === 'nominal') {
      nominalYieldFlags.push({
        deductionId: deduction.deductionId,
        ingredientId: deduction.ingredientId,
        yieldPctUsed: deduction.yieldPctUsed,
        lotId: deduction.lotId,
      });
    }
  }

  // Assertion: every submitted ID must appear in exactly one output array
  const allProcessedIds = new Set([
    ...accepted,
    ...correctionEvents.map((e) => e.deductionId),
  ]);
  const submittedIds = new Set(sorted.map((d) => d.deductionId));

  for (const id of submittedIds) {
    if (!allProcessedIds.has(id)) {
      throw new AdjudicationError(
        `deductionId ${id} was neither accepted nor correction-evented`,
        'MISSING_DEDUCTION_IN_OUTPUT'
      );
    }
  }

  // Step 6 + 7: Commit stock decrements AND write processed_batches in SAME transaction
  const response: SyncDeductionsResponse = {
    batchId: request.batchId,
    processedAt: serverNow.toISOString(),
    accepted,
    correctionEvents,
    nominalYieldFlags,
    rejectedBatch: null,
  };

  // Update each ingredient's stock
  for (const ingredientId of ingredientIds) {
    const newStock = stockMap.get(ingredientId) ?? 0;
    await client.query(
      `UPDATE backend_stock
       SET quantity_remaining_grams = $1, last_updated_at = NOW()
       WHERE ingredient_id = $2 AND tenant_id = $3`,
      [newStock, ingredientId, request.tenantId]
    );
  }

  // Write idempotency record in the same transaction
  await client.query(
    `INSERT INTO processed_batches
       (batch_id, register_id, tenant_id, submitted_at, processed_at, response_json, deduction_count)
     VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, $6)`,
    [
      request.batchId,
      request.registerId,
      request.tenantId,
      request.submittedAt,
      JSON.stringify(response),
      sorted.length,
    ]
  );

  return response;
}
