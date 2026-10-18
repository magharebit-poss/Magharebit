import type { Pool } from 'pg';

export interface CashFlowDay {
  date:                  string;
  projected_inflow_mad:  number;
  projected_outflow_mad: number;
  net_mad:               number;
  running_balance_mad:   number;
  is_forecast:           boolean;
  risk_level:
    'none'|'low'|'medium'|'high'|'critical';
  obligations: Array<{
    supplier_name_ar: string;
    amount_mad:       number;
    days_until_due:   number;
  }>;
}

export interface CashFlowReport {
  generated_at:    string;
  opening_balance: number;
  days:            CashFlowDay[];
  summary: {
    total_projected_inflow:   number;
    total_projected_outflow:  number;
    total_obligations_due:    number;
    worst_balance:            number;
    worst_balance_date:       string;
    total_credit_outstanding: number;
    risk_level:
      'none'|'low'|'medium'
      |'high'|'critical';
    risk_message_ar: string;
    risk_code:
      'none'|'low'|'medium'
      |'high'|'critical';
  };
}

export async function buildCashFlowReport(
  tenantId:    string,
  pool:        Pool,
  horizonDays: number = 30
): Promise<CashFlowReport> {

  const lastShift = await pool.query<{ balance: number }>(
    `SELECT COALESCE(closing_cash_counted, 0)
       as balance
     FROM shifts
     WHERE tenant_id = $1
       AND status    = 'closed'
     ORDER BY closed_at DESC LIMIT 1`,
    [tenantId]
  );

  // closing_cash_counted is stored in piastres (integer cents); divide by 100 for MAD
  const openingBalance =
    Math.round((lastShift.rows[0]?.balance ?? 0) / 100 * 100) / 100;

  const hist = await pool.query<{ day: string; revenue: string }>(
    `SELECT DATE(sold_at) as day,
            SUM(total_amount_cents)/100.0
              as revenue
     FROM transactions
     WHERE tenant_id = $1
       AND status    = 'completed'
       AND sold_at   > now() - INTERVAL '30 days'
     GROUP BY DATE(sold_at)
     ORDER BY day`,
    [tenantId]
  );

  const revenues =
    hist.rows.map(r => parseFloat(r.revenue));
  const avgDailyRevenue = revenues.length > 0
    ? revenues.reduce((a,b)=>a+b,0)
      / revenues.length
    : 0;

  const fcast = await pool.query<{
    forecast_date: string;
    projected_revenue: string;
  }>(
    `SELECT forecast_date,
            SUM(qty_predicted * p.price_cents)
              / 100.0 as projected_revenue
     FROM demand_forecasts f
     JOIN products p
       ON p.product_id = f.product_id
       AND p.tenant_id = f.tenant_id
     WHERE f.tenant_id = $1
       AND f.forecast_date > CURRENT_DATE
       AND f.forecast_date <= CURRENT_DATE + $2::int
     GROUP BY forecast_date
     ORDER BY forecast_date`,
    [tenantId, horizonDays]
  );

  const forecastMap = new Map<string,number>();
  for (const r of fcast.rows) {
    forecastMap.set(
      r.forecast_date.toString().slice(0,10),
      parseFloat(r.projected_revenue)
    );
  }

  const invoices = await pool.query<{
    invoice_id:      string;
    due_date:        string;
    remaining_mad:   string;
    supplier_name_ar: string;
  }>(
    `SELECT i.invoice_id, i.due_date,
            i.remaining_mad,
            s.name_ar as supplier_name_ar
     FROM supplier_invoices i
     JOIN suppliers s
       ON s.supplier_id = i.supplier_id
     WHERE i.tenant_id = $1
       AND i.status IN ('unpaid','partial')
       AND i.due_date IS NOT NULL
       AND i.due_date <= CURRENT_DATE + $2::int
     ORDER BY i.due_date`,
    [tenantId, horizonDays]
  );

  const obligMap =
    new Map<string,Array<{
      supplier_name_ar:string;
      amount_mad:number;
      days_until_due:number;
    }>>();

  const today = new Date();
  for (const inv of invoices.rows) {
    const dueDate =
      inv.due_date.toString().slice(0,10);
    if (!obligMap.has(dueDate))
      obligMap.set(dueDate,[]);
    const daysUntil = Math.round(
      (new Date(dueDate).getTime()
       - today.getTime()) / 86_400_000
    );
    obligMap.get(dueDate)!.push({
      supplier_name_ar: inv.supplier_name_ar,
      amount_mad:
        parseFloat(inv.remaining_mad),
      days_until_due: daysUntil,
    });
  }

  const creditOut = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(balance),0) as total
     FROM customers
     WHERE tenant_id = $1 AND balance > 0`,
    [tenantId]
  );

  const totalCreditOutstanding =
    parseFloat(creditOut.rows[0]?.total ?? '0');

  const days: CashFlowDay[] = [];
  let runningBalance = openingBalance;
  let worstBalance   = openingBalance;
  let worstDate      = '';
  let totalInflow    = 0;
  let totalOutflow   = 0;

  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    const isForecast = i > 0;

    const projInflow = isForecast
      ? (forecastMap.get(iso) ?? avgDailyRevenue)
      : (hist.rows.find(
           r => r.day.toString().slice(0,10)
             === iso
         )?.revenue
           ? parseFloat(hist.rows.find(
               r => r.day.toString().slice(0,10)
                 === iso
             )!.revenue)
           : 0);

    const obligations =
      obligMap.get(iso) ?? [];
    const projOutflow = obligations.reduce(
      (s,o) => s + o.amount_mad, 0
    );
    const net = projInflow - projOutflow;
    runningBalance += net;
    totalInflow    += projInflow;
    totalOutflow   += projOutflow;

    if (runningBalance < worstBalance) {
      worstBalance = runningBalance;
      worstDate    = iso;
    }

    let dayRisk: CashFlowDay['risk_level'] = 'none';
    if (runningBalance < 0) {
      dayRisk = i <= 7  ? 'critical'
              : i <= 14 ? 'high'
              : 'medium';
    } else if (projOutflow > avgDailyRevenue * 3) {
      dayRisk = 'medium';
    }

    days.push({
      date: iso,
      projected_inflow_mad:
        Math.round(projInflow * 100) / 100,
      projected_outflow_mad:
        Math.round(projOutflow * 100) / 100,
      net_mad: Math.round(net * 100) / 100,
      running_balance_mad:
        Math.round(runningBalance * 100) / 100,
      is_forecast: isForecast,
      risk_level: dayRisk,
      obligations,
    });
  }

  const criticalDays =
    days.filter(d => d.risk_level==='critical')
      .length;
  const highDays =
    days.filter(d => d.risk_level==='high')
      .length;

  let overallRisk:
    CashFlowReport['summary']['risk_level']
    = 'none';
  let riskMessageAr =
    'التدفق النقدي متوازن في الـ 30 يوماً القادمة';

  if (criticalDays > 0) {
    overallRisk   = 'critical';
    riskMessageAr =
      `⚠️ خطر: الرصيد سيصبح سالباً خلال`
      + ` 7 أيام (${criticalDays} يوم متأثر)`;
  } else if (highDays > 0) {
    overallRisk   = 'high';
    riskMessageAr =
      'تحذير: ضغط نقدي متوقع خلال 14 يوماً';
  } else if (worstBalance < avgDailyRevenue * 3){
    overallRisk   = 'medium';
    riskMessageAr =
      'الاحتياطي النقدي منخفض —'
      + ' راجع التزامات الموردين';
  } else if (
    totalCreditOutstanding > avgDailyRevenue * 30
  ) {
    overallRisk   = 'low';
    riskMessageAr =
      'ملاحظة: مديونيات الزبائن مرتفعة —'
      + ' تابع التحصيل';
  }

  return {
    generated_at:    new Date().toISOString(),
    opening_balance: openingBalance,
    days,
    summary: {
      total_projected_inflow:
        Math.round(totalInflow  * 100) / 100,
      total_projected_outflow:
        Math.round(totalOutflow * 100) / 100,
      total_obligations_due:
        Math.round(
          invoices.rows.reduce(
            (s,r) =>
              s + parseFloat(r.remaining_mad),
            0
          ) * 100
        ) / 100,
      worst_balance:
        Math.round(worstBalance * 100) / 100,
      worst_balance_date: worstDate,
      total_credit_outstanding:
        Math.round(
          totalCreditOutstanding * 100) / 100,
      risk_level:      overallRisk,
      risk_message_ar: riskMessageAr,
      risk_code:       overallRisk,
    },
  };
}

export async function runCashFlowUpdate(
  tenantId: string,
  pool:     Pool
): Promise<void> {
  const report =
    await buildCashFlowReport(tenantId, pool);
  for (const day of report.days) {
    if (!day.is_forecast) continue;
    try {
      await pool.query(
        `INSERT INTO cashflow_snapshots
           (tenant_id, snapshot_date,
            sales_mad, supplier_paid_mad,
            running_balance_mad)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, snapshot_date)
         DO UPDATE SET
           sales_mad =
             EXCLUDED.sales_mad,
           supplier_paid_mad =
             EXCLUDED.supplier_paid_mad,
           running_balance_mad =
             EXCLUDED.running_balance_mad`,
        [
          tenantId, day.date,
          day.projected_inflow_mad,
          day.projected_outflow_mad,
          day.running_balance_mad,
        ]
      );
    } catch { /* non-blocking */ }
  }
}
