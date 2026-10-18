-- Migration: 022_digest_config
-- Adds WhatsApp daily digest configuration columns to the tenants table.
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to re-run.
-- Depends on: 007_tenants_and_licenses (tenants table must exist)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS whatsapp_phone    TEXT,
  ADD COLUMN IF NOT EXISTS digest_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_time       TEXT    NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS timezone          TEXT    NOT NULL DEFAULT 'Africa/Casablanca',
  ADD COLUMN IF NOT EXISTS digest_language   TEXT    NOT NULL DEFAULT 'ar';

-- whatsapp_phone   : merchant's WhatsApp number with country code, no +
--                    e.g. "212612345678". NULL = digest not configured.
-- digest_enabled   : master switch; false = no messages sent regardless of
--                    other settings.
-- digest_time      : HH:MM in tenant's local timezone (Phase 2 per-tenant
--                    scheduling). Phase 1 cron fires at 06:00 UTC (07:00 MAT).
-- timezone         : IANA timezone string, default Morocco (UTC+1, no DST).
-- digest_language  : 'ar' | 'fr' — language for the WhatsApp message body.
