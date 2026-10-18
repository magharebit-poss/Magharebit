/**
 * reseed-arabic.ts — Repair double-encoded Arabic text in all tables.
 * Run after: npx tsx scripts/reseed-arabic.ts
 * Safe to run multiple times (idempotent UPDATEs).
 */
import { Client } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';

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

const SHIFT_1 = 'eeee0001-0001-0001-0001-000000000001';
const SHIFT_2 = 'eeee0001-0001-0001-0001-000000000002';
const SHIFT_3 = 'eeee0002-0002-0002-0002-000000000001';

async function reseed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected. Repairing Arabic text...\n');

  try {
    await client.query("SET client_encoding='UTF8'");
    await client.query('BEGIN');

    // ── Staff names ──────────────────────────────────────────────────────────
    console.log('Fixing staff...');
    const staffUpdates: [string, string][] = [
      [STAFF_CASHIER_1, 'فاطمة البوعزاوي'],
      [STAFF_CASHIER_2, 'يوسف المنصوري'],
      [STAFF_MANAGER_1, 'أحمد بنعلي'],
      [STAFF_CASHIER_3, 'سارة الإدريسي'],
      [STAFF_CASHIER_4, 'كريم الحسيني'],
      [STAFF_MANAGER_2, 'نادية العلوي'],
    ];
    for (const [id, name] of staffUpdates) {
      await client.query('UPDATE staff SET name_ar = $1 WHERE staff_id = $2', [name, id]);
    }

    // ── Stores ───────────────────────────────────────────────────────────────
    console.log('Fixing stores...');
    const storeUpdates: [string, string, string][] = [
      [STORE_1A, 'فرع المعاريف',     'شارع المسيرة الخضراء 45'],
      [STORE_1B, 'فرع أكدال',        'شارع الأمير مولاي عبد الله'],
      [STORE_2A, 'فرع عين الذئاب',   'بولفار دو لا كورنيش'],
      [STORE_2B, 'فرع الحي المحمدي', 'شارع محمد الخامس'],
    ];
    for (const [id, nameAr, address] of storeUpdates) {
      await client.query(
        'UPDATE stores SET name_ar = $1, address = $2 WHERE store_id = $3',
        [nameAr, address, id],
      );
    }

    // ── Registers ────────────────────────────────────────────────────────────
    console.log('Fixing registers...');
    const regUpdates: [string, string][] = [
      [REG_1A1, 'صندوق 1 — المعاريف'],
      [REG_1A2, 'صندوق 2 — المعاريف'],
      [REG_1B1, 'صندوق 1 — أكدال'],
      [REG_1B2, 'صندوق 2 — أكدال'],
      [REG_2A1, 'صندوق 1 — عين الذئاب'],
      [REG_2A2, 'صندوق 2 — عين الذئاب'],
      [REG_2B1, 'صندوق 1 — المحمدي'],
      [REG_2B2, 'صندوق 2 — المحمدي'],
    ];
    for (const [id, name] of regUpdates) {
      await client.query('UPDATE registers SET name = $1 WHERE register_id = $2', [name, id]);
    }

    // ── Shifts ───────────────────────────────────────────────────────────────
    console.log('Fixing shifts...');
    const shiftUpdates: [string, string][] = [
      [SHIFT_1, 'فاطمة البوعزاوي'],
      [SHIFT_2, 'يوسف المنصوري'],
      [SHIFT_3, 'سارة الإدريسي'],
    ];
    for (const [id, name] of shiftUpdates) {
      await client.query(
        'UPDATE shifts SET cashier_name_ar = $1 WHERE shift_id = $2',
        [name, id],
      );
    }

    // ── Ingredients ──────────────────────────────────────────────────────────
    console.log('Fixing ingredients...');
    const ingUpdates: [string, string][] = [
      ['dddd0001-0001-0001-0001-000000000001', 'برتقال'],
      ['dddd0001-0001-0001-0001-000000000002', 'ليمون'],
      ['dddd0001-0001-0001-0001-000000000003', 'سكر'],
      ['dddd0001-0001-0001-0001-000000000004', 'تفاح'],
      ['dddd0001-0001-0001-0001-000000000005', 'موز'],
      ['dddd0001-0001-0001-0001-000000000006', 'فراولة'],
      ['dddd0002-0002-0002-0002-000000000001', 'برتقال'],
      ['dddd0002-0002-0002-0002-000000000002', 'أفوكادو'],
      ['dddd0002-0002-0002-0002-000000000003', 'مانجو'],
      ['dddd0002-0002-0002-0002-000000000004', 'حليب'],
      ['dddd0002-0002-0002-0002-000000000005', 'عسل'],
      ['dddd0002-0002-0002-0002-000000000006', 'لوز'],
    ];
    for (const [id, name] of ingUpdates) {
      await client.query('UPDATE ingredients SET name_ar = $1 WHERE id = $2', [name, id]);
    }

    // ── Products (matched by plu_code) ────────────────────────────────────────
    console.log('Fixing products...');
    const productUpdates: [string, string][] = [
      ['P001', 'ماء معدني 0.5 لتر'],
      ['P002', 'ماء معدني 1.5 لتر'],
      ['P003', 'خبز تقليدي'],
      ['P004', 'حلوى مغربية'],
      ['P005', 'زيت زيتون 1 لتر'],
      ['W001', 'تفاح أحمر'],
      ['W002', 'موز'],
      ['W003', 'فراولة طازجة'],
      ['J001', 'عصير برتقال طازج'],
      ['J002', 'عصير ليمون بالنعناع'],
      ['J003', 'سلطة فواكه'],
      ['P101', 'ماء معدني سيدي علي'],
      ['P102', 'كيك شوكولا'],
      ['P103', 'مكسرات مشكلة'],
      ['P104', 'عسل طبيعي 250غ'],
      ['P105', 'زبدة لوز'],
      ['W101', 'أفوكادو'],
      ['W102', 'مانجو'],
      ['J101', 'عصير برتقال طبيعي'],
      ['J102', 'سموذي أفوكادو'],
      ['J103', 'سموذي مانجو'],
      ['S001', 'علب تعبئة صغيرة'],
      ['S002', 'شفاطات ورقية'],
      ['S101', 'أكواب ورقية'],
      ['S102', 'أغطية أكواب'],
    ];
    for (const [plu, nameAr] of productUpdates) {
      await client.query(
        'UPDATE products SET name_ar = $1 WHERE plu_code = $2',
        [nameAr, plu],
      );
    }

    // ── Tenant users ─────────────────────────────────────────────────────────
    console.log('Fixing tenant users...');
    await client.query(
      "UPDATE tenant_users SET name = $1 WHERE email = 'owner@fruitsdumaroc.ma'",
      ['محمد الفيلالي'],
    );
    await client.query(
      "UPDATE tenant_users SET name = $1 WHERE email = 'owner@juscasablanca.ma'",
      ['ليلى بنشقرون'],
    );

    // ── APK release notes ────────────────────────────────────────────────────
    console.log('Fixing APK release notes...');
    await client.query(
      "UPDATE apk_releases SET release_notes = $1 WHERE version = '1.0.0'",
      ['الإصدار الأول — Phase 1 MVP'],
    );

    await client.query('COMMIT');
    console.log('\n========================================');
    console.log('ARABIC REPAIR COMPLETE');
    console.log('========================================');

    // Verify
    const v1 = await client.query('SELECT name_ar FROM staff LIMIT 3');
    console.log('\nVerification — Staff name_ar:', v1.rows);
    const v2 = await client.query('SELECT name_ar FROM products WHERE plu_code = $1', ['J001']);
    console.log('Verification — Product J001 name_ar:', v2.rows);
    const v3 = await client.query('SELECT name_ar FROM stores LIMIT 2');
    console.log('Verification — Stores name_ar:', v3.rows);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ROLLBACK — error:', e);
    throw e;
  } finally {
    await client.end();
  }
}

reseed().catch(console.error);
