import { describe, expect, test } from 'vitest';
import {
  assignableRoles,
  authorizeCreate,
  authorizeUpdate,
  canModifyTarget,
  isStaffRole,
  rankOf,
  STAFF_ROLE_LIST,
} from '../staff-access';

const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

describe('role ranking', () => {
  test('order: CASHIER < SENIOR_CASHIER = INVENTORY < MANAGER < SUPERVISOR < OWNER', () => {
    expect(rankOf('CASHIER')).toBeLessThan(rankOf('SENIOR_CASHIER'));
    expect(rankOf('SENIOR_CASHIER')).toBe(rankOf('INVENTORY'));
    expect(rankOf('INVENTORY')).toBeLessThan(rankOf('MANAGER'));
    expect(rankOf('MANAGER')).toBeLessThan(rankOf('SUPERVISOR'));
    expect(rankOf('SUPERVISOR')).toBeLessThan(rankOf('OWNER'));
  });
  test('unknown roles rank 0 and are not staff roles', () => {
    expect(rankOf('ADMIN')).toBe(0);
    expect(isStaffRole('supervisor')).toBe(false); // exact, upper case only
    expect(isStaffRole('SUPERVISOR')).toBe(true);
    expect(isStaffRole(undefined)).toBe(false);
    expect(STAFF_ROLE_LIST).toHaveLength(6);
  });
});

describe('assignable roles (rule 1)', () => {
  test('MANAGER may assign only roles below MANAGER', () => {
    expect(assignableRoles('MANAGER').sort()).toEqual(['CASHIER', 'INVENTORY', 'SENIOR_CASHIER']);
  });
  test('SUPERVISOR may assign up to MANAGER, never SUPERVISOR or OWNER', () => {
    const r = assignableRoles('SUPERVISOR');
    expect(r).toContain('MANAGER');
    expect(r).not.toContain('SUPERVISOR');
    expect(r).not.toContain('OWNER');
  });
  test('OWNER may assign every role, including a co-owner', () => {
    expect(assignableRoles('OWNER').sort()).toEqual([...STAFF_ROLE_LIST].sort());
  });
  test('cashiers and unknown roles may assign nothing', () => {
    expect(assignableRoles('CASHIER')).toEqual([]);
    expect(assignableRoles('')).toEqual([]);
  });
});

describe('create (rule 1, 4)', () => {
  test('MANAGER cannot create a SUPERVISOR or OWNER', () => {
    expect(authorizeCreate({ callerRole: 'MANAGER', role: 'SUPERVISOR' })).toEqual({ ok: false, status: 403, error: 'role_not_assignable' });
    expect(authorizeCreate({ callerRole: 'MANAGER', role: 'OWNER' })).toEqual({ ok: false, status: 403, error: 'role_not_assignable' });
  });
  test('MANAGER cannot create another MANAGER (strictly below)', () => {
    expect(authorizeCreate({ callerRole: 'MANAGER', role: 'MANAGER' }).ok).toBe(false);
  });
  test('MANAGER can create a CASHIER', () => {
    expect(authorizeCreate({ callerRole: 'MANAGER', role: 'CASHIER' }).ok).toBe(true);
  });
  test('SUPERVISOR can create a MANAGER but not a SUPERVISOR', () => {
    expect(authorizeCreate({ callerRole: 'SUPERVISOR', role: 'MANAGER' }).ok).toBe(true);
    expect(authorizeCreate({ callerRole: 'SUPERVISOR', role: 'SUPERVISOR' }).ok).toBe(false);
  });
  test('an invalid or missing role is rejected with a fixed code', () => {
    for (const bad of ['ADMIN', 'supervisor', '', undefined, null, 5]) {
      expect(authorizeCreate({ callerRole: 'OWNER', role: bad })).toEqual({ ok: false, status: 400, error: 'invalid_role' });
    }
  });
});

describe('modify target (rule 2)', () => {
  test('MANAGER cannot modify a SUPERVISOR or OWNER', () => {
    expect(canModifyTarget('MANAGER', 'SUPERVISOR')).toBe(false);
    expect(canModifyTarget('MANAGER', 'OWNER')).toBe(false);
  });
  test('MANAGER cannot modify another MANAGER', () => {
    expect(canModifyTarget('MANAGER', 'MANAGER')).toBe(false);
  });
  test('SUPERVISOR can manage MANAGERs and below, not SUPERVISORs or OWNERs', () => {
    expect(canModifyTarget('SUPERVISOR', 'MANAGER')).toBe(true);
    expect(canModifyTarget('SUPERVISOR', 'CASHIER')).toBe(true);
    expect(canModifyTarget('SUPERVISOR', 'SUPERVISOR')).toBe(false);
    expect(canModifyTarget('SUPERVISOR', 'OWNER')).toBe(false);
  });
  test('OWNER can manage everyone, including another OWNER', () => {
    for (const r of STAFF_ROLE_LIST) expect(canModifyTarget('OWNER', r)).toBe(true);
  });
  test('accounts with an unknown role are never touched', () => {
    expect(canModifyTarget('OWNER', 'ADMIN')).toBe(false);
  });
});

