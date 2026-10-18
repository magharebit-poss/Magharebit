/**
 * GET /api/portal/onboarding
 *
 * Returns live completion state for each onboarding step.
 * Auto-detects completion from real data — no client-side toggle needed.
 *
 * Steps:
 *   settings  — storeName or storePhone has been configured
 *   product   — at least 1 product exists
 *   employee  — at least 1 employee exists
 *   whatsapp  — whatsappEnabled=true AND storePhone is set
 *   sale      — at least 1 transaction has been recorded
 *
 * Designed to be cheap: all 5 checks run in parallel, each reads ≤ 1 document.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { settingsRepo } from '@/lib/repositories/settings'
import { productsRepo } from '@/lib/repositories/products'
import { employeesRepo } from '@/lib/repositories/employees'
import { transactionsRepo } from '@/lib/repositories/transactions'

export interface OnboardingStep {
  id:          string
  label:       string
  description: string
  href:        string   // portal slug to navigate to — empty string for steps with no dedicated page
  done:        boolean
}

export interface OnboardingStatus {
  steps:          OnboardingStep[]
  completedCount: number
  totalCount:     number
  allDone:        boolean
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const mid = session.merchantId

  // Run all 5 checks in parallel — each is a lightweight count/fetch
  const [settings, products, employees, txns] = await Promise.all([
    settingsRepo.get(mid),
    productsRepo.findAll({ merchantId: mid, page: 1, limit: 1 }),
    employeesRepo.findAll(mid, false),            // active only
    transactionsRepo.findAll({ merchantId: mid, page: 1, limit: 1 }),
  ])

  const steps: OnboardingStep[] = [
    {
      id:          'settings',
      label:       'أكمل بيانات متجرك',
      description: 'أضف اسم متجرك وقطاعك',
      href:        'settings',
      done:        Boolean(settings.storeName?.trim() || settings.sector?.trim()),
    },
    {
      id:          'product',
      label:       'أضف أول منتج',
      description: 'أنشئ كتالوج منتجاتك',
      href:        'products',
      done:        products.total > 0,
    },
    {
      id:          'employee',
      label:       'أضف موظفاً',
      description: 'سجّل فريق العمل في متجرك',
      href:        'employees',
      done:        employees.length > 0,
    },
    {
      id:          'whatsapp',
      label:       'فعّل إشعارات واتساب',
      description: 'ادخل رقم هاتفك وفعّل تقارير المبيعات اليومية',
      href:        'settings',
      done:        Boolean(settings.whatsappEnabled && settings.storePhone?.trim()),
    },
    {
      id:          'sale',
      label:       'أتمم أول عملية بيع',
      description: 'سجّل أول فاتورة من تطبيق POS',
      href:        '',
      done:        txns.total > 0,
    },
  ]

  const completedCount = steps.filter(s => s.done).length

  return NextResponse.json({
    steps,
    completedCount,
    totalCount:  steps.length,
    allDone:     completedCount === steps.length,
  } satisfies OnboardingStatus)
}
