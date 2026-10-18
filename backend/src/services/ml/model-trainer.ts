import { randomUUID } from 'node:crypto';
import { queryChDockerExec, insertChRows } from './ch-exec.js';
import { buildDemandFeatures, buildWasteFeatures } from './feature-builder.js';
import { forecastProduct } from './holt-winters.js';
import { predictWasteRisk } from './waste-logistic.js';

export interface TrainOptions {
  tenantId?: string;
  dryRun?: boolean;
  productIds?: string[];
}

export async function trainModels(options: TrainOptions = {}): Promise<void> {
  const { dryRun = false, productIds: filterProductIds } = options;
  const today = new Date().toISOString().slice(0, 10);
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Resolve target tenants from ClickHouse — zero PostgreSQL queries
  let tenantIds: string[];
  if (options.tenantId) {
    tenantIds = [options.tenantId];
  } else {
    const rows = queryChDockerExec<{ tenant_id: string }>(
      'SELECT DISTINCT tenant_id FROM dim_products WHERE is_active = 1',
    );
    tenantIds = rows.map((r) => r.tenant_id);
  }

  for (const tenantId of tenantIds) {
    // ─── DEMAND FORECASTING ───────────────────────────────────────────────────

    const productFilterSql =
      filterProductIds && filterProductIds.length > 0
        ? `AND product_id IN (${filterProductIds.map((id) => `'${id.replace(/'/g, '')}'`).join(', ')})`
        : '';

    const products = queryChDockerExec<{ product_id: string }>(
      `SELECT product_id
       FROM dim_products
       WHERE tenant_id = {tenantId: String}
         AND is_active = 1
         ${productFilterSql}`,
      { tenantId },
    );

    let demandTrained = 0;
    let demandSkipped = 0;
    const demandStart = Date.now();
    const demandRows: Record<string, unknown>[] = [];

    for (const { product_id: productId } of products) {
      try {
        const features = await buildDemandFeatures(tenantId, productId);
        const forecasts = forecastProduct(features);

        for (const f of forecasts) {
          const forecastDate = new Date();
          forecastDate.setUTCDate(forecastDate.getUTCDate() + f.horizonDays);
          const forecastDateStr = forecastDate.toISOString().slice(0, 10);

          demandRows.push({
            forecast_id: `${tenantId}__${productId}__${forecastDateStr}__${f.horizonDays}`,
            tenant_id: tenantId,
            product_id: productId,
            store_id: null,
            forecast_date: forecastDateStr,
            trained_on: today,
            horizon_days: f.horizonDays,
            predicted_units: f.predictedUnits,
            lower_bound: f.lowerBound,
            upper_bound: f.upperBound,
            model_version: '1.0',
            data_points: features.dataPoints,
            insufficient_data: f.insufficientData ? 1 : 0,
            created_at: nowStr,
          });
        }

        if (features.hasEnoughData) {
          demandTrained++;
        } else {
          demandSkipped++;
        }
      } catch (err) {
        demandSkipped++;
        console.error(
          `[ml-trainer] demand error (tenant=${tenantId} product=${productId}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (!dryRun && demandRows.length > 0) {
      insertChRows('ml_demand_forecasts', demandRows);
    }

    const demandLog: Record<string, unknown> = {
      run_id: randomUUID(),
      tenant_id: tenantId,
      model_name: 'demand_forecast',
      trained_at: nowStr,
      products_trained: demandTrained,
      products_skipped: demandSkipped,
      duration_ms: Date.now() - demandStart,
      error: null,
    };
    if (!dryRun) insertChRows('ml_training_log', [demandLog]);
    console.log(
      `[ml-trainer] demand: tenant=${tenantId} trained=${demandTrained} skipped=${demandSkipped} rows=${demandRows.length} dryRun=${dryRun}`,
    );

    // ─── WASTE RISK ───────────────────────────────────────────────────────────

    const lots = queryChDockerExec<{ lot_id: string }>(
      `SELECT lot_id
       FROM dim_lots
       WHERE tenant_id = {tenantId: String}
         AND is_active = 1`,
      { tenantId },
    );

    let wasteTrained = 0;
    let wasteSkipped = 0;
    const wasteStart = Date.now();
    const wasteRows: Record<string, unknown>[] = [];

    for (const { lot_id: lotId } of lots) {
      try {
        const features = await buildWasteFeatures(tenantId, lotId);
        if (features === null) {
          wasteSkipped++;
          continue;
        }

        const prediction = predictWasteRisk(features);

        wasteRows.push({
          risk_id: `${tenantId}__${lotId}__${today}`,
          tenant_id: tenantId,
          product_id: features.productId,
          lot_id: lotId,
          trained_on: today,
          lot_age_days: features.lotAgeDays,
          current_stock: features.currentStockUnits,
          sales_velocity_7d: features.salesVelocity7d,
          current_markdown_pct: features.currentMarkdownPct,
          waste_rate_30d: features.wasteRate30d,
          waste_probability: prediction.probability,
          risk_level: prediction.riskLevel,
          recommended_markdown_pct: prediction.recommendedMarkdownPct,
          days_until_waste: prediction.daysUntilWaste,
          insufficient_data: features.hasEnoughData ? 0 : 1,
          created_at: nowStr,
        });

        wasteTrained++;
      } catch (err) {
        wasteSkipped++;
        console.error(
          `[ml-trainer] waste error (tenant=${tenantId} lot=${lotId}):`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    if (!dryRun && wasteRows.length > 0) {
      insertChRows('ml_waste_risk', wasteRows);
    }

    const wasteLog: Record<string, unknown> = {
      run_id: randomUUID(),
      tenant_id: tenantId,
      model_name: 'waste_risk',
      trained_at: nowStr,
      products_trained: wasteTrained,
      products_skipped: wasteSkipped,
      duration_ms: Date.now() - wasteStart,
      error: null,
    };
    if (!dryRun) insertChRows('ml_training_log', [wasteLog]);
    console.log(
      `[ml-trainer] waste: tenant=${tenantId} trained=${wasteTrained} skipped=${wasteSkipped} rows=${wasteRows.length} dryRun=${dryRun}`,
    );
  }
}
