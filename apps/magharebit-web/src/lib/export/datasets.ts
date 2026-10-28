/**
 * The admin export datasets. Each builds an ExportTable from the same filters as its screen, with headers in the
 * admin's language. At most MAX_EXPORT_ROWS rows; `truncated` says when the filter matched more.
 *
 * Deliberately left out of every export: license keys (they activate software), customer ids, admin notes.
 * No card data exists anywhere in these collections (payments are tokenized on the terminal).
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { merchantsRepo } from '../repositories/merchants'
import { leadsRepo, type Lead } from '../repositories/leads'
import { ensureReportingIndexes } from '../admin-metrics'
import { MOROCCO_TZ, tzOffsetMs, zonedDayStart, zonedStartOfKey } from '../zoned-time'
import { SECTOR_LABEL, type Lang } from '@/components/admin/adminUi'
import type { Cell, ExportTable } from './table'

export const MAX_EXPORT_ROWS = 50_000
export const EXPORT_DATASETS = ['commission-rates', 'leads', 'sales'] as const
export type ExportDataset = (typeof EXPORT_DATASETS)[number]

export function isExportDataset(v: string): v is ExportDataset {
  return (EXPORT_DATASETS as readonly string[]).includes(v)
}

export interface ExportFilters {
  q?: string
  status?: string
  /** Sales only: Morocco calendar days, YYYY-MM-DD, both inclusive. */
  from?: string
  to?: string
}

export interface BuiltExport {
  table: ExportTable
  truncated: boolean
  /** The filters actually applied (normalised), recorded in the audit log. */
  applied: Record<string, string>
  /** Appended to the download file name (sales: the date range). Defaults to today's date. */
  fileSuffix?: string
}

const HEADERS: Record<ExportDataset, Record<Lang, string[]>> = {
  'commission-rates': {
    ar: ['المتجر', 'الهاتف', 'البريد الإلكتروني', 'المدينة', 'نوع المتجر', 'الباقة', 'العمولة (%)', 'نهاية الاشتراك'],
    fr: ['Commerce', 'Téléphone', 'E-mail', 'Ville', 'Type de commerce', 'Formule', 'Commission (%)', 'Fin d’abonnement'],
    en: ['Shop', 'Phone', 'Email', 'City', 'Shop type', 'Plan', 'Commission (%)', 'Subscription ends'],
  },
  leads: {
    ar: ['تاريخ الطلب', 'المتجر', 'الهاتف', 'النشاط', 'المدينة', 'اللغة', 'الحالة', 'تاريخ التفعيل'],
    fr: ['Date de demande', 'Commerce', 'Téléphone', 'Activité', 'Ville', 'Langue', 'Statut', 'Date d’activation'],
    en: ['Submitted', 'Shop', 'Phone', 'Business', 'City', 'Language', 'Status', 'Activated'],
  },
  sales: {
    ar: ['التاريخ والوقت', 'التاجر', 'رقم الإيصال', 'عدد المواد', 'المجموع الفرعي (درهم)', 'الخصم (درهم)', 'دون ضريبة (درهم)', 'الضريبة (%)', 'مبلغ الضريبة (درهم)', 'الإجمالي (درهم)', 'طريقة الدفع', 'الموظف'],
    fr: ['Date et heure', 'Commerçant', 'N° de ticket', 'Articles', 'Sous-total (MAD)', 'Remise (MAD)', 'Total HT (MAD)', 'TVA (%)', 'Montant TVA (MAD)', 'Total TTC (MAD)', 'Paiement', 'Employé'],
    en: ['Date and time', 'Merchant', 'Receipt no.', 'Items', 'Subtotal (MAD)', 'Discount (MAD)', 'Total excl. tax (MAD)', 'VAT (%)', 'VAT amount (MAD)', 'Total incl. tax (MAD)', 'Payment', 'Employee'],
  },
}

const LEAD_STATUS: Record<Lang, Record<Lead['status'], string>> = {
  ar: { new: 'جديد', contacted: 'تم التواصل', converted: 'تم التحويل', rejected: 'مرفوض', activated: 'مفعّل' },
  fr: { new: 'Nouveau', contacted: 'Contacté', converted: 'Converti', rejected: 'Refusé', activated: 'Activé' },
  en: { new: 'New', contacted: 'Contacted', converted: 'Converted', rejected: 'Rejected', activated: 'Activated' },
}

const PAYMENT: Record<Lang, Record<string, string>> = {
  ar: { cash: 'نقداً', card: 'بطاقة', mobile_money: 'دفع عبر الهاتف', mixed: 'مختلط' },
  fr: { cash: 'Espèces', card: 'Carte', mobile_money: 'Paiement mobile', mixed: 'Mixte' },
  en: { cash: 'Cash', card: 'Card', mobile_money: 'Mobile money', mixed: 'Mixed' },
}

const LEAD_STATUSES: Lead['status'][] = ['new', 'contacted', 'converted', 'rejected', 'activated']

/** "YYYY-MM-DD HH:mm" in Morocco time: unambiguous in every Excel locale. */
export function moroccoDateTime(value: Date | string | undefined | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() + tzOffsetMs(d, MOROCCO_TZ)).toISOString().slice(0, 16).replace('T', ' ')
}

const day = (value: Date | string | undefined | null) => moroccoDateTime(value).slice(0, 10)

