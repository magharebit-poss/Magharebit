// ── Role type ─────────────────────────────────────────────────────────────────
export type StaffRole =
  | 'CASHIER'
  | 'SENIOR_CASHIER'
  | 'INVENTORY'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'OWNER';

// ── Permission type ───────────────────────────────────────────────────────────
export type Permission =
  | 'pos:sell'            // ring up a transaction
  | 'pos:discount'        // apply any discount
  | 'pos:discount_over_limit'   // discount > 20% (requires manager override)
  | 'pos:void'            // void a transaction
  | 'pos:refund'          // initiate a return
  | 'pos:open_drawer'     // open cash drawer outside a sale
  | 'pos:price_override'  // manually enter a price
  | 'inventory:view'      // view stock levels
  | 'inventory:adjust'    // adjust stock (write off, correction)
  | 'inventory:receive'   // receive a purchase order
  | 'waste:record'        // record a waste event
  | 'waste:over_threshold' // waste above the auto-approval threshold
  | 'reports:view'        // view analytics / shift reports
  | 'reports:export'      // export data / CSV
  | 'staff:manage'        // create / edit staff members
  | 'shift:open'          // open a shift
  | 'shift:close'         // close a shift
  | 'shift:override';     // override a stuck shift

// ── Role → permission matrix ──────────────────────────────────────────────────
// A role grants every permission in its array.
// Per-staff overrides (staff_permissions table) are applied on top at query time.
export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  CASHIER: [
    'pos:sell',
    'pos:discount',
    'waste:record',
    'shift:open',
    'shift:close',
  ],

  SENIOR_CASHIER: [
    'pos:sell',
    'pos:discount',
    'pos:refund',
    'inventory:view',
    'waste:record',
    'shift:open',
    'shift:close',
  ],

  INVENTORY: [
    'inventory:view',
    'inventory:adjust',
    'inventory:receive',
    'waste:record',
    'waste:over_threshold',
    'reports:view',
  ],

  MANAGER: [
    'pos:sell',
    'pos:discount',
    'pos:discount_over_limit',
    'pos:void',
    'pos:refund',
    'pos:open_drawer',
    'pos:price_override',
    'inventory:view',
    'inventory:adjust',
    'inventory:receive',
    'waste:record',
    'waste:over_threshold',
    'reports:view',
    'reports:export',
    'shift:open',
    'shift:close',
    'shift:override',
  ],

  SUPERVISOR: [
    'pos:sell',
    'pos:discount',
    'pos:discount_over_limit',
    'pos:void',
    'pos:refund',
    'pos:open_drawer',
    'pos:price_override',
    'inventory:view',
    'inventory:adjust',
    'inventory:receive',
    'waste:record',
    'waste:over_threshold',
    'reports:view',
    'reports:export',
    'staff:manage',
    'shift:open',
    'shift:close',
    'shift:override',
  ],

  OWNER: [
    'pos:sell',
    'pos:discount',
    'pos:discount_over_limit',
    'pos:void',
    'pos:refund',
    'pos:open_drawer',
    'pos:price_override',
    'inventory:view',
    'inventory:adjust',
    'inventory:receive',
    'waste:record',
    'waste:over_threshold',
    'reports:view',
    'reports:export',
    'staff:manage',
    'shift:open',
    'shift:close',
    'shift:override',
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Returns true when the permission requires a live manager PIN even if the
// requesting staff's role does NOT include it in ROLE_PERMISSIONS.
// Currently used by the frontend to decide whether to show ManagerPinModal.
export function requiresManagerOverride(permission: Permission): boolean {
  return permission === 'pos:discount_over_limit';
}
