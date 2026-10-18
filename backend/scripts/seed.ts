/**
 * seed.ts — Populates the GreenGo staging/dev database with realistic mock data.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@localhost:5432/greengo npx tsx backend/scripts/seed.ts
 *
 * Creates:
 *   - 2 tenants (Fruits du Maroc, Jus Casablanca)
 *   - 4 stores across both tenants
 *   - 8 registers (2 per store)
 *   - 6 staff members (cashiers + managers)
 *   - 25 products (BOM + non-BOM + weighted)
 *   - 12 ingredients with lots and backend stock
 *   - 2 license keys (active)
 *   - Heartbeats, shifts, sample transactions, waste records
 *   - 1 admin user (admin@greengo.io / hashed)
 *
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING.
 */

import { Client } from 'pg';
import { createHash, randomUUID } from 'crypto';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('ERROR: Set DATABASE_URL environment variable');
  process.exit(1);
}

// ─── Fixed UUIDs for deterministic seeding ────────────────────────────────────

const TENANT_1 = '11111111-1111-1111-1111-111111111111';
const TENANT_2 = '22222222-2222-2222-2222-222222222222';

const STORE_1A = 'aaaa1111-0001-0001-0001-000000000001';
const STORE_1B = 'aaaa1111-0001-0001-0001-000000000002';
const STORE_2A = 'aaaa2222-0002-0002-0002-000000000001';
const STORE_2B = 'aaaa2222-0002-0002-0002-000000000002';

const REG_1A1 = 'bbbb1111-0001-0001-0001-000000000001';
const REG_1A2 = 'bbbb1111-0001-0001-0001-000000000002';
const REG_1B1 = 'bbbb1111-0001-0001-0002-000000000001';
const REG_1B2 = 'bbbb1111-0001-0001-0002-000000000002';
const REG_2A1 = 'bbbb2222-0002-0002-0001-000000000001';
const REG_2A2 = 'bbbb2222-0002-0002-0001-000000000002';
const REG_2B1 = 'bbbb2222-0002-0002-0002-000000000001';
const REG_2B2 = 'bbbb2222-0002-0002-0002-000000000002';

const STAFF_CASHIER_1 = 'cccc0001-0001-0001-0001-000000000001';
const STAFF_CASHIER_2 = 'cccc0001-0001-0001-0001-000000000002';
const STAFF_MANAGER_1 = 'cccc0001-0001-0001-0001-000000000003';
const STAFF_CASHIER_3 = 'cccc0002-0002-0002-0002-000000000001';
const STAFF_CASHIER_4 = 'cccc0002-0002-0002-0002-000000000002';
const STAFF_MANAGER_2 = 'cccc0002-0002-0002-0002-000000000003';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function minsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

