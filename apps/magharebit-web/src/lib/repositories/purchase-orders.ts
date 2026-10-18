/**
 * purchase-orders repository
 *
 * MongoDB collection: `purchase_orders`
 * Partition key: merchantId
 *
 * Lifecycle: draft → ordered → partial | received | cancelled
 *
 * The receive() method is the critical operation:
 *   - Validates PO status (must be draft/ordered/partial)
 *   - Caps incoming qty at remaining (qtyOrdered − qtyReceived) to prevent over-receive
 *   - Updates the PO document atomically via findOneAndUpdate
 *   - Increments stock for each received product via productsRepo.adjustStock
 *   - Sets status to 'received' when all lines are fully received, else 'partial'
 *
 * Stock updates and PO update are sequential, not wrapped in a MongoDB session.
 * This is acceptable for a single-merchant POS: the failure window is tiny, and
 * a re-receive attempt would be capped to the true remaining qty.
 */

import { Db, ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { productsRepo } from './products'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseOrderStatus =
  | 'draft'       // being assembled, not yet sent to supplier
  | 'ordered'     // sent to supplier, awaiting delivery
  | 'partial'     // some items received, more expected
  | 'received'    // all items fully received
  | 'cancelled'   // voided

export interface PurchaseOrderItem {
  productId:   string
  productName: string   // snapshot at order creation
  productPlu?: string
  qtyOrdered:  number
  qtyReceived: number   // running total across all receive calls
  unitCost:    number   // cost price (not sale price)
}

export interface PurchaseOrderDoc {
  id:           string
  merchantId:   string
  supplierId:   string
  supplierName: string  // snapshot at order creation
  status:       PurchaseOrderStatus
  items:        PurchaseOrderItem[]
  totalCost:    number   // sum(unitCost × qtyOrdered)
  notes?:       string
  expectedAt?:  Date     // optional expected delivery date
  createdAt:    Date
  updatedAt:    Date
}

export interface FindOrdersOptions {
  merchantId:  string
  supplierId?: string
  status?:     PurchaseOrderStatus
  page?:       number
  limit?:      number
}

export interface FindOrdersResult {
  orders: PurchaseOrderDoc[]
  total:  number
}

/** Items accepted by the receive endpoint */
export interface ReceiveItem {
  productId:  string
  qtyReceive: number   // qty being received in this call
}

// ── Statuses that still accept stock ─────────────────────────────────────────

const RECEIVABLE_STATUSES: PurchaseOrderStatus[] = ['draft', 'ordered', 'partial']

// ── Index management ──────────────────────────────────────────────────────────

let indexesCreated = false

async function ensureIndexes(db: Db) {
  if (indexesCreated) return
  const col = db.collection('purchase_orders')
  await Promise.all([
    col.createIndex({ merchantId: 1, createdAt: -1 }),
    col.createIndex({ merchantId: 1, supplierId: 1 }),
    col.createIndex({ merchantId: 1, status: 1 }),
  ])
  indexesCreated = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDoc(raw: Record<string, unknown>): PurchaseOrderDoc {
  const id = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id ?? '')
  const { _id: _removed, ...rest } = raw
  void _removed
  return { id, ...rest } as unknown as PurchaseOrderDoc
}

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id)
}

function calcTotalCost(items: PurchaseOrderItem[]): number {
  return Math.round(
    items.reduce((sum, i) => sum + i.unitCost * i.qtyOrdered, 0) * 100
  ) / 100
}

// ── Repository ────────────────────────────────────────────────────────────────

