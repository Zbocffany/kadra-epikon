-- 013_serie_a_clubs.sql
--
-- Purpose:
--   1) Insert missing Italian cities used by the provided Serie A clubs.
--   2) Ensure each city has a current country assignment in tbl_City_Country_Periods.
--   3) Insert or update clubs and ensure club teams exist.
--
-- Prerequisite:
--   Run UEFA countries seed first so country 'Włochy' exists in tbl_Countries.
--
-- Notes:
--   - This seed is idempotent.
--   - Matching is case-insensitive by club, city, and country name.

WITH src AS (
  SELECT *
  FROM (VALUES
    ('Inter Mediolan', 'Mediolan', 'Włochy'),
    ('AC Milan', 'Mediolan', 'Włochy'),
    ('Juventus Turyn', 'Turyn', 'Włochy'),
    ('Napoli', 'Neapol', 'Włochy'),
    ('Lazio', 'Rzym', 'Włochy'),
    ('Bologna', 'Bolonia', 'Włochy'),
    ('Fiorentina', 'Florencja', 'Włochy'),
    ('Torino', 'Turyn', 'Włochy'),
    ('Genoa', 'Genua', 'Włochy'),
    ('Monza', 'Monza', 'Włochy'),
    ('Verona', 'Werona', 'Włochy'),
    ('Lecce', 'Lecce', 'Włochy'),
    ('Cagliari', 'Cagliari', 'Włochy'),
    ('Sassuolo', 'Sassuolo', 'Włochy'),
    ('Empoli', 'Empoli', 'Włochy'),
    ('Salernitana', 'Salerno', 'Włochy'),
    ('Frosinone', 'Frosinone', 'Włochy')
  ) AS v(club_name, city_name, country_name)
),
distinct_cities AS (
  SELECT DISTINCT city_name
  FROM src
),
distinct_pairs AS (
  SELECT DISTINCT city_name, country_name
  FROM src
),
distinct_clubs AS (
  SELECT DISTINCT club_name, city_name
  FROM src
),
insert_missing_cities AS (
  INSERT INTO public."tbl_Cities" (id, city_name)
  SELECT gen_random_uuid(), dc.city_name
  FROM distinct_cities dc
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."tbl_Cities" c
    WHERE lower(c.city_name) = lower(dc.city_name)
  )
  RETURNING id, city_name
),
country_lookup AS (
  SELECT DISTINCT ON (lower(c.name))
    lower(c.name) AS country_key,
    c.id AS country_id
  FROM public."tbl_Countries" c
  JOIN (
    SELECT DISTINCT lower(country_name) AS country_key
    FROM src
  ) s ON lower(c.name) = s.country_key
  ORDER BY lower(c.name), c.id
),
city_lookup AS (
  SELECT DISTINCT ON (city_key)
    city_key,
    city_id
  FROM (
    SELECT
      lower(c.city_name) AS city_key,
      c.id AS city_id
    FROM public."tbl_Cities" c
    JOIN (
      SELECT DISTINCT lower(city_name) AS city_key
      FROM src
    ) s ON lower(c.city_name) = s.city_key

    UNION ALL

    SELECT
      lower(ic.city_name) AS city_key,
      ic.id AS city_id
    FROM insert_missing_cities ic
  ) cities
  ORDER BY city_key, city_id
),
insert_missing_city_country_periods AS (
  INSERT INTO public."tbl_City_Country_Periods" (id, city_id, country_id, valid_from, valid_to, description)
  SELECT
    gen_random_uuid(),
    cl.city_id,
    co.country_id,
    NULL,
    NULL,
    'Seed 013 Serie A clubs'
  FROM distinct_pairs dp
  JOIN city_lookup cl
    ON cl.city_key = lower(dp.city_name)
  JOIN country_lookup co
    ON co.country_key = lower(dp.country_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."tbl_City_Country_Periods" p
    WHERE p.city_id = cl.city_id
      AND p.country_id = co.country_id
      AND p.valid_from IS NULL
      AND p.valid_to IS NULL
  )
  RETURNING id
)
INSERT INTO public."tbl_Clubs" (id, name, club_city_id)
SELECT
  gen_random_uuid(),
  dc.club_name,
  cl.city_id
FROM distinct_clubs dc
JOIN city_lookup cl
  ON cl.city_key = lower(dc.city_name)
ON CONFLICT (name) DO UPDATE
SET club_city_id = EXCLUDED.club_city_id;

WITH src AS (
  SELECT *
  FROM (VALUES
    ('Inter Mediolan', 'Mediolan', 'Włochy'),
    ('AC Milan', 'Mediolan', 'Włochy'),
    ('Juventus Turyn', 'Turyn', 'Włochy'),
    ('Napoli', 'Neapol', 'Włochy'),
    ('Lazio', 'Rzym', 'Włochy'),
    ('Bologna', 'Bolonia', 'Włochy'),
    ('Fiorentina', 'Florencja', 'Włochy'),
    ('Torino', 'Turyn', 'Włochy'),
    ('Genoa', 'Genua', 'Włochy'),
    ('Monza', 'Monza', 'Włochy'),
    ('Verona', 'Werona', 'Włochy'),
    ('Lecce', 'Lecce', 'Włochy'),
    ('Cagliari', 'Cagliari', 'Włochy'),
    ('Sassuolo', 'Sassuolo', 'Włochy'),
    ('Empoli', 'Empoli', 'Włochy'),
    ('Salernitana', 'Salerno', 'Włochy'),
    ('Frosinone', 'Frosinone', 'Włochy')
  ) AS v(club_name, city_name, country_name)
),
distinct_clubs AS (
  SELECT DISTINCT club_name
  FROM src
)
INSERT INTO public."tbl_Teams" (id, country_id, club_id)
SELECT
  gen_random_uuid(),
  NULL,
  c.id
FROM public."tbl_Clubs" c
JOIN distinct_clubs dc
  ON lower(c.name) = lower(dc.club_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Teams" t
  WHERE t.club_id = c.id
);