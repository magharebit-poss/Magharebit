/**
 * Plan limits — single source of truth for all plan-scoped constraints.
 *
 * These values are returned by POST /api/licenses/validate so the POS logiciel
 * can enforce register/branch limits without a second round-trip.
 *
 * IMPORTANT: plan names must match LicensePlan exactly ('Starter' | 'Business' | 'Enterprise').
 * The Trial period uses Starter limits (isTrial flag is separate).
 */

import type { LicensePlan } from './license-key'

export interface PlanLimits {
  maxRegisters: number
  maxBranches:  number
  features:     string[]
}

export const PLAN_LIMITS: Record<LicensePlan, PlanLimits> = {
  Starter: {
    maxRegisters: 1,
    maxBranches:  1,
    features:     ['basic_pos', 'receipts'],
  },
  Business: {
    maxRegisters: 3,
    maxBranches:  2,
    features:     ['basic_pos', 'receipts', 'inventory', 'discounts'],
  },
  Enterprise: {
    maxRegisters: 10,
    maxBranches:  5,
    features:     ['basic_pos', 'receipts', 'inventory', 'discounts', 'api_access', 'advanced_analytics'],
  },
}

/** Safe lookup — falls back to Starter if plan is unknown/null. */
export function getPlanLimits(plan: LicensePlan | string | null | undefined): PlanLimits {
  if (plan && plan in PLAN_LIMITS) return PLAN_LIMITS[plan as LicensePlan]
  return PLAN_LIMITS.Starter
}

/** Trial period in days (auto-issued on signup). */
export const TRIAL_DAYS = 14
