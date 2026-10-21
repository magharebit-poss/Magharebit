/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node preload script (CommonJS) */
﻿// Start the dev server with this stand-in (from apps/magharebit-web):
//   APP_DIR="$PWD" MONGODB_URI=mongodb://fake.invalid:27017/x \
//   NODE_OPTIONS="--require $PWD/scripts/admin-smoke/fake-mongo-patch.js" npx next dev -p 3020
// Test-only stand-in for MongoDB. Preloaded with NODE_OPTIONS=--require so the app's
// real repositories and routes run against an in-memory store. Not Mongo semantics:
// it implements only the operators the code under test uses.
const { createRequire } = require('module')
const appReq = createRequire(process.env.APP_DIR + '/package.json')
const mongodb = appReq('mongodb')
const { ObjectId } = mongodb

const store = new Map() // collection name -> array of docs
const uniques = new Map() // collection name -> Set of unique field names
const col = (n) => { if (!store.has(n)) store.set(n, []); return store.get(n) }

const eq = (a, b) => {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b)
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return a === b
}
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    const v = doc[k]
    if (cond && typeof cond === 'object' && !(cond instanceof ObjectId) && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, x]) => {
        if (op === '$gte') return v >= x
        if (op === '$lte') return v <= x
        if (op === '$lt') return v < x
        if (op === '$gt') return v > x
        if (op === '$ne') return !eq(v, x)
        if (op === '$exists') return (v !== undefined) === Boolean(x)
        if (op === '$in') return x.some((y) => eq(v, y))
        throw new Error('fake-mongo: unsupported operator ' + op)
      })
    }
    return eq(v, cond)
  })
}
function applyUpdate(doc, update) {
  for (const [op, fields] of Object.entries(update)) {
    if (op === '$set') Object.assign(doc, fields)
    else if (op === '$unset') for (const k of Object.keys(fields)) delete doc[k]
    else throw new Error('fake-mongo: unsupported update ' + op)
  }
}
const strip = (d, projection) => {
  if (!d) return d
  const c = { ...d }
  if (projection && projection._id === 0) delete c._id
  return c
}

function cursor(docs, projection) {
  let list = docs
  const c = {
    sort(spec) {
      const [k, dir] = Object.entries(spec)[0]
      list = [...list].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir)
      return c
    },
    skip(n) { list = list.slice(n); return c },
    limit(n) { list = list.slice(0, n); return c },
    async toArray() { return list.map((d) => strip(d, projection)) },
  }
  return c
}

function collection(name) {
  return {
    async createIndex(spec, opts) {
      if (opts && opts.unique) {
        if (!uniques.has(name)) uniques.set(name, new Set())
        Object.keys(spec).forEach((k) => uniques.get(name).add(k))
      }
      return 'ok'
    },
    async insertOne(doc) {
      for (const f of uniques.get(name) ?? []) {
        if (col(name).some((d) => d[f] === doc[f])) {
          const e = new Error('E11000 duplicate key'); e.code = 11000; throw e
        }
      }
      if (!doc._id) doc._id = new ObjectId()
      col(name).push(doc)
      return { insertedId: doc._id }
    },
    find(filter, opts) { return cursor(col(name).filter((d) => matches(d, filter)), opts && opts.projection) },
    async findOne(filter, opts) { return strip(col(name).find((d) => matches(d, filter)) ?? null, opts && opts.projection) },
    async countDocuments(filter) { return col(name).filter((d) => matches(d, filter)).length },
    async updateOne(filter, update) {
      const d = col(name).find((x) => matches(x, filter))
      if (d) applyUpdate(d, update)
      return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 }
    },
    async updateMany(filter, update) {
      const ds = col(name).filter((x) => matches(x, filter))
      ds.forEach((d) => applyUpdate(d, update))
      return { matchedCount: ds.length, modifiedCount: ds.length }
    },
    async findOneAndUpdate(filter, update, opts) {
      const d = col(name).find((x) => matches(x, filter))
      if (!d) return null
      const before = { ...d }
      applyUpdate(d, update)
      return opts && opts.returnDocument === 'after' ? { ...d } : before
    },
  }
}

const fakeDb = { collection }

// Seed one pending merchant (as a website signup would leave it).
col('merchants').push({
  _id: new ObjectId('64b7f0c2a1b2c3d4e5f60718'),
  phone: '212600000001',
  storeName: 'Epicerie Test',
  sector: 'epicerie',
  city: 'Casablanca',
  locale: 'fr',
  createdAt: new Date(),
  status: 'pending',
})

mongodb.MongoClient.prototype.connect = async function () { return this }
mongodb.MongoClient.prototype.db = function () { return fakeDb }
console.log('[fake-mongo] in-memory MongoDB stand-in active')

