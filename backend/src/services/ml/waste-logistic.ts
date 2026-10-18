import type { WasteFeatures } from './feature-builder.js';

export interface LogisticCoefficients {
  intercept: number;
  lotAgeDays: number;
  stockToVelocityRatio: number;
    // current_stock / (sales_velocity + 0.01)
  currentMarkdownPct: number;
    // negative coefficient — markdown reduces risk
  wasteRate30d: number;
    // historical waste rate for this product
  daysUntilExpected: number;
    // lot_age / expected_shelf_life (7-day default)
}

// Phase 1 heuristic-calibrated defaults — updated by weekly training
export const DEFAULT_COEFFICIENTS: LogisticCoefficients = {
  intercept: -2.0,
  lotAgeDays: 0.15,
  stockToVelocityRatio: 0.08,
  currentMarkdownPct: -0.04,
  wasteRate30d: 2.5,
  daysUntilExpected: 1.2,
};

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function predictWasteRisk(
  features: WasteFeatures,
  coefficients: LogisticCoefficients = DEFAULT_COEFFICIENTS,
): {
  probability: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedMarkdownPct: number | null;
  daysUntilWaste: number | null;
} {
  if (!features.hasEnoughData) {
    return { probability: 0, riskLevel: 'low', recommendedMarkdownPct: null, daysUntilWaste: null };
  }

  const stockToVelocityRatio = features.currentStockUnits / (features.salesVelocity7d + 0.01);
  const daysUntilExpected = features.lotAgeDays / 7.0;
  const daysUntilWaste =
    features.salesVelocity7d > 0
      ? features.currentStockUnits / features.salesVelocity7d
      : null;

  const z =
    coefficients.intercept +
    coefficients.lotAgeDays * features.lotAgeDays +
    coefficients.stockToVelocityRatio * stockToVelocityRatio +
    coefficients.currentMarkdownPct * features.currentMarkdownPct +
    coefficients.wasteRate30d * features.wasteRate30d +
    coefficients.daysUntilExpected * daysUntilExpected;

  const probability = sigmoid(z);

  const riskLevel: 'low' | 'medium' | 'high' =
    probability < 0.3 ? 'low' : probability <= 0.6 ? 'medium' : 'high';

  let recommendedMarkdownPct: number | null = null;
  if (riskLevel === 'medium' || riskLevel === 'high') {
    // Step through markdowns 5-80% until probability drops below 0.3
    for (let pct = 5; pct <= 80; pct += 5) {
      const zWithMarkdown =
        coefficients.intercept +
        coefficients.lotAgeDays * features.lotAgeDays +
        coefficients.stockToVelocityRatio * stockToVelocityRatio +
        coefficients.currentMarkdownPct * pct +
        coefficients.wasteRate30d * features.wasteRate30d +
        coefficients.daysUntilExpected * daysUntilExpected;
      if (sigmoid(zWithMarkdown) < 0.3) {
        recommendedMarkdownPct = pct;
        break;
      }
    }
  }

  return { probability, riskLevel, recommendedMarkdownPct, daysUntilWaste };
}

/**
 * Online gradient descent update for logistic regression coefficients.
 * Improves coefficients as real waste outcomes accumulate.
 */
export function updateCoefficients(
  trainingData: Array<{ features: WasteFeatures; actualWasted: boolean }>,
  currentCoefficients: LogisticCoefficients,
  learningRate: number = 0.01,
  epochs: number = 100,
): LogisticCoefficients {
  const coef = { ...currentCoefficients };

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const { features, actualWasted } of trainingData) {
      const { probability } = predictWasteRisk(features, coef);
      const error = (actualWasted ? 1 : 0) - probability;

      const stockToVelocityRatio = features.currentStockUnits / (features.salesVelocity7d + 0.01);
      const daysUntilExpected = features.lotAgeDays / 7.0;

      coef.intercept += learningRate * error;
      coef.lotAgeDays += learningRate * error * features.lotAgeDays;
      coef.stockToVelocityRatio += learningRate * error * stockToVelocityRatio;
      coef.currentMarkdownPct += learningRate * error * features.currentMarkdownPct;
      coef.wasteRate30d += learningRate * error * features.wasteRate30d;
      coef.daysUntilExpected += learningRate * error * daysUntilExpected;
    }
  }

  return coef;
}
