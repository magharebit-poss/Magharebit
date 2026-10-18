import type { FastifyInstance } from 'fastify';
import { getClickHouseClient } from '../../services/analytics/clickhouse-client.js';
import { trainModels } from '../../services/ml/model-trainer.js';

const ML_ROLES = ['MANAGER', 'SUPERVISOR'] as const;

export async function mlRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /ml/demand-forecast/:productId ───────────────────────────────────────
  // Returns the latest demand forecast for a product (all horizons).
  fastify.get<{ Params: { productId: string }; Querystring: { storeId?: string; horizon?: string } }>(
    '/ml/demand-forecast/:productId',
    { config: { allowedRoles: ML_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { productId } = request.params;
      const client = getClickHouseClient();

      try {
        // Latest trained_on for this product
        const latestResult = await client.query({
          query: `
            SELECT max(trained_on) AS latest_trained_on
            FROM magharebit_analytics.ml_demand_forecasts
            WHERE tenant_id = {tenantId: String}
              AND product_id = {productId: String}
          `,
          query_params: { tenantId, productId },
          format: 'JSONEachRow',
        });
        const latestRows = await latestResult.json<{ latest_trained_on: string | null }>();
        const latestTrainedOn = latestRows[0]?.latest_trained_on;
        if (!latestTrainedOn) {
          return reply.status(404).send({ error: 'No forecast found for this product' });
        }

        const result = await client.query({
          query: `
            SELECT
              horizon_days,
              predicted_units,
              lower_bound,
              upper_bound,
              insufficient_data,
              data_points
            FROM magharebit_analytics.ml_demand_forecasts
            WHERE tenant_id = {tenantId: String}
              AND product_id = {productId: String}
              AND trained_on = {trainedOn: String}
            ORDER BY horizon_days ASC
          `,
          query_params: { tenantId, productId, trainedOn: latestTrainedOn },
          format: 'JSONEachRow',
        });

        type ForecastRow = {
          horizon_days: number | string;
          predicted_units: number | string;
          lower_bound: number | string;
          upper_bound: number | string;
          insufficient_data: number | string;
          data_points: number | string;
        };

        const rows = await result.json<ForecastRow>();
        const forecasts = rows.map((r) => ({
          horizonDays: Number(r.horizon_days),
          predictedUnits: Number(r.predicted_units),
          lowerBound: Number(r.lower_bound),
          upperBound: Number(r.upper_bound),
          insufficientData: Number(r.insufficient_data) === 1,
        }));

        // suggestedReorderQty: 7-day prediction rounded up, 0 if insufficient data
        const sevenDay = forecasts.find((f) => f.horizonDays === 7);
        const suggestedReorderQty = sevenDay && !sevenDay.insufficientData
          ? Math.ceil(sevenDay.predictedUnits)
          : 0;

        return reply.send({
          productId,
          forecasts,
          trainedOn: latestTrainedOn,
          suggestedReorderQty,
        });
      } catch (err) {
        request.log.error({ err }, 'ml/demand-forecast: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /ml/waste-risk/:lotId ─────────────────────────────────────────────────
  // Returns the latest waste risk score for a lot.
  fastify.get<{ Params: { lotId: string } }>(
    '/ml/waste-risk/:lotId',
    { config: { allowedRoles: ML_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { lotId } = request.params;
      const client = getClickHouseClient();

      try {
        const result = await client.query({
          query: `
            SELECT
              lot_id,
              product_id,
              risk_level,
              waste_probability,
              recommended_markdown_pct,
              days_until_waste,
              insufficient_data,
              trained_on
            FROM magharebit_analytics.ml_waste_risk
            WHERE tenant_id = {tenantId: String}
              AND lot_id = {lotId: String}
            ORDER BY trained_on DESC
            LIMIT 1
          `,
          query_params: { tenantId, lotId },
          format: 'JSONEachRow',
        });

        type RiskRow = {
          lot_id: string;
          product_id: string;
          risk_level: string;
          waste_probability: number | string;
          recommended_markdown_pct: number | string | null;
          days_until_waste: number | string | null;
          insufficient_data: number | string;
          trained_on: string;
        };

        const rows = await result.json<RiskRow>();
        if (rows.length === 0) {
          return reply.status(404).send({ error: 'No risk score found for this lot' });
        }
        const r = rows[0]!;

        return reply.send({
          lotId: r.lot_id,
          productId: r.product_id,
          riskLevel: r.risk_level,
          wasteProbability: Number(r.waste_probability),
          recommendedMarkdownPct:
            r.recommended_markdown_pct != null ? Number(r.recommended_markdown_pct) : null,
          daysUntilWaste: r.days_until_waste != null ? Number(r.days_until_waste) : null,
          insufficientData: Number(r.insufficient_data) === 1,
          trainedOn: r.trained_on,
        });
      } catch (err) {
        request.log.error({ err }, 'ml/waste-risk: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /ml/waste-risk/by-product/:productId ─────────────────────────────────
  // Returns the latest waste risk score for a product (across all its lots).
  // Used by the POS low-stock panel where only product_id is known.
  fastify.get<{ Params: { productId: string } }>(
    '/ml/waste-risk/by-product/:productId',
    { config: { allowedRoles: ML_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { productId } = request.params;
      const client = getClickHouseClient();

      try {
        const result = await client.query({
          query: `
            SELECT
              lot_id,
              product_id,
              risk_level,
              waste_probability,
              recommended_markdown_pct,
              days_until_waste,
              insufficient_data,
              trained_on
            FROM magharebit_analytics.ml_waste_risk
            WHERE tenant_id = {tenantId: String}
              AND product_id = {productId: String}
            ORDER BY trained_on DESC
            LIMIT 1
          `,
          query_params: { tenantId, productId },
          format: 'JSONEachRow',
        });

        type RiskRow = {
          lot_id: string;
          product_id: string;
          risk_level: string;
          waste_probability: number | string;
          recommended_markdown_pct: number | string | null;
          days_until_waste: number | string | null;
          insufficient_data: number | string;
          trained_on: string;
        };

        const rows = await result.json<RiskRow>();
        if (rows.length === 0) {
          return reply.status(404).send({ error: 'No risk score found for this product' });
        }
        const r = rows[0]!;

        return reply.send({
          lotId: r.lot_id,
          productId: r.product_id,
          riskLevel: r.risk_level,
          wasteProbability: Number(r.waste_probability),
          recommendedMarkdownPct:
            r.recommended_markdown_pct != null ? Number(r.recommended_markdown_pct) : null,
          daysUntilWaste: r.days_until_waste != null ? Number(r.days_until_waste) : null,
          insufficientData: Number(r.insufficient_data) === 1,
          trainedOn: r.trained_on,
        });
      } catch (err) {
        request.log.error({ err }, 'ml/waste-risk/by-product: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /ml/reorder-suggestions ──────────────────────────────────────────────
  // Returns top products predicted to run low within 7 days.
  fastify.get(
    '/ml/reorder-suggestions',
    { config: { allowedRoles: ML_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const client = getClickHouseClient();

      try {
        const result = await client.query({
          query: `
            SELECT
              product_id,
              predicted_units,
              lower_bound,
              trained_on
            FROM magharebit_analytics.ml_demand_forecasts
            WHERE tenant_id = {tenantId: String}
              AND horizon_days = 7
              AND trained_on >= today() - 7
              AND insufficient_data = 0
            ORDER BY predicted_units DESC
            LIMIT 20
          `,
          query_params: { tenantId },
          format: 'JSONEachRow',
        });

        type SuggestionRow = {
          product_id: string;
          predicted_units: number | string;
          lower_bound: number | string;
          trained_on: string;
        };

        const rows = await result.json<SuggestionRow>();
        return reply.send(
          rows.map((r) => ({
            productId: r.product_id,
            predictedUnits7d: Number(r.predicted_units),
            lowerBound: Number(r.lower_bound),
            suggestedReorderQty: Math.ceil(Number(r.predicted_units)),
            trainedOn: r.trained_on,
          })),
        );
      } catch (err) {
        console.error('[ml/reorder]', err);
        request.log.error({ err }, 'ml/reorder-suggestions: query failed');
        return reply.status(500).send({ error: 'reorder_failed' });
      }
    },
  );

  // ── POST /ml/retrain ──────────────────────────────────────────────────────────
  // Triggers on-demand model training. Runs async — does not block the response.
  fastify.post<{ Body: { dryRun?: boolean; productIds?: string[] } }>(
    '/ml/retrain',
    { config: { allowedRoles: ML_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { dryRun = false, productIds } = request.body ?? {};

      // Respond immediately, then start training
      void reply.send({ started: true, dryRun });

      setImmediate(() => {
        trainModels({ tenantId, dryRun, productIds }).catch((err) => {
          request.log.error({ err }, 'ml/retrain: async training failed');
        });
      });
    },
  );
}
