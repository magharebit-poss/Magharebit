-- Rollback of 051_stock_variances.sql. DRAFT, not applied.
-- Data loss: drops the table and every recorded variance. Export first if any rows exist:
--   COPY stock_variances TO STDOUT CSV HEADER;
-- Indexes and constraints go with the table.

DROP TABLE IF EXISTS stock_variances;
