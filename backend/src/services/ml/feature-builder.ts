import { queryChDockerExec } from './ch-exec.js';

export interface DemandFeatures {
  productId: string;
  tenantId: string;
  dailySales: Array<{ date: string; units: number }>;
  dataPoints: number;
  hasEnoughData: boolean; // >= 14 days with actual sales data
}

export interface WasteFeatures {
  lotId: string;
  productId: string;
  tenantId: string;
  lotAgeDays: number;
  currentStockUnits: number;
  salesVelocity7d: number;    // avg daily units sold past 7 days
  currentMarkdownPct: number; // 0-100
  wasteRate30d: number;       // 0-1
  hasEnoughData: boolean;
}

export async function buildDemandFeatures(
  tenantId: string,
  productId: string,
  _storeId?: string,
): Promise<DemandFeatures> {
  const rows = queryChDockerExec<{ event_date: string; units: string | number }>(
    `SELECT event_date, sum(quantity) AS units
     FROM fact_transactions
     WHERE tenant_id = {tenantId: String}
       AND product_id = {productId: String}
       AND event_date >= today() - 90
     GROUP BY event_date
     ORDER BY event_date ASC`,
    { tenantId, productId },
  );

  const salesMap = new Map<string, number>();
  for (const row of rows) {
    salesMap.set(row.event_date, Number(row.units));
  }

  const today = new Date();
  const filled: Array<{ date: string; units: number }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    filled.push({ date: dateStr, units: salesMap.get(dateStr) ?? 0 });
  }

  const distinctDates = salesMap.size;

  return {
    productId,
    tenantId,
    dailySales: filled,
    dataPoints: distinctDates,
    hasEnoughData: distinctDates >= 14,
  };
}

export async function buildWasteFeatures(
  tenantId: string,
  lotId: string,
): Promise<WasteFeatures | null> {
  // 1. Lot info from dim_lots
  const lotRows = queryChDockerExec<{
    product_id: string;
    received_at: string;
    quantity_received: string | number;
  }>(
    `SELECT product_id, received_at, quantity_received
     FROM dim_lots
     WHERE tenant_id = {tenantId: String}
       AND lot_id = {lotId: String}
     LIMIT 1`,
    { tenantId, lotId },
  );

  if (lotRows.length === 0) return null;
  const lot = lotRows[0]!;
  const productId = lot.product_id;
  const receivedAt = lot.received_at;
  const quantityReceived = Number(lot.quantity_received);

  const now = new Date();
  const receivedDate = new Date(receivedAt);
  const lotAgeDays = (now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24);

  // 2. Approx current stock: quantity_received minus sales since received_at
  const stockRows = queryChDockerExec<{ approx_stock: string | number | null }>(
    `SELECT {quantityReceived: Float64} - COALESCE(SUM(ft.quantity), 0) AS approx_stock
     FROM fact_transactions ft
     WHERE ft.product_id = {productId: String}
       AND ft.event_ts > {receivedAt: String}
       AND ft.tenant_id = {tenantId: String}`,
    { tenantId, productId, quantityReceived, receivedAt },
  );
  const currentStockUnits = Math.max(0, Number(stockRows[0]?.approx_stock ?? quantityReceived));

  // 3. Sales velocity: avg daily units over last 7 days
  const velocityRows = queryChDockerExec<{ velocity: string | number | null }>(
    `SELECT avg(daily_units) AS velocity
     FROM (
       SELECT event_date, sum(quantity) AS daily_units
       FROM fact_transactions
       WHERE tenant_id = {tenantId: String}
         AND product_id = {productId: String}
         AND event_date >= today() - 7
       GROUP BY event_date
     )`,
    { tenantId, productId },
  );
  const salesVelocity7d = Number(velocityRows[0]?.velocity ?? 0);

  // 4. Waste rate over last 30 days
  const wasteRows = queryChDockerExec<{ waste_rate: string | number }>(
    `SELECT
       COALESCE(
         sum(quantity) / NULLIF(
           (
             SELECT sum(quantity)
             FROM fact_transactions
             WHERE tenant_id = {tenantId: String}
               AND product_id = {productId: String}
               AND event_date >= today() - 30
           ), 0
         ), 0
       ) AS waste_rate
     FROM fact_waste_records
     WHERE tenant_id = {tenantId: String}
       AND product_id = {productId: String}
       AND event_date >= today() - 30`,
    { tenantId, productId },
  );
  const wasteRate30d = Number(wasteRows[0]?.waste_rate ?? 0);

  const hasEnoughData = salesVelocity7d > 0 || wasteRows.length > 0;

  return {
    lotId,
    productId,
    tenantId,
    lotAgeDays,
    currentStockUnits,
    salesVelocity7d,
    currentMarkdownPct: 0,
    wasteRate30d,
    hasEnoughData,
  };
}
