import { Client } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';

async function check() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("SET client_encoding = 'UTF8'");

    // Fix the 2 garbled rows by their actual UUIDs
    await client.query(
      "UPDATE stores SET name_ar = $1 WHERE store_id = '9db8e1d2-5c83-4836-8548-0fbd0e767088'",
      ['المتجر الرئيسي'],
    );
    console.log('Store fixed.');

    await client.query(
      "UPDATE products SET name_ar = $1 WHERE product_id = 'f0b70803-961c-4ca9-a6ba-4c596abc2d27'",
      ['طماطم اختبار'],
    );
    console.log('Product fixed.');

    // Verify
    const s = await client.query('SELECT store_id, name_ar FROM stores');
    console.log('\nStores now:', s.rows);
    const p = await client.query('SELECT product_id, name_ar, name_fr FROM products');
    console.log('\nProducts now:', p.rows);
    const st = await client.query('SELECT staff_id, name_ar FROM staff');
    console.log('\nStaff now:', st.rows);

  } finally {
    await client.end();
  }
}

check().catch(console.error);
