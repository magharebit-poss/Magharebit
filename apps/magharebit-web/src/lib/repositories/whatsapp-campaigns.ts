/**
 * whatsapp-campaigns repository
 *
 * MongoDB collection: `whatsapp_campaigns`
 * Partition key: merchantId
 *
 * Campaign lifecycle:
 *   draft → sending → completed
 *
 * Only 'draft' campaigns can be edited or sent.
 * 'sending' is set atomically before fan-out to prevent double-send.
 * 'completed' is set after fan-out with final success/fail counts.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CampaignStatus    = 'draft' | 'sending' | 'completed'
export type CampaignAudience  = 'all' | 'bronze' | 'silver' | 'gold'

export const AUDIENCE_LABELS: Record<CampaignAudience, string> = {
  all:    'جميع العملاء',
  bronze: 'الفئة البرونزية',
  silver: 'الفئة الفضية',
  gold:   'الفئة الذهبية',
}

export interface WhatsAppCampaignDoc {
  id:              string
  merchantId:      string
  title:           string
  messageTemplate: string         // supports {name} placeholder
  targetAudience:  CampaignAudience
  status:          CampaignStatus
  recipientCount:  number         // total customers targeted (set at send time)
  successCount:    number         // messages sent successfully
  failCount:       number         // messages that failed
  createdAt:       Date
  sentAt?:         Date           // set when completed
}

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('whatsapp_campaigns')
  await Promise.all([
    col.createIndex({ merchantId: 1, createdAt: -1 }),
    col.createIndex({ merchantId: 1, status: 1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): WhatsAppCampaignDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  return { id, ...rest } as WhatsAppCampaignDoc
}

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id)
}

/** Render a message template, substituting {name} with the customer's name. */
export function renderTemplate(template: string, customerName: string): string {
  return template.replace(/\{name\}/g, customerName)
}

// ── Repository ────────────────────────────────────────────────────────────────

export const campaignsRepo = {

  async findAll(merchantId: string): Promise<WhatsAppCampaignDoc[]> {
    const db = await getDb()
    if (!db) return []
    await ensureIndexes(db)
    const docs = await db.collection('whatsapp_campaigns')
      .find({ merchantId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()
    return docs.map(d => toDoc(d as Record<string, unknown>))
  },

  async findById(merchantId: string, id: string): Promise<WhatsAppCampaignDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    await ensureIndexes(db)
    const doc = await db.collection('whatsapp_campaigns').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async create(opts: {
    merchantId:      string
    title:           string
    messageTemplate: string
    targetAudience:  CampaignAudience
  }): Promise<WhatsAppCampaignDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const doc = {
      merchantId:      opts.merchantId,
      title:           opts.title.trim(),
      messageTemplate: opts.messageTemplate.trim(),
      targetAudience:  opts.targetAudience,
      status:          'draft' as CampaignStatus,
      recipientCount:  0,
      successCount:    0,
      failCount:       0,
      createdAt:       new Date(),
    }
    const result = await db.collection('whatsapp_campaigns').insertOne(doc)
    return toDoc({ ...doc, _id: result.insertedId })
  },

  /**
   * Update a draft campaign.  Only allowed while status = 'draft'.
   * Returns null if not found or not in draft status.
   */
  async update(
    merchantId: string,
    id:         string,
    data: Partial<{
      title:           string
      messageTemplate: string
      targetAudience:  CampaignAudience
    }>
  ): Promise<WhatsAppCampaignDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: Record<string, any> = {}
    if (data.title           !== undefined) set.title           = data.title.trim()
    if (data.messageTemplate !== undefined) set.messageTemplate = data.messageTemplate.trim()
    if (data.targetAudience  !== undefined) set.targetAudience  = data.targetAudience

    if (Object.keys(set).length === 0) {
      return this.findById(merchantId, id)
    }

    const result = await db.collection('whatsapp_campaigns').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId, status: 'draft' },
      { $set: set },
      { returnDocument: 'after' }
    )
    return result ? toDoc(result as Record<string, unknown>) : null
  },

  /**
   * Atomically transition a draft campaign to 'sending' and set recipientCount.
   * Returns the updated campaign, or null if not found / not in draft status.
   * This guard prevents double-send if the route is called twice.
   */
  async atomicStartSend(
    merchantId:     string,
    id:             string,
    recipientCount: number
  ): Promise<WhatsAppCampaignDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const result = await db.collection('whatsapp_campaigns').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId, status: 'draft' },
      { $set: { status: 'sending', recipientCount } },
      { returnDocument: 'after' }
    )
    return result ? toDoc(result as Record<string, unknown>) : null
  },

  /**
   * Finalize a campaign after fan-out completes.
   * Sets status='completed', records counts and sentAt timestamp.
   */
  async completeSend(
    id:           string,
    successCount: number,
    failCount:    number
  ): Promise<void> {
    if (!isValidObjectId(id)) return
    const db = await getDb()
    if (!db) return
    await db.collection('whatsapp_campaigns').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'completed', successCount, failCount, sentAt: new Date() } }
    )
  },
}
