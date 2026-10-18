import * as path from 'path'
import { config } from 'dotenv'

// Load .env.local FIRST — before anything reads process.env
config({ path: path.resolve(process.cwd(), '.env.local') })

import { MongoClient } from 'mongodb'

async function main() {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB ?? 'magharebit'

  console.log('ENV CHECK:')
  console.log('  MONGODB_URI:', uri ? `${uri.substring(0, 45)}...` : '❌ NOT SET')
  console.log('  MONGODB_DB:', dbName)
  console.log('  CWD:', process.cwd())
  console.log('  .env.local path:', path.resolve(process.cwd(), '.env.local'))
  console.log('')

  if (!uri) {
    console.error('❌ MONGODB_URI not found. Check .env.local exists at:', path.resolve(process.cwd(), '.env.local'))
    process.exit(1)
  }

  console.log('🔌 Connecting...')
  const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
  })

  try {
    await client.connect()
    const db = client.db(dbName)
    const cols = await db.listCollections().toArray()
    console.log('✅ Connected to:', db.databaseName)
    console.log('   Collections:', cols.length === 0 ? '(empty)' : cols.map(c => c.name).join(', '))

    await db.collection('_test').insertOne({ t: true, ts: new Date().toISOString() })
    console.log('✅ Write OK')
    await db.collection('_test').deleteMany({ t: true })
    console.log('✅ Cleanup OK')
    console.log('\n🎉 MongoDB Atlas verified')
  } catch (err: any) {
    console.error('❌ Failed:', err.message)
    if (err.message.includes('auth')) console.error('   → Check username/password in MONGODB_URI')
    if (err.message.includes('ENOTFOUND')) console.error('   → Check internet + Atlas IP whitelist')
    process.exit(1)
  } finally {
    await client.close()
  }
}

main()
