import type { DemandFeatures } from './feature-builder.js';

export interface HoltWintersResult {
  forecasts: number[];   // predicted values for each future step
  level: number;         // final level
  trend: number;         // final trend
  alpha: number;         // level smoothing parameter used
  beta: number;          // trend smoothing parameter used
  rmse: number;          // root mean squared error on training data
}

/**
 * Holt's double exponential smoothing (level + trend, no seasonality).
 * Phase 1 baseline — Phase 2 adds weekly seasonality when 90+ days of data exist.
 */
export function holtsDoubleSmoothing(
  series: number[],
  horizon: number,
  alpha: number = 0.3,
  beta: number = 0.1,
): HoltWintersResult {
  if (series.length === 0) {
    return { forecasts: Array(horizon).fill(0), level: 0, trend: 0, alpha, beta, rmse: 0 };
  }

  if (series.length === 1) {
    const val = series[0]!;
    return {
      forecasts: Array(horizon).fill(Math.max(0, val)),
      level: val,
      trend: 0,
      alpha,
      beta,
      rmse: 0,
    };
  }

  const n = series.length;

  // Initialize level and trend
  let level = series[0]!;
  // Mean of first differences (up to 4 steps) as initial trend estimate
  const diffCount = Math.min(n - 1, 4);
  let trend = 0;
  for (let i = 1; i <= diffCount; i++) {
    trend += (series[i]! - series[i - 1]!) / diffCount;
  }

  const levelHistory: number[] = [level];
  const trendHistory: number[] = [trend];
  const fitted: number[] = [];

  // Smoothing loop
  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    level = alpha * series[i]! + (1 - alpha) * (prevLevel + prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
    // Fitted value for position i uses the one-step-ahead forecast from i-1
    fitted.push(levelHistory[i - 1]! + trendHistory[i - 1]!);
    levelHistory.push(level);
    trendHistory.push(trend);
  }

  // RMSE on fitted values (indices 1..n-1)
  const squaredErrors = fitted.map((f, idx) => (series[idx + 1]! - f) ** 2);
  const rmse =
    squaredErrors.length > 0
      ? Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length)
      : 0;

  // Forecast h steps ahead from the final level/trend
  const forecasts: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecasts.push(Math.max(0, level + h * trend));
  }

  return { forecasts, level, trend, alpha, beta, rmse };
}

export function forecastProduct(
  features: DemandFeatures,
  horizons: number[] = [1, 3, 7],
): Array<{
  horizonDays: number;
  predictedUnits: number;
  lowerBound: number;
  upperBound: number;
  rmse: number;
  insufficientData: boolean;
}> {
  if (!features.hasEnoughData) {
    return horizons.map((h) => ({
      horizonDays: h,
      predictedUnits: 0,
      lowerBound: 0,
      upperBound: 0,
      rmse: 0,
      insufficientData: true,
    }));
  }

  const series = features.dailySales.map((d) => d.units);
  const maxHorizon = Math.max(...horizons);
  const result = holtsDoubleSmoothing(series, maxHorizon);

  return horizons.map((h) => {
    const predicted = result.forecasts[h - 1] ?? 0;
    const lower = Math.max(0, predicted - 1.28 * result.rmse);
    const upper = predicted + 1.28 * result.rmse;
    return {
      horizonDays: h,
      predictedUnits: predicted,
      lowerBound: lower,
      upperBound: upper,
      rmse: result.rmse,
      insufficientData: false,
    };
  });
}