async function commissionRates(lang: Lang, f: ExportFilters): Promise<BuiltExport> {
  const q = (f.q ?? '').trim().slice(0, 100)
  const { merchants } = await merchantsRepo.findAll({ status: 'approved', q, page: 1, limit: MAX_EXPORT_ROWS + 1 })
  const rows: Cell[][] = merchants.slice(0, MAX_EXPORT_ROWS).map((m) => [
    m.storeName, m.phone || '', m.email ?? '', m.city || '', SECTOR_LABEL[lang][m.sector] ?? m.sector ?? '',
    m.plan ?? '', m.commissionRate ?? null, day(m.subscriptionEndsAt),
  ])
  return { table: { name: 'commission-rates', headers: HEADERS['commission-rates'][lang], rows }, truncated: merchants.length > MAX_EXPORT_ROWS, applied: q ? { q } : {} }
}

async function leads(lang: Lang, f: ExportFilters): Promise<BuiltExport> {
  const q = (f.q ?? '').trim().slice(0, 100)
  const status = LEAD_STATUSES.includes(f.status as Lead['status']) ? (f.status as Lead['status']) : 'all'
  const { leads: found } = await leadsRepo.findAll({ status, q, page: 1, limit: MAX_EXPORT_ROWS + 1 })
  const rows: Cell[][] = found.slice(0, MAX_EXPORT_ROWS).map((l) => [
    moroccoDateTime(l.submittedAt), l.storeName, l.phone, SECTOR_LABEL[lang][l.businessType] ?? l.businessType ?? '',
    l.city ?? '', (l.locale ?? '').toUpperCase(), LEAD_STATUS[lang][l.status] ?? l.status, moroccoDateTime(l.activatedAt),
  ])
  const applied: Record<string, string> = {}
  if (q) applied.q = q
  if (status !== 'all') applied.status = status
  return { table: { name: 'leads', headers: HEADERS.leads[lang], rows }, truncated: found.length > MAX_EXPORT_ROWS, applied }
}

/** Sales range: default the last 7 Morocco days. Throws 'invalid_range' for a bad or reversed range, or one over 366 days. */
export function salesRange(f: ExportFilters, now: Date = new Date()): { from: Date; to: Date; fromKey: string; toKey: string } {
  const toStart = f.to ? zonedStartOfKey(f.to) : zonedDayStart(now)
  const fromStart = f.from ? zonedStartOfKey(f.from) : zonedDayStart(now, MOROCCO_TZ, -6)
  if (!toStart || !fromStart || fromStart > toStart) throw new Error('invalid_range')
  const to = zonedDayStart(toStart, MOROCCO_TZ, 1) // exclusive end: midnight after the last day
  if (to.getTime() - fromStart.getTime() > 367 * 86_400_000) throw new Error('invalid_range')
  return { from: fromStart, to, fromKey: day(fromStart), toKey: day(toStart) }
}

async function sales(lang: Lang, f: ExportFilters): Promise<BuiltExport> {
  const range = salesRange(f)
  const db = await getDb()
  if (!db) throw new Error('database_unavailable')
  await ensureReportingIndexes(db)
  const docs = await db.collection('transactions')
    .find({ createdAt: { $gte: range.from, $lt: range.to } }, {
      projection: { _id: 0, merchantId: 1, receiptNo: 1, items: 1, subtotal: 1, discount: 1, totalHT: 1, taxRate: 1, taxAmount: 1, total: 1, paymentMethod: 1, employeeName: 1, createdAt: 1 },
    })
    .sort({ createdAt: 1 })
    .limit(MAX_EXPORT_ROWS + 1)
    .toArray()

  const ids = [...new Set(docs.map((d) => String(d.merchantId ?? '')))].filter((id) => /^[0-9a-f]{24}$/i.test(id))
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = await db.collection('merchants')
      .find({ _id: { $in: ids.slice(i, i + 1000).map((id) => new ObjectId(id)) } }, { projection: { storeName: 1 } })
      .toArray()
    for (const m of batch) names.set(m._id.toHexString(), String(m.storeName ?? ''))
  }

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)
  const rows: Cell[][] = docs.slice(0, MAX_EXPORT_ROWS).map((d) => [
    moroccoDateTime(d.createdAt as Date),
    names.get(String(d.merchantId)) || String(d.merchantId ?? ''),
    String(d.receiptNo ?? ''),
    Array.isArray(d.items) ? d.items.reduce((n: number, it: { qty?: number }) => n + (Number(it?.qty) || 0), 0) : null,
    num(d.subtotal), num(d.discount), num(d.totalHT ?? d.total), num(d.taxRate ?? 0), num(d.taxAmount ?? 0), num(d.total),
    PAYMENT[lang][String(d.paymentMethod)] ?? String(d.paymentMethod ?? ''),
    String(d.employeeName ?? ''),
  ])
  return {
    table: { name: 'portal-sales', headers: HEADERS.sales[lang], rows },
    fileSuffix: `${range.fromKey}_${range.toKey}`,
    truncated: docs.length > MAX_EXPORT_ROWS,
    applied: { from: range.fromKey, to: range.toKey },
  }
}

export async function buildExport(dataset: ExportDataset, lang: Lang, filters: ExportFilters): Promise<BuiltExport> {
  const built = dataset === 'commission-rates' ? await commissionRates(lang, filters)
    : dataset === 'leads' ? await leads(lang, filters)
      : await sales(lang, filters)
  built.table.rtl = lang === 'ar'
  return built
}
