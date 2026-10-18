import * as path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import { MongoClient } from 'mongodb'
import { existsSync, readFileSync } from 'fs'

async function migrate() {
  const uri    = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB ?? 'magharebit'

  if (!uri) {
    console.error('❌ MONGODB_URI not found — run test-mongodb.ts first')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  console.log('✅ Connected to:', db.databaseName)

  let total = 0

  // ── leads ────────────────────────────────────────────────────────────────────
  for (const [name, idField] of [['leads', 'id'], ['subscribers', 'phone'], ['callbacks', 'id']] as const) {
    const filePath = path.resolve(process.cwd(), 'data', `${name}.json`)
    if (!existsSync(filePath)) {
      console.log(`ℹ️  ${name}.json — not found, skipping`)
      continue
    }
    const raw   = readFileSync(filePath, 'utf-8').trim()
    const items = raw && raw !== '[]' ? JSON.parse(raw) : []
    if (items.length === 0) {
      console.log(`ℹ️  ${name}.json — empty, skipping`)
      continue
    }

    const col = db.collection(name)
    let inserted = 0, skipped = 0
    for (const item of items) {
      const exists = await col.findOne({ [idField]: item[idField] })
      if (exists) { skipped++; continue }
      await col.insertOne(item)
      inserted++
    }
    console.log(`✅ ${name}: ${inserted} migrated, ${skipped} skipped`)
    total += inserted
  }

  // ── licenses (legacy JSON → MongoDB) ─────────────────────────────────────────
  const licPath = path.resolve(process.cwd(), 'data', 'licenses.json')
  if (existsSync(licPath)) {
    const raw = readFileSync(licPath, 'utf-8').trim()
    if (raw && raw !== '{}') {
      let legacy: Array<{
        id: string; key: string; store: string;
        status: string; plan: string; activatedAt: string; expiresAt: string
      }> = []
      try {
        const parsed = JSON.parse(raw)
        legacy = Array.isArray(parsed) ? parsed : (parsed.licenses ?? [])
      } catch {
        console.log('⚠️  licenses.json parse error — skipping')
      }

      if (legacy.length > 0) {
        const col = db.collection('licenses')
        let inserted = 0, skipped = 0
        for (const l of legacy) {
          const exists = await col.findOne({ key: l.key })
          if (exists) { skipped++; continue }
          // Normalise legacy shape to new LicenseRecord shape
          await col.insertOne({
            id:             l.id,
            key:            l.key,
            merchantId:     '',          // legacy records have no merchantId
            storeName:      l.store,
            plan:           l.plan,
            durationMonths: 12,
            issuedAt:       new Date(l.activatedAt),
            expiresAt:      new Date(l.expiresAt),
            status:         l.status === 'suspended' ? 'revoked' : l.status,
          })
          inserted++
        }
        console.log(`✅ licenses: ${inserted} migrated, ${skipped} skipped`)
        total += inserted

        // Ensure indexes after first insert
        await col.createIndex({ key: 1 },        { unique: true })
        await col.createIndex({ merchantId: 1 })
        await col.createIndex({ status: 1 })
        await col.createIndex({ expiresAt: 1 })
        console.log('   indexes created on licenses collection')
      }
    }
  } else {
    console.log('ℹ️  licenses.json — not found, skipping')
  }

  // ── merchants: create indexes (collection may already have data) ─────────────
  await db.collection('merchants').createIndex({ phone: 1 }, { sparse: true })
  await db.collection('merchants').createIndex({ email: 1 }, { sparse: true })
  await db.collection('merchants').createIndex({ status: 1 })
  console.log('✅ merchants: indexes ensured')

  console.log(`\n🎉 Done — ${total} records migrated`)
  await client.close()
}

migrate()
