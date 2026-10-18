import pg from 'pg';

const client = new pg.Client(
  process.env['DATABASE_URL'] ?? 'postgres://greengo:localdev@localhost:5432/greengo_dev',
);

async function run() {
  await client.connect();
  try {
    const r = await client.query(
      `UPDATE tenants
       SET business_type = 'cafe',
           feature_flags = $1
       WHERE id = '11111111-1111-1111-1111-111111111111'
       RETURNING id, business_type, feature_flags`,
      [JSON.stringify({ tables: true, kds: true, modifiers: true })],
    );
    if (r.rowCount === 0) {
      console.log('No row updated — tenant 11111111-... not found.');
    } else {
      console.log('Updated tenant:', r.rows[0]);
    }
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
