# Admin API smoke test

41 checks: admin accounts and roles, audit capture (incl. `actorEmail`), approve/revoke, POS `validate`, immediate account disable. No WhatsApp message is sent (Green API is not configured in the test env).

Run from `apps/magharebit-web`. `ENV_FILE` points at a `.env.local` with `ADMIN_SECRET` and `NEXTAUTH_SECRET`.

## A. Real MongoDB (preferred)
```bash
docker run -d --name magharebit-test-mongo -p 127.0.0.1:27018:27017 mongo:7.0
# seed the pending merchant the test approves (also drops the test database)
node -e "const {createRequire}=require('module');const {MongoClient,ObjectId}=createRequire(process.cwd()+'/package.json')('mongodb');(async()=>{const c=new MongoClient('mongodb://127.0.0.1:27018');await c.connect();const db=c.db('magharebit_smoke');await db.dropDatabase();await db.collection('merchants').insertOne({_id:new ObjectId('64b7f0c2a1b2c3d4e5f60718'),phone:'212600000001',storeName:'Epicerie Test',sector:'epicerie',city:'Casablanca',locale:'fr',createdAt:new Date(),status:'pending'});await c.close()})()"
MONGODB_URI=mongodb://127.0.0.1:27018 MONGODB_DB=magharebit_smoke npx next dev -p 3021
# in another terminal:
BASE=http://localhost:3021 ENV_FILE=./.env.local node scripts/admin-smoke/smoke.mjs
docker rm -f magharebit-test-mongo
```
Last real-database result: 41 passed, 0 failed (MongoDB 7.0.45). The same run confirmed the indexes: `username_1` unique, `email_1` unique + sparse.

## B. No Docker: in-memory stand-in
`fake-mongo-patch.js` replaces the driver's connection with an in-memory store that implements only the operators the code uses (it is not MongoDB). Start command is in the file header (use the relative `--require` path: absolute paths with spaces break `NODE_OPTIONS`).

Always start a **fresh server** before a run; the test creates accounts and licenses and is not repeatable on the same data. Never run two copies against one server at once.
