/**
 * settings repository
 *
 * MongoDB collection: `settings`
 * Partition key: merchantId  (one document per merchant)
 *
 * Auto-creates a document with sensible defaults the first time it is read.
 * Safe to call on every page load — no pre-conditions required.
 *
 * All WhatsApp features read their configuration from here so the cron job
 * and the transactions hook share a single source of truth.
 */

import { Db } from 'mongodb'
import { getDb } from '../mongodb'
import type { TaxRate } from '../transaction-totals'
import { merchantsRepo } from './merchants'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MerchantSettings {
  merchantId:          string
  // Store identity
  storeName:           string
  storePhone:          string       // WhatsApp number for outbound alerts (e.g. '0612345678')
  sector:              string
  logoUrl:             string       // '' or /api/stores/{merchantId}/logo?v=…; set only by the logo upload route
  currency:            'MAD'
  timezone:            string       // IANA tz — default 'Africa/Casablanca'

  // WhatsApp — master toggle disables all WA outbound
  whatsappEnabled:     boolean
  dailyReportEnabled:  boolean
  dailyReportTime:     string       // 'HH:MM' 24h — used by Vercel cron
  lowStockAlert:       boolean      // fires on every sale that produces low-stock items

  // T2 — Sprint 3: Customer WhatsApp receipt
  // Separate from merchant alerts so merchants can enable/disable independently.
  customerWhatsappReceiptEnabled: boolean

  // T1 — Sprint 3: TVA / Tax
  taxEnabled:      boolean   // master toggle: compute & display TVA on receipts
  defaultTaxRate:  TaxRate   // 0 | 7 | 10 | 14 | 20 — applied unless overridden per-transaction

  // T2 — Sprint 3: Discounts
  discountEnabled:       boolean   // allow cashiers to apply discounts
  maxDiscountPercent:    number    // 0–100: maximum % a cashier may discount (enforced server-side)

  // Receipt printing
  receiptHeader:       string       // optional text above store name on receipt
  receiptFooter:       string       // default 'شكراً لزيارتكم!'
  receiptShowLogo:     boolean

  updatedAt:           Date
}

// ── Defaults applied when no document exists yet ──────────────────────────────

const DEFAULTS: Omit<MerchantSettings, 'merchantId' | 'updatedAt'> = {
  storeName:          '',
  storePhone:         '',
  sector:             '',
  logoUrl:            '',
  currency:           'MAD',
  timezone:           'Africa/Casablanca',
  whatsappEnabled:    false,
  dailyReportEnabled: false,
  dailyReportTime:    '21:00',
  lowStockAlert:      true,
  // Customer receipt — OFF by default until merchant consciously enables
  customerWhatsappReceiptEnabled: false,
  // TVA — OFF by default (many small merchants are exempt)
  taxEnabled:          false,
  defaultTaxRate:      0,
  // Discounts — enabled by default, max 100% (no restriction)
  discountEnabled:     true,
  maxDiscountPercent:  100,
  // Receipt
  receiptHeader:      '',
  receiptFooter:      'شكراً لزيارتكم!',
  receiptShowLogo:    true,
}

// ── Whitelisted PATCH fields (API enforces this list) ─────────────────────────
// logoUrl is deliberately absent: it must point at bytes we stored (PUT /api/portal/settings/logo).

export const SETTINGS_PATCHABLE: ReadonlyArray<keyof Omit<MerchantSettings, 'merchantId' | 'updatedAt' | 'logoUrl'>> = [
  'storeName',
  'storePhone',
  'sector',
  'currency',
  'timezone',
  'whatsappEnabled',
  'dailyReportEnabled',
  'dailyReportTime',
  'lowStockAlert',
  'customerWhatsappReceiptEnabled',
  'taxEnabled',
  'defaultTaxRate',
  'discountEnabled',
  'maxDiscountPercent',
  'receiptHeader',
  'receiptFooter',
  'receiptShowLogo',
] as const

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  await db.collection('settings').createIndex({ merchantId: 1 }, { unique: true })
  indexesCreated = true
}

/** Store name on the merchant record (sign-up step 3, or the lead when an admin activates it). '' if unknown. */
async function merchantStoreName(merchantId: string): Promise<string> {
  const merchant = await merchantsRepo.findById(merchantId)
  return merchant?.storeName?.trim() ?? ''
}

