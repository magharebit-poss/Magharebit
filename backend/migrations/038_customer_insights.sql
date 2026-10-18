-- RFM scores and customer segments
-- Updated nightly by ETL
CREATE TABLE IF NOT EXISTS customer_segments (
  segment_id     UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  customer_id    UUID NOT NULL,
  -- RFM: Recency / Frequency / Monetary
  -- Each scored 1-5 (5=best)
  recency_score  SMALLINT NOT NULL DEFAULT 0,
  frequency_score SMALLINT NOT NULL DEFAULT 0,
  monetary_score SMALLINT NOT NULL DEFAULT 0,
  rfm_total      SMALLINT GENERATED ALWAYS AS
    (recency_score + frequency_score
     + monetary_score) STORED,
  segment        TEXT NOT NULL DEFAULT 'new',
  -- 'champion'       rfm 13-15
  -- 'loyal'          rfm 10-12
  -- 'at_risk'        high freq, low recency
  -- 'big_spender'    high monetary
  -- 'dormant'        no purchase > 60 days
  -- 'credit_risk'    balance > 80% limit
  -- 'new'            < 3 purchases
  days_since_last_purchase INT,
  purchase_count  INT NOT NULL DEFAULT 0,
  total_spent_mad NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_basket_mad  NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_utilization NUMERIC(5,4) DEFAULT 0,
  -- balance / credit_limit (0-1, 1=maxed out)
  risk_score      SMALLINT NOT NULL DEFAULT 0,
  -- 0-100: 0=no risk, 100=critical
  last_computed   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id)
);
CREATE INDEX IF NOT EXISTS
  idx_segments_tenant
  ON customer_segments(
    tenant_id, segment, risk_score DESC);

-- Suggested promotions / actions per customer
CREATE TABLE IF NOT EXISTS customer_suggestions (
  suggestion_id  UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  customer_id    UUID NOT NULL,
  suggestion_type TEXT NOT NULL,
  -- 'reactivation'  dormant customer
  -- 'credit_warning' approaching limit
  -- 'credit_block'   over 90% limit
  -- 'loyalty_reward' champion/loyal milestone
  -- 'upsell'         basket below average
  priority       SMALLINT NOT NULL DEFAULT 50,
  -- 0-100, higher = more urgent
  details        JSONB NOT NULL DEFAULT '{}',
  shown_at       TIMESTAMPTZ,
  acted_on       BOOLEAN NOT NULL DEFAULT false,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS
  idx_suggestions_tenant
  ON customer_suggestions(
    tenant_id, acted_on, priority DESC)
  WHERE acted_on = false;
