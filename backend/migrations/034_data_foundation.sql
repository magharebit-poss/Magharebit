-- Migration: 034_data_foundation
-- Sprint H1: data correctness foundation
-- 3a: sold_at (real sale time for offline sales)
-- 3b: cost_price_cents on products
-- 3c: dim_date with Moroccan holiday calendar 2025-2028

-- ── 3a. Real sale time ────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Backfill: client_timestamp was always NOW() (server receive time), so use
-- server_received_at as the best available approximation for historical rows.
UPDATE transactions
  SET sold_at = COALESCE(server_received_at, created_at)
  WHERE sold_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_sold_at
  ON transactions(tenant_id, sold_at);

-- ── 3b. Cost price (nullable — unknown until supplier data is entered) ────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price_cents INTEGER
    CHECK (cost_price_cents IS NULL OR cost_price_cents >= 0);

-- ── 3c. Calendar dimension ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dim_date (
  date             DATE    PRIMARY KEY,
  year             INT     NOT NULL,
  month            INT     NOT NULL,
  day_of_week      INT     NOT NULL, -- 1=Mon .. 7=Sun (ISO 8601)
  is_weekend       BOOLEAN NOT NULL,
  is_friday        BOOLEAN NOT NULL,
  holiday_code     TEXT,
  holiday_name_ar  TEXT,
  holiday_name_fr  TEXT,
  is_ramadan       BOOLEAN NOT NULL DEFAULT false,
  -- false = Islamic date is estimated; needs confirmation against official
  -- Ministry of Habous moon-sighting announcement each year.
  date_confirmed   BOOLEAN NOT NULL DEFAULT true
);

-- Populate the date spine 2025-01-01 → 2028-12-31
INSERT INTO dim_date (date, year, month, day_of_week, is_weekend, is_friday)
SELECT
  d::date,
  EXTRACT(YEAR  FROM d)::int,
  EXTRACT(MONTH FROM d)::int,
  -- ISO: Mon=1 … Sun=7  (PostgreSQL DOW: Sun=0, Mon=1, …, Sat=6)
  CASE WHEN EXTRACT(DOW FROM d) = 0 THEN 7
       ELSE EXTRACT(DOW FROM d)::int
  END,
  EXTRACT(DOW FROM d) IN (0, 6),   -- Sat or Sun
  EXTRACT(DOW FROM d) = 5          -- Friday
FROM generate_series('2025-01-01'::date, '2028-12-31'::date, '1 day') AS gs(d)
ON CONFLICT (date) DO NOTHING;

-- ── Fixed national holidays (date_confirmed = true, repeat every year) ────────
-- Applied for each year 2025 → 2028.

DO $$
DECLARE
  yr INT;
  h  RECORD;
BEGIN
  FOR yr IN 2025..2028 LOOP
    FOR h IN (
      SELECT *
      FROM (VALUES
        ('01-01', 'new_year',
         'رأس السنة الميلادية',
         'Nouvel an'),
        ('01-11', 'independence_manifesto',
         'ذكرى تقديم وثيقة الاستقلال',
         'Manifeste de l''indépendance'),
        ('01-14', 'amazigh_new_year',
         'رأس السنة الأمازيغية',
         'Nouvel an amazigh'),
        ('05-01', 'labour_day',
         'عيد الشغل',
         'Fête du Travail'),
        ('07-30', 'throne_day',
         'عيد العرش',
         'Fête du Trône'),
        ('08-14', 'oued_eddahab',
         'ذكرى استرجاع وادي الذهب',
         'Récupération de Oued Eddahab'),
        ('08-20', 'revolution',
         'ذكرى ثورة الملك والشعب',
         'Révolution du Roi et du Peuple'),
        ('08-21', 'youth_day',
         'عيد الشباب',
         'Fête de la Jeunesse'),
        ('11-06', 'green_march',
         'ذكرى المسيرة الخضراء',
         'Marche Verte'),
        ('11-18', 'independence_day',
         'عيد الاستقلال',
         'Fête de l''Indépendance')
      ) AS t(md, code, name_ar, name_fr)
    ) LOOP
      UPDATE dim_date
         SET holiday_code    = h.code,
             holiday_name_ar = h.name_ar,
             holiday_name_fr = h.name_fr,
             date_confirmed  = true
       WHERE date = make_date(yr, split_part(h.md,'-',1)::int,
                                   split_part(h.md,'-',2)::int);
    END LOOP;
  END LOOP;