async function seed(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  // Force UTF-8 session encoding so Arabic strings are stored correctly.
  await client.query("SET client_encoding = 'UTF8'");
  console.log('Connected to database. Seeding...\n');

  try {
    // ── UoM Conversions ─────────────────────────────────────────────────────
    console.log('Seeding UoM conversions...');
    await client.query(`
      INSERT INTO uom_conversions (id, from_uom, to_uom, factor, family, density) VALUES
        (gen_random_uuid(), 'kg', 'g', 1000, 'weight', NULL),
        (gen_random_uuid(), 'g', 'kg', 0.001, 'weight', NULL),
        (gen_random_uuid(), 'l', 'ml', 1000, 'volume', NULL),
        (gen_random_uuid(), 'ml', 'l', 0.001, 'volume', NULL),
        (gen_random_uuid(), 'kg', 'ml', 1000, 'cross', 1.0),
        (gen_random_uuid(), 'carton', 'unit', 24, 'count', NULL)
      ON CONFLICT DO NOTHING
    `);

    // ── Tenants ─────────────────────────────────────────────────────────────
    console.log('Seeding tenants...');
    await client.query(`
      INSERT INTO tenants (id, name, slug, status, country) VALUES
        ('${TENANT_1}', 'Fruits du Maroc', 'fruits-du-maroc', 'active', 'Morocco'),
        ('${TENANT_2}', 'Jus Casablanca', 'jus-casablanca', 'active', 'Morocco')
      ON CONFLICT (id) DO NOTHING
    `);

    // ── Stores ──────────────────────────────────────────────────────────────
    console.log('Seeding stores...');
    await client.query(`
      INSERT INTO stores (store_id, tenant_id, name_ar, name_fr, address, city) VALUES
        ('${STORE_1A}', '${TENANT_1}', 'فرع المعاريف',     'Maarif Branch',      'شارع المسيرة الخضراء 45', 'Casablanca'),
        ('${STORE_1B}', '${TENANT_1}', 'فرع أكدال',        'Agdal Branch',       'شارع الأمير مولاي عبد الله', 'Rabat'),
        ('${STORE_2A}', '${TENANT_2}', 'فرع عين الذئاب',   'Ain Diab Branch',    'بولفار دو لا كورنيش',    'Casablanca'),
        ('${STORE_2B}', '${TENANT_2}', 'فرع الحي المحمدي', 'Hay Mohammadi Branch','شارع محمد الخامس',        'Casablanca')
      ON CONFLICT (store_id) DO NOTHING
    `);

    // ── Registers ───────────────────────────────────────────────────────────
    console.log('Seeding registers...');
    await client.query(`
      INSERT INTO registers (register_id, store_id, tenant_id, name, device_id, status) VALUES
        ('${REG_1A1}', '${STORE_1A}', '${TENANT_1}', 'صندوق 1 — المعاريف', 'ANDROID_1A1', 'active'),
        ('${REG_1A2}', '${STORE_1A}', '${TENANT_1}', 'صندوق 2 — المعاريف', 'ANDROID_1A2', 'active'),
        ('${REG_1B1}', '${STORE_1B}', '${TENANT_1}', 'صندوق 1 — أكدال',    'ANDROID_1B1', 'active'),
        ('${REG_1B2}', '${STORE_1B}', '${TENANT_1}', 'صندوق 2 — أكدال',    'ANDROID_1B2', 'maintenance'),
        ('${REG_2A1}', '${STORE_2A}', '${TENANT_2}', 'صندوق 1 — عين الذئاب','ANDROID_2A1', 'active'),
        ('${REG_2A2}', '${STORE_2A}', '${TENANT_2}', 'صندوق 2 — عين الذئاب','ANDROID_2A2', 'active'),
        ('${REG_2B1}', '${STORE_2B}', '${TENANT_2}', 'صندوق 1 — المحمدي',  'ANDROID_2B1', 'active'),
        ('${REG_2B2}', '${STORE_2B}', '${TENANT_2}', 'صندوق 2 — المحمدي',  'ANDROID_2B2', 'inactive')
      ON CONFLICT (register_id) DO NOTHING
    `);

    // ── Staff ───────────────────────────────────────────────────────────────
    console.log('Seeding staff...');
    await client.query(`
      INSERT INTO staff (staff_id, tenant_id, name_ar, name_fr, role, pin_hash) VALUES
        ('${STAFF_CASHIER_1}', '${TENANT_1}', 'فاطمة البوعزاوي', 'Fatima Bouazzaoui', 'CASHIER',    '${sha256("1234")}'),
        ('${STAFF_CASHIER_2}', '${TENANT_1}', 'يوسف المنصوري',   'Youssef Mansouri',  'CASHIER',    '${sha256("5678")}'),
        ('${STAFF_MANAGER_1}', '${TENANT_1}', 'أحمد بنعلي',      'Ahmed Benali',      'MANAGER',    '${sha256("9999")}'),
        ('${STAFF_CASHIER_3}', '${TENANT_2}', 'سارة الإدريسي',   'Sara Idrissi',      'CASHIER',    '${sha256("1111")}'),
        ('${STAFF_CASHIER_4}', '${TENANT_2}', 'كريم الحسيني',    'Karim Hassini',     'CASHIER',    '${sha256("2222")}'),
        ('${STAFF_MANAGER_2}', '${TENANT_2}', 'نادية العلوي',    'Nadia Alaoui',      'MANAGER',    '${sha256("8888")}')
      ON CONFLICT (staff_id) DO NOTHING
    `);

    // ── Ingredients ─────────────────────────────────────────────────────────
    console.log('Seeding ingredients...');
    const ingredients = [
      { id: 'dddd0001-0001-0001-0001-000000000001', t: TENANT_1, ar: 'برتقال',       fr: 'Oranges',   uom: 'kg', yield: 42.0 },
      { id: 'dddd0001-0001-0001-0001-000000000002', t: TENANT_1, ar: 'ليمون',        fr: 'Lemons',    uom: 'kg', yield: 38.0 },
      { id: 'dddd0001-0001-0001-0001-000000000003', t: TENANT_1, ar: 'سكر',          fr: 'Sugar',     uom: 'kg', yield: 100.0 },
      { id: 'dddd0001-0001-0001-0001-000000000004', t: TENANT_1, ar: 'تفاح',         fr: 'Apples',    uom: 'kg', yield: 85.0 },
      { id: 'dddd0001-0001-0001-0001-000000000005', t: TENANT_1, ar: 'موز',          fr: 'Bananas',   uom: 'kg', yield: 65.0 },
      { id: 'dddd0001-0001-0001-0001-000000000006', t: TENANT_1, ar: 'فراولة',       fr: 'Strawberries', uom: 'kg', yield: 90.0 },
      { id: 'dddd0002-0002-0002-0002-000000000001', t: TENANT_2, ar: 'برتقال',       fr: 'Oranges',   uom: 'kg', yield: 40.0 },
      { id: 'dddd0002-0002-0002-0002-000000000002', t: TENANT_2, ar: 'أفوكادو',      fr: 'Avocado',   uom: 'kg', yield: 55.0 },
      { id: 'dddd0002-0002-0002-0002-000000000003', t: TENANT_2, ar: 'مانجو',        fr: 'Mango',     uom: 'kg', yield: 60.0 },
      { id: 'dddd0002-0002-0002-0002-000000000004', t: TENANT_2, ar: 'حليب',         fr: 'Milk',      uom: 'l',  yield: 100.0 },
      { id: 'dddd0002-0002-0002-0002-000000000005', t: TENANT_2, ar: 'عسل',          fr: 'Honey',     uom: 'kg', yield: 100.0 },
      { id: 'dddd0002-0002-0002-0002-000000000006', t: TENANT_2, ar: 'لوز',          fr: 'Almonds',   uom: 'kg', yield: 95.0 },
    ];
    for (const ing of ingredients) {
      await client.query(
        `INSERT INTO ingredients (id, tenant_id, name_ar, name_fr, storage_uom, nominal_yield_pct)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [ing.id, ing.t, ing.ar, ing.fr, ing.uom, ing.yield],
      );
    }

    // ── Backend Stock ───────────────────────────────────────────────────────
    console.log('Seeding backend stock...');
    for (const ing of ingredients) {
      const stock = 5000 + Math.floor(Math.random() * 15000);
      await client.query(
        `INSERT INTO backend_stock (ingredient_id, tenant_id, quantity_remaining_grams)
         VALUES ($1, $2, $3) ON CONFLICT (ingredient_id, tenant_id) DO NOTHING`,
        [ing.id, ing.t, stock],
      );
    }

    // ── Ingredient Lots ─────────────────────────────────────────────────────
    console.log('Seeding ingredient lots...');
    for (const ing of ingredients) {
      const qty = 8000 + Math.floor(Math.random() * 12000);
      await client.query(
        `INSERT INTO ingredient_lots (lot_id, ingredient_id, tenant_id, received_at,
          nominal_yield_pct, quantity_received_grams, quantity_remaining_grams, state, activated_at)
         VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '3 days', $3, $4, $5, 'ACTIVE', NOW() - INTERVAL '3 days')
         ON CONFLICT (lot_id) DO NOTHING`,
        [ing.id, ing.t, ing.yield, qty, qty * 0.7],
      );
    }

    // ── Products ────────────────────────────────────────────────────────────
    console.log('Seeding products...');
    const products = [
      // Tenant 1 — non-BOM
      { t: TENANT_1, ar: 'ماء معدني 0.5 لتر', fr: 'Water 0.5L',    cat: 'beverages', price: 500,  bom: false, w: false, plu: 'P001', bc: '6111111000001' },
      { t: TENANT_1, ar: 'ماء معدني 1.5 لتر', fr: 'Water 1.5L',    cat: 'beverages', price: 800,  bom: false, w: false, plu: 'P002', bc: '6111111000002' },
      { t: TENANT_1, ar: 'خبز تقليدي',        fr: 'Traditional Bread', cat: 'bakery', price: 150,  bom: false, w: false, plu: 'P003', bc: '6111111000003' },
      { t: TENANT_1, ar: 'حلوى مغربية',       fr: 'Moroccan Pastry',  cat: 'bakery',  price: 2500, bom: false, w: false, plu: 'P004', bc: '6111111000004' },
      { t: TENANT_1, ar: 'زيت زيتون 1 لتر',   fr: 'Olive Oil 1L',    cat: 'grocery', price: 6000, bom: false, w: false, plu: 'P005', bc: '6111111000005' },
      // Tenant 1 — weighted
      { t: TENANT_1, ar: 'تفاح أحمر',         fr: 'Red Apples',      cat: 'produce', price: 2500, bom: false, w: true,  plu: 'W001', bc: '2100001000007' },
      { t: TENANT_1, ar: 'موز',               fr: 'Bananas',         cat: 'produce', price: 1800, bom: false, w: true,  plu: 'W002', bc: '2100002000004' },
      { t: TENANT_1, ar: 'فراولة طازجة',      fr: 'Fresh Strawberries', cat: 'produce', price: 4000, bom: false, w: true, plu: 'W003', bc: '2100003000001' },
      // Tenant 1 — BOM
      { t: TENANT_1, ar: 'عصير برتقال طازج',  fr: 'Fresh Orange Juice', cat: 'juices',  price: 2000, bom: true, w: false, plu: 'J001', bc: '6111111000010' },
      { t: TENANT_1, ar: 'عصير ليمون بالنعناع', fr: 'Lemon Mint Juice',  cat: 'juices',  price: 2500, bom: true, w: false, plu: 'J002', bc: '6111111000011' },
      { t: TENANT_1, ar: 'سلطة فواكه',        fr: 'Fruit Salad',      cat: 'prepared', price: 3500, bom: true, w: false, plu: 'J003', bc: '6111111000012' },
      // Tenant 2 — non-BOM
      { t: TENANT_2, ar: 'ماء معدني سيدي علي', fr: 'Sidi Ali Water',   cat: 'beverages', price: 500,  bom: false, w: false, plu: 'P101', bc: '6222222000001' },
      { t: TENANT_2, ar: 'كيك شوكولا',        fr: 'Chocolate Cake',   cat: 'bakery',    price: 3500, bom: false, w: false, plu: 'P102', bc: '6222222000002' },
      { t: TENANT_2, ar: 'مكسرات مشكلة',      fr: 'Mixed Nuts',       cat: 'snacks',    price: 5000, bom: false, w: false, plu: 'P103', bc: '6222222000003' },
      { t: TENANT_2, ar: 'عسل طبيعي 250غ',    fr: 'Natural Honey 250g', cat: 'grocery', price: 4500, bom: false, w: false, plu: 'P104', bc: '6222222000004' },
      { t: TENANT_2, ar: 'زبدة لوز',          fr: 'Almond Butter',     cat: 'grocery', price: 7000, bom: false, w: false, plu: 'P105', bc: '6222222000005' },
      // Tenant 2 — weighted
      { t: TENANT_2, ar: 'أفوكادو',           fr: 'Avocado',          cat: 'produce', price: 6000, bom: false, w: true, plu: 'W101', bc: '2200001000003' },
      { t: TENANT_2, ar: 'مانجو',             fr: 'Mango',            cat: 'produce', price: 5000, bom: false, w: true, plu: 'W102', bc: '2200002000009' },
      // Tenant 2 — BOM
      { t: TENANT_2, ar: 'عصير برتقال طبيعي',  fr: 'Natural OJ',       cat: 'juices', price: 2000, bom: true, w: false, plu: 'J101', bc: '6222222000010' },
      { t: TENANT_2, ar: 'سموذي أفوكادو',     fr: 'Avocado Smoothie', cat: 'juices',  price: 3500, bom: true, w: false, plu: 'J102', bc: '6222222000011' },
      { t: TENANT_2, ar: 'سموذي مانجو',       fr: 'Mango Smoothie',   cat: 'juices', price: 3000, bom: true, w: false, plu: 'J103', bc: '6222222000012' },
      // Extra non-BOM for both tenants
      { t: TENANT_1, ar: 'علب تعبئة صغيرة',   fr: 'Small Containers', cat: 'supplies', price: 200,  bom: false, w: false, plu: 'S001', bc: '6111111000020' },
      { t: TENANT_1, ar: 'شفاطات ورقية',      fr: 'Paper Straws',     cat: 'supplies', price: 100,  bom: false, w: false, plu: 'S002', bc: '6111111000021' },
      { t: TENANT_2, ar: 'أكواب ورقية',       fr: 'Paper Cups',       cat: 'supplies', price: 150,  bom: false, w: false, plu: 'S101', bc: '6222222000020' },
      { t: TENANT_2, ar: 'أغطية أكواب',       fr: 'Cup Lids',         cat: 'supplies', price: 100,  bom: false, w: false, plu: 'S102', bc: '6222222000021' },
    ];
    for (const p of products) {
      await client.query(
        `INSERT INTO products (product_id, tenant_id, plu_code, barcode, name_ar, name_fr,
          category, price_cents, is_bom, is_weighted, uom)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [p.t, p.plu, p.bc, p.ar, p.fr, p.cat, p.price, p.bom, p.w, p.w ? 'kg' : 'unit'],
      );
    }

    // ── License Keys ────────────────────────────────────────────────────────
    console.log('Seeding license keys...');
    await client.query(`
      INSERT INTO license_keys (license_key_id, key_string, tenant_id, status, binding_device_id,
        bound_at, activated_at, expires_at, subscription_tier, created_by)
      VALUES
        (gen_random_uuid(), 'GGPO-111111-TESTKEY1-AB01', '${TENANT_1}', 'active', 'ANDROID_1A1',
         NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days',
         NOW() + INTERVAL '335 days', 'annual', '${TENANT_1}'),
        (gen_random_uuid(), 'GGPO-222222-TESTKEY2-CD02', '${TENANT_2}', 'active', 'ANDROID_2A1',
         NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days',
         NOW() + INTERVAL '75 days', 'quarterly', '${TENANT_2}')
      ON CONFLICT DO NOTHING
    `);

    // ── Tenant Users ────────────────────────────────────────────────────────
    console.log('Seeding tenant users...');
    await client.query(`
      INSERT INTO tenant_users (user_id, tenant_id, email, name, role) VALUES
        (gen_random_uuid(), '${TENANT_1}', 'owner@fruitsdumaroc.ma', 'محمد الفيلالي',  'TENANT_OWNER'),
        (gen_random_uuid(), '${TENANT_2}', 'owner@juscasablanca.ma', 'ليلى بنشقرون', 'TENANT_OWNER')
      ON CONFLICT DO NOTHING
    `);

    // ── Admin Users ─────────────────────────────────────────────────────────
    console.log('Seeding admin users...');
    // Password: "admin123" — for dev/staging only. Never use in production.
    const adminPasswordHash = sha256('admin123');
    await client.query(`
      INSERT INTO admin_users (admin_id, email, name, password_hash, role, totp_enabled) VALUES
        (gen_random_uuid(), 'admin@greengo.io', 'Super Admin', '${adminPasswordHash}', 'SUPER_ADMIN', false),
        (gen_random_uuid(), 'support@greengo.io', 'Support Agent', '${sha256("support123")}', 'SUPPORT_AGENT', false)
      ON CONFLICT (email) DO NOTHING
    `);

    // ── Register Heartbeats ─────────────────────────────────────────────────
    console.log('Seeding register heartbeats...');
    const heartbeats = [
      { reg: REG_1A1, t: TENANT_1, mins: 2,  scale: 'connected',    printer: 'connected' },
      { reg: REG_1A2, t: TENANT_1, mins: 3,  scale: 'connected',    printer: 'connected' },
      { reg: REG_1B1, t: TENANT_1, mins: 1,  scale: 'disconnected', printer: 'connected' },
      { reg: REG_1B2, t: TENANT_1, mins: 120, scale: 'disconnected', printer: 'disconnected' },
      { reg: REG_2A1, t: TENANT_2, mins: 4,  scale: 'connected',    printer: 'connected' },
      { reg: REG_2A2, t: TENANT_2, mins: 1,  scale: 'connected',    printer: 'disconnected' },
      { reg: REG_2B1, t: TENANT_2, mins: 8,  scale: 'connected',    printer: 'connected' },
      { reg: REG_2B2, t: TENANT_2, mins: 300, scale: 'disconnected', printer: 'disconnected' },
    ];
    for (const hb of heartbeats) {
      await client.query(
        `INSERT INTO register_heartbeats (register_id, tenant_id, last_seen, scale_status, printer_status, updated_at)
         VALUES ($1, $2, NOW() - INTERVAL '${hb.mins} minutes', $3, $4, NOW() - INTERVAL '${hb.mins} minutes')
         ON CONFLICT (register_id) DO UPDATE SET
           last_seen = EXCLUDED.last_seen,
           scale_status = EXCLUDED.scale_status,
           printer_status = EXCLUDED.printer_status,
           updated_at = EXCLUDED.updated_at`,
        [hb.reg, hb.t, hb.scale, hb.printer],
      );
    }

    // ── Shifts (recent) ─────────────────────────────────────────────────────
    console.log('Seeding shifts...');
    const SHIFT_1 = 'eeee0001-0001-0001-0001-000000000001';
    const SHIFT_2 = 'eeee0001-0001-0001-0001-000000000002';
    const SHIFT_3 = 'eeee0002-0002-0002-0002-000000000001';
    await client.query(`
      INSERT INTO shifts (shift_id, tenant_id, register_id, cashier_id, opened_at, status, opening_float,
        total_sales_piastres, cashier_name_ar)
      VALUES
        ('${SHIFT_1}', '${TENANT_1}', '${REG_1A1}', '${STAFF_CASHIER_1}',
         NOW() - INTERVAL '3 hours', 'open', 50000, 125000, 'فاطمة البوعزاوي'),
        ('${SHIFT_2}', '${TENANT_1}', '${REG_1B1}', '${STAFF_CASHIER_2}',
         NOW() - INTERVAL '1 hour', 'open', 30000, 45000, 'يوسف المنصوري'),
        ('${SHIFT_3}', '${TENANT_2}', '${REG_2A1}', '${STAFF_CASHIER_3}',
         NOW() - INTERVAL '5 hours', 'open', 40000, 230000, 'سارة الإدريسي')
      ON CONFLICT (shift_id) DO NOTHING
    `);

    // ── Allocated Stock ─────────────────────────────────────────────────────
    console.log('Seeding allocated stock...');
    const t1Ingredients = ingredients.filter((i) => i.t === TENANT_1);
    const t2Ingredients = ingredients.filter((i) => i.t === TENANT_2);
    const t1Registers = [REG_1A1, REG_1A2, REG_1B1, REG_1B2];
    const t2Registers = [REG_2A1, REG_2A2, REG_2B1, REG_2B2];
    for (const reg of t1Registers) {
      for (const ing of t1Ingredients) {
        const alloc = 1000 + Math.floor(Math.random() * 3000);
        await client.query(
          `INSERT INTO allocated_stock (register_id, ingredient_id, tenant_id, allocated_grams)
           VALUES ($1, $2, $3, $4) ON CONFLICT (register_id, ingredient_id) DO NOTHING`,
          [reg, ing.id, TENANT_1, alloc],
        );
      }
    }
    for (const reg of t2Registers) {
      for (const ing of t2Ingredients) {
        const alloc = 1000 + Math.floor(Math.random() * 3000);
        await client.query(
          `INSERT INTO allocated_stock (register_id, ingredient_id, tenant_id, allocated_grams)
           VALUES ($1, $2, $3, $4) ON CONFLICT (register_id, ingredient_id) DO NOTHING`,
          [reg, ing.id, TENANT_2, alloc],
        );
      }
    }

    // ── Sample Transactions ─────────────────────────────────────────────────
    console.log('Seeding sample transactions...');
    for (let i = 0; i < 15; i++) {
      const isT1 = i < 8;
      const shift = isT1 ? SHIFT_1 : SHIFT_3;
      const reg = isT1 ? REG_1A1 : REG_2A1;
      const tenant = isT1 ? TENANT_1 : TENANT_2;
      const cashier = isT1 ? STAFF_CASHIER_1 : STAFF_CASHIER_3;
      const amount = 1500 + Math.floor(Math.random() * 8000);
      const methods = ['cash', 'cash', 'cash', 'card', 'lana'] as const;
      const method = methods[i % methods.length];
      await client.query(
        `INSERT INTO transactions (transaction_id, tenant_id, register_id, shift_id, cashier_id,
          items, total_amount_cents, payment_method, client_timestamp)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, '[]', $5, $6, NOW() - INTERVAL '${10 + i * 15} minutes')
         ON CONFLICT DO NOTHING`,
        [tenant, reg, shift, cashier, amount, method],
      );
    }

    // ── Processed Batches (for sync stats) ──────────────────────────────────
    console.log('Seeding processed batches...');
    const allRegs = [REG_1A1, REG_1A2, REG_1B1, REG_2A1, REG_2A2, REG_2B1];
    const tenantForReg: Record<string, string> = {
      [REG_1A1]: TENANT_1, [REG_1A2]: TENANT_1, [REG_1B1]: TENANT_1,
      [REG_2A1]: TENANT_2, [REG_2A2]: TENANT_2, [REG_2B1]: TENANT_2,
    };
    for (const reg of allRegs) {
      const total = 80 + Math.floor(Math.random() * 40);
      const accepted = total - Math.floor(Math.random() * 2); // 99-100% success
      await client.query(
        `INSERT INTO processed_batches (batch_id, register_id, tenant_id, submitted_at, processed_at,
          response_json, deduction_count)
         VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours',
          '{"accepted": ${accepted}, "total": ${total}}', $3)
         ON CONFLICT DO NOTHING`,
        [reg, tenantForReg[reg], total],
      );
    }

    // ── Audit Log (hardware errors + floor exceeded) ────────────────────────
    console.log('Seeding audit log entries...');
    // Hardware errors
    const hwErrors = [
      { reg: REG_1B1, t: TENANT_1, dev: 'SCALE', code: 'BLE_TIMEOUT', rec: true, mins: 45 },
      { reg: REG_2A2, t: TENANT_2, dev: 'PRINTER', code: 'PAPER_OUT', rec: true, mins: 120 },
      { reg: REG_1A1, t: TENANT_1, dev: 'PRINTER', code: 'OVERHEAT', rec: false, mins: 200 },
      { reg: REG_2B1, t: TENANT_2, dev: 'SCALE', code: 'CALIBRATION_ERROR', rec: true, mins: 30 },
      { reg: REG_1A2, t: TENANT_1, dev: 'SCANNER', code: 'USB_DISCONNECT', rec: true, mins: 15 },
    ];
    for (const e of hwErrors) {
      await client.query(
        `INSERT INTO audit_log (tenant_id, register_id, event_type, action, metadata, created_at)
         VALUES ($1, $2, 'HARDWARE_ERROR', 'HARDWARE_ERROR',
          '{"device": "${e.dev}", "code": "${e.code}", "recoverable": ${e.rec}}',
          NOW() - INTERVAL '${e.mins} minutes')`,
        [e.t, e.reg],
      );
    }
    // Floor exceeded
    await client.query(
      `INSERT INTO audit_log (tenant_id, register_id, event_type, action, metadata, created_at)
       VALUES
         ('${TENANT_1}', '${REG_1A1}', 'FLOOR_EXCEEDED', 'OFFLINE_FLOOR_EXCEEDED',
          '{"attemptedAmountCents": 150000, "floorLimitCents": 100000, "shiftId": "${SHIFT_1}"}',
          NOW() - INTERVAL '90 minutes'),
         ('${TENANT_2}', '${REG_2A1}', 'FLOOR_EXCEEDED', 'OFFLINE_FLOOR_EXCEEDED',
          '{"attemptedAmountCents": 200000, "floorLimitCents": 100000, "shiftId": "${SHIFT_3}"}',
          NOW() - INTERVAL '45 minutes')`
    );

    // ── Waste Records ───────────────────────────────────────────────────────
    console.log('Seeding waste records...');
    let prevHash = SHIFT_1;
    const wasteReasons = ['EXPIRED', 'DAMAGED', 'PREPARATION'] as const;
    for (let i = 0; i < 3; i++) {
      const ing = t1Ingredients[i];
      const recordData = JSON.stringify({
        id: `waste-${i}`,
        ingredientId: ing.id,
        quantityGrams: 200 + i * 100,
        reasonCode: wasteReasons[i],
        clientTimestamp: minsAgo(60 - i * 20),
      });
      const chainHash = createHash('sha256').update(prevHash + recordData).digest('hex');
      await client.query(
        `INSERT INTO waste_records (waste_record_id, tenant_id, register_id, ingredient_id,
          weight_grams, reason_code, recorded_by, approved_by, manager_pin_verified_at,
          client_timestamp, source_type, chain_hash)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), $8, 'manual', $9)`,
        [TENANT_1, REG_1A1, ing.id, 200 + i * 100, wasteReasons[i],
         STAFF_CASHIER_1, STAFF_MANAGER_1, minsAgo(60 - i * 20), chainHash],
      );
      prevHash = chainHash;
    }

    // ── APK Release ─────────────────────────────────────────────────────────
    console.log('Seeding APK release...');
    await client.query(`
      INSERT INTO apk_releases (version, s3_key, sha256_hash, file_size_bytes, is_current, release_notes)
      VALUES ('1.0.0', 'releases/greengo-pos-1.0.0.apk',
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2', 45000000,
        true, 'الإصدار الأول — Phase 1 MVP')
      ON CONFLICT (version) DO NOTHING
    `);

    console.log('\n========================================');
    console.log('SEED COMPLETE');
    console.log('========================================');
    console.log(`Tenants:      2 (Fruits du Maroc, Jus Casablanca)`);
    console.log(`Stores:       4`);
    console.log(`Registers:    8 (6 active, 1 maintenance, 1 inactive)`);
    console.log(`Staff:        6 (4 cashiers, 2 managers)`);
    console.log(`Ingredients:  12`);
    console.log(`Products:     25 (6 BOM, 5 weighted, 14 standard)`);
    console.log(`Licenses:     2 (active)`);
    console.log(`Admin users:  2 (admin@greengo.io / support@greengo.io)`);
    console.log(`Open shifts:  3`);
    console.log(`Transactions: 15`);
    console.log(`Waste records: 3 (hash-chained)`);
    console.log(`Audit events: 7 (5 HW errors, 2 floor exceeded)`);
    console.log(`APK release:  1 (v1.0.0)`);
    console.log('========================================\n');

  } finally {
    await client.end();
  }
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
