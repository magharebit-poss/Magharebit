-- Migration: 030_add_business_type
-- Add business vertical support to tenants.
-- Enables per-tenant module configuration (grocery, cafe, pharmacy, etc.).
-- Depends on: 007_tenants_and_licenses (tenants table)
-- Idempotent (uses IF NOT EXISTS + ON CONFLICT).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT
    NOT NULL DEFAULT 'grocery'
    CONSTRAINT business_type_check CHECK (
      business_type IN (
        'grocery', 'cafe', 'pharmacy', 'auto_parts', 'retail'
      )
    );

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS feature_flags JSONB
    NOT NULL DEFAULT '{}';

-- Set dev tenants to grocery with full feature set
UPDATE tenants
  SET business_type = 'grocery',
      feature_flags = '{
        "scale": true,
        "barcode": true,
        "bulk_weight": true,
        "waste_tracking": true
      }'
  WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE tenants
  SET business_type = 'grocery',
      feature_flags = '{
        "scale": true,
        "barcode": true,
        "bulk_weight": true,
        "waste_tracking": true
      }'
  WHERE id = '22222222-2222-2222-2222-222222222222';

COMMENT ON COLUMN tenants.business_type IS
  'Business vertical: grocery | cafe | pharmacy | auto_parts | retail';
COMMENT ON COLUMN tenants.feature_flags IS
  'Per-tenant module overrides on top of business_type defaults (JSONB)';