END $$;

-- ── Islamic holidays 2026 (ESTIMATES ±1 day, date_confirmed = false) ──────────
-- Source: astronomical calculation. Actual dates follow official Moroccan
-- Ministry of Habous moon-sighting announcement.

-- Ramadan 2026: 2026-02-18 → 2026-03-19
UPDATE dim_date
   SET is_ramadan     = true,
       date_confirmed = false
 WHERE date BETWEEN '2026-02-18' AND '2026-03-19';

-- Eid al-Fitr 2026
UPDATE dim_date
   SET holiday_code    = 'eid_al_fitr',
       holiday_name_ar = 'عيد الفطر',
       holiday_name_fr = 'Aïd al-Fitr',
       date_confirmed  = false
 WHERE date IN ('2026-03-20', '2026-03-21');

-- Eid al-Adha 2026
UPDATE dim_date
   SET holiday_code    = 'eid_al_adha',
       holiday_name_ar = 'عيد الأضحى',
       holiday_name_fr = 'Aïd al-Adha',
       date_confirmed  = false
 WHERE date IN ('2026-05-27', '2026-05-28');

-- Islamic New Year 2026
UPDATE dim_date
   SET holiday_code    = 'islamic_new_year',
       holiday_name_ar = 'رأس السنة الهجرية',
       holiday_name_fr = 'Nouvel an hégire',
       date_confirmed  = false
 WHERE date = '2026-06-16';

-- Mawlid 2026 (2026-08-25 — check for collision with Revolution Day 08-20: clear)
UPDATE dim_date
   SET holiday_code    = 'mawlid',
       holiday_name_ar = 'عيد المولد النبوي',
       holiday_name_fr = 'Aïd al-Mawlid',
       date_confirmed  = false
 WHERE date IN ('2026-08-25', '2026-08-26');

-- ── Islamic holidays 2027 (ESTIMATES ±1 day, date_confirmed = false) ──────────

-- Ramadan 2027: 2027-02-08 → 2027-03-09
UPDATE dim_date
   SET is_ramadan     = true,
       date_confirmed = false
 WHERE date BETWEEN '2027-02-08' AND '2027-03-09';

-- Eid al-Fitr 2027
UPDATE dim_date
   SET holiday_code    = 'eid_al_fitr',
       holiday_name_ar = 'عيد الفطر',
       holiday_name_fr = 'Aïd al-Fitr',
       date_confirmed  = false
 WHERE date IN ('2027-03-10', '2027-03-11');

-- Eid al-Adha 2027
UPDATE dim_date
   SET holiday_code    = 'eid_al_adha',
       holiday_name_ar = 'عيد الأضحى',
       holiday_name_fr = 'Aïd al-Adha',
       date_confirmed  = false
 WHERE date IN ('2027-05-17', '2027-05-18');

-- Islamic New Year 2027
UPDATE dim_date
   SET holiday_code    = 'islamic_new_year',
       holiday_name_ar = 'رأس السنة الهجرية',
       holiday_name_fr = 'Nouvel an hégire',
       date_confirmed  = false
 WHERE date = '2027-06-06';

-- Mawlid 2027 (2027-08-15 — same as Youth Day 08-21? No. Revolution 08-20? No. Clear.)
UPDATE dim_date
   SET holiday_code    = 'mawlid',
       holiday_name_ar = 'عيد المولد النبوي',
       holiday_name_fr = 'Aïd al-Mawlid',
       date_confirmed  = false
 WHERE date IN ('2027-08-15', '2027-08-16');
