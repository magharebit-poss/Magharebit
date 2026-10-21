// verify-arabic.ts — READ-ONLY check for Arabic/French text stored double-encoded
// (UTF-8 bytes read as Windows-1252 and saved again, e.g. "Ø®Ø¶Ø±").
//
//   npx tsx scripts/verify-arabic.ts
//
// Prints a sample of the seeded Arabic data, then scans EVERY text column of every
// public table. Exit code 0 = clean, 1 = at least one double-encoded value found.
// It never writes: the session is forced read-only.
import { Client } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://greengo:localdev@localhost:5432/greengo_dev';

// cp1252 reverse map (char -> byte), built from the WHATWG decoder.
const dec1252 = new TextDecoder('windows-1252');
const charToByte = new Map<string, number>();
for (let b = 0; b < 256; b++) charToByte.set(dec1252.decode(Uint8Array.of(b)), b);

// A lead character (Ø Ù Ã Â ‚) followed by a symbol: the signature of double encoding.
const LEAD_FOLLOWED =
  /[ØÙÃÂ‚][\u0080-¿ˆ…‘-„†-•‰‹›ŠšŽžŒœŸ™˜]/;

/** The text a double-encoded value would decode to, or null when it is not repairable. */
function repairCandidate(s: string): string | null {
  const bytes: number[] = [];
  for (const ch of s) {
    const b = charToByte.get(ch);
    if (b === undefined) return null;
    bytes.push(b);
  }
  let repaired: string;
  try {
    repaired = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
  if (repaired.includes('�') || !/\p{L}/u.test(repaired)) return null;
  // Round trip: re-encode as UTF-8 and read as cp1252; must give back the original.
  return dec1252.decode(Buffer.from(repaired, 'utf8')) === s ? repaired : null;
}

async function verify(): Promise<number> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SET client_encoding = 'UTF8'");
  await client.query('SET default_transaction_read_only = on');

  try {
    // ── Sample of the seeded data (unchanged behaviour) ────────────────────────
    const p = await client.query(
      'SELECT plu_code, name_ar, name_fr FROM products WHERE plu_code IS NOT NULL ORDER BY plu_code LIMIT 10',
    );
    console.log('Products:\n', JSON.stringify(p.rows, null, 2));

    const st = await client.query('SELECT name_ar, role FROM staff ORDER BY name_ar');
    console.log('\nStaff:\n', JSON.stringify(st.rows, null, 2));

    const stores = await client.query('SELECT name_ar, name_fr FROM stores ORDER BY name_fr');
    console.log('\nStores:\n', JSON.stringify(stores.rows, null, 2));

    // ── Double-encoding scan over every text column ───────────────────────────
    const cols = (await client.query<{ table_name: string; column_name: string }>(
      `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
         AND c.data_type IN ('text', 'character varying', 'character')
         -- The repair's backup table keeps the OLD garbled values on purpose.
         AND c.table_name <> '_encoding_repair_backup'
       ORDER BY c.table_name, c.ordinal_position`,
    )).rows;

    let totalRows = 0;
    const findings: string[] = [];
    for (const { table_name: t, column_name: c } of cols) {
      let rows: Array<{ v: string; n: string }>;
      try {
        rows = (await client.query<{ v: string; n: string }>(
          `SELECT "${c}" AS v, count(*) AS n FROM "${t}" WHERE "${c}" ~ '[ØÙÃÂ‚]' GROUP BY "${c}" LIMIT 2000`,
        )).rows;
      } catch {
        continue; // unreadable column: skip rather than fail the check
      }
      for (const r of rows) {
        if (!r.v || !LEAD_FOLLOWED.test(r.v)) continue;
        const n = parseInt(r.n, 10);
        totalRows += n;
        const fix = repairCandidate(r.v);
        findings.push(`  ${t}.${c}  x${n}  ${JSON.stringify(r.v)}  ->  ${fix ? JSON.stringify(fix) : '(not repairable)'}`);
      }
    }

    console.log(`\nDouble-encoding scan: ${cols.length} text columns checked.`);
    if (findings.length === 0) {
      console.log('RESULT: clean - no double-encoded values found.');
      return 0;
    }
    console.log(`RESULT: FOUND ${totalRows} row(s) with double-encoded text:`);
    for (const f of findings) console.log(f);
    return 1;
  } finally {
    await client.end();
  }
}

verify().then(
  (code) => { process.exitCode = code; },
  (err) => { console.error(err); process.exitCode = 1; },
);
