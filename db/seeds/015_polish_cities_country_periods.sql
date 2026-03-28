-- 015_polish_cities_country_periods.sql
--
-- Purpose:
--   Assign Poland as the current country for all Polish cities
--   (cities with voivodeship IS NOT NULL) that are not yet in tbl_City_Country_Periods.
--
-- This fills the gap left by seed 006, which inserted Polish cities into tbl_Cities
-- but did not create corresponding country assignments.
--
-- Notes:
--   - Idempotent: only inserts where no current period (valid_to IS NULL) already exists.
--   - Uses fifa_code 'POL' to find Poland reliably.
--   - Sets valid_from and valid_to to NULL (open-ended).

INSERT INTO public."tbl_City_Country_Periods" (id, city_id, country_id, valid_from, valid_to, description)
SELECT
  gen_random_uuid(),
  c.id,
  p.id,
  NULL,
  NULL,
  'Wpis automatyczny — Polska (seed 015)'
FROM public."tbl_Cities" c
CROSS JOIN (
  SELECT id FROM public."tbl_Countries" WHERE upper(fifa_code) = 'POL' LIMIT 1
) p
WHERE c.voivodeship IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public."tbl_City_Country_Periods" existing
    WHERE existing.city_id = c.id
      AND existing.valid_to IS NULL
  );
