/**
 * Access rules for staff management (create / promote / edit / deactivate).
 *
 * One ranking, used by the routes and (through GET /staff/assignable-roles) by the
 * /staff page, so the two can never disagree:
 *
 *   CASHIER < SENIOR_CASHIER = INVENTORY < MANAGER < SUPERVISOR < OWNER
 *
 * Rules (all enforced server-side; the UI only mirrors them):
 *  1. A caller may create or assign only roles STRICTLY BELOW their own rank.
 *     Exception: an OWNER may also assign OWNER (a co-owner), because the calling
 *     OWNER is the existing owner who authorises it. OWNER_MAY_CREATE_OWNER turns that off.
 *  2. A caller may change a target's name, role, PIN or active flag only when the
 *     target's CURRENT rank is strictly below the caller's. Exception: an OWNER may
 *     manage another OWNER (never themselves).
 *  3. Nobody changes their own role, deactivates themselves or changes their own PIN
 *     here (no "current PIN" path exists, so a self PIN change is blocked, not allowed).
 *     Renaming yourself is allowed.
 *  4. Roles are validated against the allowed list. Errors are fixed codes, never text
 *     from the database.
 *
 * Pure functions, no I/O: the rules are unit-tested without a database.
 */

export const STAFF_ROLE_RANK = {
  CASHIER: 1,
  SENIOR_CASHIER: 2,
  INVENTORY: 2,
  MANAGER: 3,
  SUPERVISOR: 4,
  OWNER: 5,
} as const;

export type StaffRole = keyof typeof STAFF_ROLE_RANK;

export const STAFF_ROLE_LIST = Object.keys(STAFF_ROLE_RANK) as StaffRole[];

/** An OWNER may appoint another OWNER. Set to false to make OWNER seed/DB-only. */
export const OWNER_MAY_CREATE_OWNER = true;

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STAFF_ROLE_RANK, value);
}

export function rankOf(role: string): number {
  return isStaffRole(role) ? STAFF_ROLE_RANK[role] : 0;
}

/** Roles the caller may create or assign. */
export function assignableRoles(callerRole: string): StaffRole[] {
  const callerRank = rankOf(callerRole);
  return STAFF_ROLE_LIST.filter((r) => {
    if (STAFF_ROLE_RANK[r] < callerRank) return true;
    return r === 'OWNER' && callerRole === 'OWNER' && OWNER_MAY_CREATE_OWNER;
  });
}

/** Whether the caller may modify an account whose current role is `targetRole` (not self). */
export function canModifyTarget(callerRole: string, targetRole: string): boolean {
  if (!isStaffRole(callerRole)) return false;
  const targetRank = rankOf(targetRole);
  if (targetRank === 0) return false; // unknown role in the database: do not touch it
  if (callerRole === 'OWNER' && targetRole === 'OWNER') return true;
  return targetRank < rankOf(callerRole);
}

export type StaffDecision =
  | { ok: true }
  | { ok: false; status: 400 | 403; error: StaffErrorCode };

export type StaffErrorCode =
  | 'invalid_role'
  | 'role_not_assignable'
  | 'target_not_modifiable'
  | 'cannot_change_own_role'
  | 'cannot_deactivate_self'
  | 'cannot_change_own_pin'
  | 'caller_not_found';

const deny = (status: 400 | 403, error: StaffErrorCode): StaffDecision => ({ ok: false, status, error });

/** Creating an account with `role`. */
export function authorizeCreate(input: { callerRole: string; role: unknown }): StaffDecision {
  if (!isStaffRole(input.role)) return deny(400, 'invalid_role');
  if (!assignableRoles(input.callerRole).includes(input.role)) return deny(403, 'role_not_assignable');
  return { ok: true };
}

export interface StaffChange {
  role?: unknown;
  pin?: unknown;
  is_active?: unknown;
  name_ar?: unknown;
  name_fr?: unknown;
}

/** Updating an existing account. `targetRole` is its CURRENT role from the database. */
export function authorizeUpdate(input: {
  callerId: string;
  callerRole: string;
  targetId: string;
  targetRole: string;
  change: StaffChange;
}): StaffDecision {
  const { callerId, callerRole, targetId, targetRole, change } = input;

  // A role in the request must be a known role, whatever else is going on.
  const roleGiven = change.role !== undefined;
  if (roleGiven && !isStaffRole(change.role)) return deny(400, 'invalid_role');
  const roleChanges = roleGiven && change.role !== targetRole;

  if (callerId === targetId) {
    if (roleChanges) return deny(403, 'cannot_change_own_role');
    if (change.is_active === false) return deny(403, 'cannot_deactivate_self');
    if (change.pin !== undefined) return deny(403, 'cannot_change_own_pin');
    return { ok: true }; // renaming yourself (or re-sending your current role) is fine
  }

  if (!canModifyTarget(callerRole, targetRole)) return deny(403, 'target_not_modifiable');

  if (roleChanges && !assignableRoles(callerRole).includes(change.role as StaffRole)) {
    return deny(403, 'role_not_assignable');
  }
  return { ok: true };
}
