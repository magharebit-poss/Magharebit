import { Client } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';

async function verify() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");

  const p = await client.query(
    'SELECT plu_code, name_ar, name_fr FROM products WHERE plu_code IS NOT NULL ORDER BY plu_code LIMIT 10'
  );
  console.log('Products:\n', JSON.stringify(p.rows, null, 2));

  const st = await client.query('SELECT name_ar, role FROM staff ORDER BY name_ar');
  console.log('\nStaff:\n', JSON.stringify(st.rows, null, 2));

  const stores = await client.query('SELECT name_ar, name_fr FROM stores ORDER BY name_fr');
  console.log('\nStores:\n', JSON.stringify(stores.rows, null, 2));

  await client.end();
}
verify().catch(console.error);