export const purchaseOrdersRepo = {

  async findAll(opts: FindOrdersOptions): Promise<FindOrdersResult> {
    const db = await getDb()
    if (!db) return { orders: [], total: 0 }
    await ensureIndexes(db)

    const { merchantId, supplierId, status, page = 1, limit = 50 } = opts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { merchantId }
    if (supplierId) filter.supplierId = supplierId
    if (status)     filter.status     = status

    const skip = (page - 1) * limit
    const col  = db.collection('purchase_orders')
    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])
    return {
      orders: docs.map(d => toDoc(d as Record<string, unknown>)),
      total,
    }
  },

  async findById(merchantId: string, id: string): Promise<PurchaseOrderDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null
    const doc = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id), merchantId,
    })
    return doc ? toDoc(doc as Record<string, unknown>) : null
  },

  async create(opts: {
    merchantId:   string
    supplierId:   string
    supplierName: string
    items:        Array<{
      productId:   string
      productName: string
      productPlu?: string
      qtyOrdered:  number
      unitCost:    number
    }>
    notes?:       string
    expectedAt?:  Date
  }): Promise<PurchaseOrderDoc> {
    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    const items: PurchaseOrderItem[] = opts.items.map(i => ({
      productId:   i.productId,
      productName: i.productName,
      productPlu:  i.productPlu,
      qtyOrdered:  i.qtyOrdered,
      qtyReceived: 0,
      unitCost:    i.unitCost,
    }))

    const now  = new Date()
    const doc  = {
      merchantId:   opts.merchantId,
      supplierId:   opts.supplierId,
      supplierName: opts.supplierName,
      status:       'draft' as PurchaseOrderStatus,
      items,
      totalCost:    calcTotalCost(items),
      notes:        opts.notes?.trim() || undefined,
      expectedAt:   opts.expectedAt    || undefined,
      createdAt:    now,
      updatedAt:    now,
    }
    const result = await db.collection('purchase_orders').insertOne(doc)
    return toDoc({ ...doc, _id: result.insertedId } as unknown as Record<string, unknown>)
  },

  /**
   * Update mutable fields on a purchase order.
   * Items, notes, expectedAt can be updated while status is 'draft' or 'ordered'.
   * Status can be advanced to 'ordered' or 'cancelled' (not directly to 'received'/'partial').
   */
  async update(
    merchantId: string,
    id:         string,
    data: Partial<{
      status:      PurchaseOrderStatus
      notes:       string
      expectedAt:  Date | null
    }>
  ): Promise<PurchaseOrderDoc | null> {
    if (!isValidObjectId(id)) return null
    const db = await getDb()
    if (!db) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}
    if (data.status     !== undefined) update.status     = data.status
    if (data.notes      !== undefined) update.notes      = data.notes?.trim() || undefined
    if (data.expectedAt !== undefined) update.expectedAt = data.expectedAt ?? undefined
    update.updatedAt = new Date()

    const result = await db.collection('purchase_orders').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId },
      { $set: update },
      { returnDocument: 'after' }
    )
    return result ? toDoc(result as unknown as Record<string, unknown>) : null
  },

  /**
   * Receive items from a purchase order.
   *
   * Production-safety rules:
   *   1. PO must exist and belong to this merchant.
   *   2. Status must be draft, ordered, or partial — not received or cancelled.
   *   3. For each incoming item: qtyReceive is capped at remaining (qtyOrdered − qtyReceived).
   *   4. Items not listed in the call are left unchanged (partial-receive semantics).
   *   5. PO document is updated atomically via findOneAndUpdate.
   *   6. Stock is then incremented per product via productsRepo.adjustStock.
   *
   * Returns the updated PO and a summary of stock changes.
   */
  async receive(
    merchantId: string,
    id:         string,
    incoming:   ReceiveItem[]
  ): Promise<{
    order:        PurchaseOrderDoc
    stockUpdates: Array<{ productId: string; productName: string; qty: number }>
  }> {
    if (!isValidObjectId(id)) throw new Error('invalid_id')

    const db = await getDb()
    if (!db) throw new Error('DB unavailable')
    await ensureIndexes(db)

    // ── Step 1: load and validate ──────────────────────────────────────────
    const existing = await this.findById(merchantId, id)
    if (!existing) throw new Error('not_found')
    if (!RECEIVABLE_STATUSES.includes(existing.status)) {
      throw new Error(`cannot_receive:${existing.status}`)
    }
    if (incoming.length === 0) throw new Error('items_required')

    // Build a lookup map from productId → current PO item
    const itemMap = new Map<string, PurchaseOrderItem>()
    for (const item of existing.items) itemMap.set(item.productId, item)

    // Validate all incoming productIds exist in this PO
    const stockChanges: Array<{ productId: string; productName: string; qty: number }> = []

    for (const inc of incoming) {
      const poItem = itemMap.get(inc.productId)
      if (!poItem) throw new Error(`product_not_in_order:${inc.productId}`)
      if (!Number.isInteger(inc.qtyReceive) || inc.qtyReceive <= 0) {
        throw new Error(`invalid_qty:${inc.productId}`)
      }
    }

    // ── Step 2: compute new item states ────────────────────────────────────
    const updatedItems: PurchaseOrderItem[] = existing.items.map(item => {
      const inc = incoming.find(i => i.productId === item.productId)
      if (!inc) return item  // not touched this call

      const remaining    = item.qtyOrdered - item.qtyReceived
      const actualReceive = Math.min(inc.qtyReceive, remaining)  // cap at remaining
      if (actualReceive <= 0) return item  // already fully received, skip

      stockChanges.push({
        productId:   item.productId,
        productName: item.productName,
        qty:         actualReceive,
      })

      return {
        ...item,
        qtyReceived: item.qtyReceived + actualReceive,
      }
    })

    if (stockChanges.length === 0) throw new Error('nothing_to_receive')

    // ── Step 3: determine new status ───────────────────────────────────────
    const allReceived = updatedItems.every(i => i.qtyReceived >= i.qtyOrdered)
    const newStatus: PurchaseOrderStatus = allReceived ? 'received' : 'partial'

    // ── Step 4: update PO document atomically ─────────────────────────────
    const now    = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setDoc: Record<string, any> = {
      items:     updatedItems,
      status:    newStatus,
      updatedAt: now,
    }
    if (allReceived) setDoc.receivedAt = now

    const raw = await db.collection('purchase_orders').findOneAndUpdate(
      { _id: new ObjectId(id), merchantId },
      { $set: setDoc },
      { returnDocument: 'after' }
    )
    if (!raw) throw new Error('update_failed')
    const order = toDoc(raw as unknown as Record<string, unknown>)

    // ── Step 5: increment stock for each received line ─────────────────────
    for (const change of stockChanges) {
      await productsRepo.adjustStock(
        merchantId,
        change.productId,
        +change.qty,
        'purchase',
        { note: `طلب شراء #${id.slice(-6)}` }
      )
    }

    return { order, stockUpdates: stockChanges }
  },
}
