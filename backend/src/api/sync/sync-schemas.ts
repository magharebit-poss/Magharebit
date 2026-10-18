export const syncDeductionsRequestSchema = {
  type: 'object',
  required: ['registerId', 'tenantId', 'batchId', 'submittedAt', 'deductions'],
  properties: {
    registerId: { type: 'string', format: 'uuid' },
    tenantId: { type: 'string', format: 'uuid' },
    batchId: { type: 'string', format: 'uuid' },
    submittedAt: { type: 'string', format: 'date-time' },
    lastKnownProvisionedAt: { type: ['string', 'null'], format: 'date-time' },
    deductions: {
      type: 'array',
      minItems: 1,
      maxItems: 500,
      items: {
        type: 'object',
        required: [
          'deductionId', 'ingredientId', 'lotIdSource', 'deductionGrams',
          'outputProductId', 'saleTransactionId', 'createdAt',
          'yieldPctUsed', 'source',
        ],
        properties: {
          deductionId: { type: 'string', format: 'uuid' },
          ingredientId: { type: 'string', format: 'uuid' },
          lotId: { type: ['string', 'null'], format: 'uuid' },
          lotIdSource: { type: 'string', enum: ['active', 'none'] },
          deductionGrams: { type: 'number', minimum: 0.01 },
          outputProductId: { type: 'string', format: 'uuid' },
          saleTransactionId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          yieldPctUsed: { type: 'number', minimum: 0, maximum: 1 },
          source: { type: 'string', enum: ['actual', 'nominal'] },
          managerOverrideId: { type: ['string', 'null'] },
          managerStaffId: { type: ['string', 'null'] },
          overrideReason: { type: ['string', 'null'] },
        },
      },
    },
    floorExceededEvents: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        required: ['eventId', 'registerId', 'shiftId', 'transactionRef', 'attemptedAmountCents', 'floorLimitCents', 'occurredAt'],
        properties: {
          eventId: { type: 'string', format: 'uuid' },
          registerId: { type: 'string', format: 'uuid' },
          shiftId: { type: 'string', format: 'uuid' },
          transactionRef: { type: 'string' },
          attemptedAmountCents: { type: 'integer', minimum: 0 },
          floorLimitCents: { type: 'integer', minimum: 0 },
          occurredAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;

export const syncDeductionsResponseSchema = {
  type: 'object',
  properties: {
    batchId: { type: 'string' },
    processedAt: { type: 'string' },
    accepted: { type: 'array', items: { type: 'string' } },
    correctionEvents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          deductionId: { type: 'string' },
          ingredientId: { type: 'string' },
          requestedGrams: { type: 'number' },
          approvedGrams: { type: 'number' },
          shortfallGrams: { type: 'number' },
          reason: { type: 'string' },
        },
      },
    },
    nominalYieldFlags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          deductionId: { type: 'string' },
          ingredientId: { type: 'string' },
          yieldPctUsed: { type: 'number' },
          lotId: { type: ['string', 'null'] },
        },
      },
    },
    rejectedBatch: {
      type: ['object', 'null'],
      properties: {
        reason: { type: 'string' },
        code: { type: 'string' },
      },
    },
    configUpdate: {
      type: 'object',
      nullable: true,
      properties: {
        offlineFloorLimitMAD: { type: 'integer', minimum: 0 },
        provisionedAt: { type: 'string', format: 'date-time' },
      },
      required: ['offlineFloorLimitMAD', 'provisionedAt'],
    },
  },
} as const;