describe('update (rules 2-4)', () => {
  const base = { callerId: A, targetId: B };

  test('MANAGER cannot change a SUPERVISOR\'s PIN', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'SUPERVISOR', change: { pin: '9999' } }))
      .toEqual({ ok: false, status: 403, error: 'target_not_modifiable' });
  });
  test('MANAGER cannot deactivate or rename a SUPERVISOR/OWNER', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'OWNER', change: { is_active: false } }).ok).toBe(false);
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'SUPERVISOR', change: { name_ar: 'x' } }).ok).toBe(false);
  });
  test('MANAGER cannot promote a CASHIER to SUPERVISOR or OWNER', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'CASHIER', change: { role: 'SUPERVISOR' } }))
      .toEqual({ ok: false, status: 403, error: 'role_not_assignable' });
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'CASHIER', change: { role: 'OWNER' } }).ok).toBe(false);
  });
  test('MANAGER can promote a CASHIER to SENIOR_CASHIER and reset a CASHIER\'s PIN', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'CASHIER', change: { role: 'SENIOR_CASHIER' } }).ok).toBe(true);
    expect(authorizeUpdate({ ...base, callerRole: 'MANAGER', targetRole: 'CASHIER', change: { pin: '4321' } }).ok).toBe(true);
  });
  test('SUPERVISOR can manage MANAGERs (promote to nothing higher than MANAGER)', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'SUPERVISOR', targetRole: 'MANAGER', change: { pin: '4321', is_active: false } }).ok).toBe(true);
    expect(authorizeUpdate({ ...base, callerRole: 'SUPERVISOR', targetRole: 'CASHIER', change: { role: 'MANAGER' } }).ok).toBe(true);
    expect(authorizeUpdate({ ...base, callerRole: 'SUPERVISOR', targetRole: 'MANAGER', change: { role: 'SUPERVISOR' } }).ok).toBe(false);
  });
  test('nobody changes their own role (even upwards) or deactivates or re-PINs themselves', () => {
    const self = { callerId: A, targetId: A };
    for (const callerRole of ['MANAGER', 'SUPERVISOR', 'OWNER']) {
      expect(authorizeUpdate({ ...self, callerRole, targetRole: callerRole, change: { role: 'OWNER' } }))
        .toEqual(callerRole === 'OWNER' ? { ok: true } : { ok: false, status: 403, error: 'cannot_change_own_role' });
      expect(authorizeUpdate({ ...self, callerRole, targetRole: callerRole, change: { is_active: false } }))
        .toEqual({ ok: false, status: 403, error: 'cannot_deactivate_self' });
      expect(authorizeUpdate({ ...self, callerRole, targetRole: callerRole, change: { pin: '1234' } }))
        .toEqual({ ok: false, status: 403, error: 'cannot_change_own_pin' });
    }
  });
  test('an OWNER cannot demote themselves either', () => {
    expect(authorizeUpdate({ callerId: A, targetId: A, callerRole: 'OWNER', targetRole: 'OWNER', change: { role: 'MANAGER' } }))
      .toEqual({ ok: false, status: 403, error: 'cannot_change_own_role' });
  });
  test('re-sending your own current role and renaming yourself is allowed', () => {
    expect(authorizeUpdate({ callerId: A, targetId: A, callerRole: 'MANAGER', targetRole: 'MANAGER', change: { role: 'MANAGER', name_ar: 'اسم' } }).ok).toBe(true);
  });
  test('an invalid role is rejected with a fixed code', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'OWNER', targetRole: 'CASHIER', change: { role: 'ROOT' } }))
      .toEqual({ ok: false, status: 400, error: 'invalid_role' });
  });
  test('OWNER can manage another OWNER but not make themselves anything', () => {
    expect(authorizeUpdate({ ...base, callerRole: 'OWNER', targetRole: 'OWNER', change: { is_active: false } }).ok).toBe(true);
  });
});