// ── Repository ────────────────────────────────────────────────────────────────

export const settingsRepo = {

  /**
   * Get settings for a merchant.
   * Upserts a default document if none exists — always returns a full object.
   * New fields added in Sprint 3 are filled from DEFAULTS for older documents.
   */
  async get(merchantId: string): Promise<MerchantSettings> {
    const db = await getDb()
    if (!db) {
      return { merchantId, ...DEFAULTS, updatedAt: new Date() }
    }
    await ensureIndexes(db)

    const existing = await db.collection('settings').findOne({ merchantId })
    if (existing) {
      const { _id: _removed, ...rest } = existing as Record<string, unknown>
      void _removed
      // Merge defaults so older documents (pre-Sprint 3) get new field defaults
      const merged = { ...DEFAULTS, ...(rest as Partial<MerchantSettings>), merchantId } as MerchantSettings
      if (!merged.storeName.trim()) {
        // Documents created before the store name was copied over: fill it once, only while it is still blank
        const name = await merchantStoreName(merchantId)
        if (name) {
          await db.collection('settings').updateOne(
            { merchantId, $or: [{ storeName: '' }, { storeName: { $exists: false } }] },
            { $set: { storeName: name, updatedAt: new Date() } },
          )
          merged.storeName = name
        }
      }
      return merged
    }

    // First access — create defaults, with the store name given at sign-up or on the lead
    const doc: MerchantSettings = { merchantId, ...DEFAULTS, storeName: await merchantStoreName(merchantId), updatedAt: new Date() }
    await db.collection('settings').insertOne({ ...doc })
    return doc
  },

  /**
   * Update one or more settings fields for a merchant.
   * Only keys in SETTINGS_PATCHABLE are applied; extras are silently ignored.
   * Upserts if the document doesn't exist (idempotent).
   */
  async update(
    merchantId: string,
    data: Partial<Omit<MerchantSettings, 'merchantId' | 'updatedAt'>>
  ): Promise<MerchantSettings> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const safeUpdate: Record<string, unknown> = {}
    for (const key of SETTINGS_PATCHABLE) {
      if (key in data) {
        safeUpdate[key] = (data as Record<string, unknown>)[key]
      }
    }
    safeUpdate.updatedAt = new Date()

    const result = await db.collection('settings').findOneAndUpdate(
      { merchantId },
      { $set: safeUpdate },
      { upsert: true, returnDocument: 'after' }
    )

    if (!result) throw new Error('settings_update_failed')
    const { _id: _removed, ...rest } = result as Record<string, unknown>
    void _removed
    // Merge defaults for any fields missing in old documents
    return { ...DEFAULTS, ...(rest as Partial<MerchantSettings>), merchantId } as MerchantSettings
  },

  /** Set or clear ('') the store logo URL. Throws when the database is down. */
  async setLogoUrl(merchantId: string, logoUrl: string): Promise<MerchantSettings> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)
    // $setOnInsert must not name logoUrl too, or MongoDB rejects the update (path conflict)
    const { logoUrl: _omit, ...insertDefaults } = DEFAULTS
    void _omit
    const result = await db.collection('settings').findOneAndUpdate(
      { merchantId },
      { $set: { logoUrl, updatedAt: new Date() }, $setOnInsert: insertDefaults },
      { upsert: true, returnDocument: 'after' }
    )
    if (!result) throw new Error('settings_update_failed')
    const { _id: _removed, ...rest } = result as Record<string, unknown>
    void _removed
    return { ...DEFAULTS, ...(rest as Partial<MerchantSettings>), merchantId } as MerchantSettings
  },

  /**
   * Find all merchants that have daily reports enabled.
   * Used by the cron job to fan out WhatsApp messages.
   */
  async findDailyReportSubscribers(): Promise<MerchantSettings[]> {
    const db = await getDb()
    if (!db) return []
    await ensureIndexes(db)
    const docs = await db.collection('settings').find({
      whatsappEnabled:    true,
      dailyReportEnabled: true,
      storePhone:         { $ne: '' },
    }).toArray()
    return docs.map((d) => {
      const { _id: _removed, ...rest } = d as Record<string, unknown>
      void _removed
      return { ...DEFAULTS, ...(rest as Partial<MerchantSettings>) } as MerchantSettings
    })
  },
}
