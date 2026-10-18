-- Migration: 017_staff_pin_hash_text
-- Depends on: 009_shifts (creates staff table with pin_hash VARCHAR(64))
--
-- Problem: pin_hash was sized for SHA-256 hex output (exactly 64 chars).
-- Argon2id encoded hashes produced by services/pin-hash.ts are ~97 chars:
--   $argon2id$v=19$m=65536,t=3,p=1$<22-char salt>$<43-char hash>
-- The transparent SHA-256 → Argon2id rehash on login therefore fails with
-- "value too long for type character varying(64)", causing a 500 on
-- POST /shifts/open for every staff member still on a legacy SHA-256 hash.
--
-- Fix: widen the column to TEXT (no practical limit in PostgreSQL).
-- Existing SHA-256 hashes (64 chars) and any Argon2id hashes are preserved
-- without modification. No rows are rewritten; the ALTER is metadata-only in
-- PostgreSQL for variable-length types when relaxing the constraint.
--
-- Idempotent: TEXT has no length constraint, so re-running is a no-op.

ALTER TABLE staff
  ALTER COLUMN pin_hash TYPE TEXT;
