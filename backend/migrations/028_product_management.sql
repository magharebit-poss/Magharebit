-- Migration: 028_product_management
-- Adds business_type to tenants and image/meta/sort columns to products.
-- Depends on: 007_tenants_and_licenses, 013_remaining_tables
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to re-run.

-- ── Business type on tenants ─────────────────────────────────────────────────
-- nullable: existing tenants default to NULL.
-- The /products page prompts them to choose on first use.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT
    CHECK (business_type IN (
      'grocery', 'cafe', 'restaurant',
      'bakery', 'clothing', 'auto_parts'
    ));

-- ── Image columns on products ─────────────────────────────────────────────────
-- Relative paths from the images root (e.g. products/{tenantId}/{id}-thumb.webp).
-- Public URLs are constructed at query time from IMAGES_BASE_URL env var.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_thumb_path  TEXT,
  ADD COLUMN IF NOT EXISTS image_detail_path TEXT,

  -- Merchant-facing descriptions (optional, for display-only contexts).
  ADD COLUMN IF NOT EXISTS description_ar    TEXT,
  ADD COLUMN IF NOT EXISTS description_fr    TEXT,

  -- Manual ordering within a category (lower value shown first).
  ADD COLUMN IF NOT EXISTS sort_order        INTEGER NOT NULL DEFAULT 0,

  -- Business-type-specific extra fields stored as flexible JSONB.
  -- Examples:
  --   restaurant : { prep_time_minutes, allergens, is_vegetarian, spice_level }
  --   clothing   : { sizes, colors, material, gender }
  --   auto_parts : { reference_number, compatibility, brand, condition }
  --   cafe       : { temp_options, size_options }
  ADD COLUMN IF NOT EXISTS business_fields   JSONB,

  -- Audit timestamp: set by application on every UPDATE.
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Index to support the management list ordered by sort_order + name.
CREATE INDEX IF NOT EXISTS idx_products_sort
  ON products(tenant_id, sort_order, name_fr);
