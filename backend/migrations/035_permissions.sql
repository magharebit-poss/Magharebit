-- ── Expand staff roles ────────────────────────────────────────────────────
-- Adds SENIOR_CASHIER, INVENTORY, OWNER to the existing CASHIER/MANAGER/SUPERVISOR set.
-- Existing rows remain valid; the constraint is widened, not narrowed.

ALTER TABLE staff
  DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE staff
  ADD CONSTRAINT staff_role_check
  CHECK (role IN (
    'CASHIER',
    'SENIOR_CASHIER',
    'INVENTORY',
    'MANAGER',
    'SUPERVISOR',
    'OWNER'
  ));

-- ── Per-staff permission overrides ────────────────────────────────────────
-- Additive on top of role defaults defined in backend/src/lib/permissions.ts.
-- granted=true: explicit grant (useful when granting a permission below the role).
-- granted=false: explicit revoke (strips a permission the role normally has).

CREATE TABLE IF NOT EXISTS staff_permissions (
  permission_id UUID PRIMARY KEY
                DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  staff_id      UUID NOT NULL,
  permission    TEXT NOT NULL,
  granted       BOOLEAN NOT NULL DEFAULT true,
  granted_by    UUID REFERENCES staff(staff_id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_perms_staff
  ON staff_permissions(tenant_id, staff_id);

-- ── Manager override log ──────────────────────────────────────────────────
-- Every time a manager/supervisor/owner enters their PIN to authorize a
-- restricted cashier action, a row is written here for the audit trail.

CREATE TABLE IF NOT EXISTS manager_overrides (
  override_id  UUID PRIMARY KEY
               DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  shift_id     UUID,
  manager_id   UUID NOT NULL,
  cashier_id   UUID,
  action       TEXT NOT NULL,
    -- 'void', 'discount_over_limit', 'open_drawer',
    -- 'price_override', 'refund', 'waste_over_threshold'
  reference_id UUID,   -- transaction or waste record id
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overrides_shift
  ON manager_overrides(tenant_id, shift_id);
