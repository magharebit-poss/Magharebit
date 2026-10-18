-- Course number for kitchen firing control
-- NULL = no course (fire immediately)
-- 1 = first course, 2 = second, etc.
ALTER TABLE cafe_order_lines
  ADD COLUMN IF NOT EXISTS course_number
    SMALLINT DEFAULT NULL;

-- Allergy / dietary flags stored as a text array
-- e.g. ['gluten_free','no_nuts','vegetarian']
ALTER TABLE cafe_order_lines
  ADD COLUMN IF NOT EXISTS allergy_flags
    TEXT[] NOT NULL DEFAULT '{}';

-- Course fire log: when a course was sent to KDS
CREATE TABLE IF NOT EXISTS course_fire_log (
  fire_id     UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  order_id    UUID NOT NULL
    REFERENCES cafe_orders(order_id)
    ON DELETE CASCADE,
  course_number SMALLINT NOT NULL,
  fired_by    UUID,  -- staff_id
  fired_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fire_log_order
  ON course_fire_log(order_id, course_number);

-- Allergy definitions per tenant
CREATE TABLE IF NOT EXISTS allergy_definitions (
  allergy_id  UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  code        TEXT NOT NULL,
  label_ar    TEXT NOT NULL,
  label_fr    TEXT NOT NULL,
  label_en    TEXT NOT NULL,
  icon        TEXT,  -- emoji
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, code)
);

-- Seed standard allergies for test tenant
INSERT INTO allergy_definitions (
  tenant_id, code, label_ar, label_fr,
  label_en, icon, sort_order
) VALUES
('11111111-1111-1111-1111-111111111111',
 'gluten_free',
 'بدون غلوتين', 'Sans gluten',
 'Gluten free', '🌾', 1),
('11111111-1111-1111-1111-111111111111',
 'no_nuts',
 'بدون مكسرات', 'Sans noix',
 'No nuts', '🥜', 2),
('11111111-1111-1111-1111-111111111111',
 'vegetarian',
 'نباتي', 'Végétarien',
 'Vegetarian', '🥗', 3),
('11111111-1111-1111-1111-111111111111',
 'vegan',
 'نباتي صارم', 'Vegan',
 'Vegan', '🌱', 4),
('11111111-1111-1111-1111-111111111111',
 'no_dairy',
 'بدون حليب', 'Sans lactose',
 'No dairy', '🥛', 5),
('11111111-1111-1111-1111-111111111111',
 'spicy',
 'حار', 'Épicé',
 'Spicy', '🌶️', 6),
('11111111-1111-1111-1111-111111111111',
 'no_sugar',
 'بدون سكر', 'Sans sucre',
 'No sugar', '🍬', 7)
ON CONFLICT DO NOTHING;
