-- 014_mixed_european_clubs.sql
--
-- Purpose:
--   1) Insert missing cities used by the provided cross-country club list.
--   2) Ensure each city has a current country assignment in tbl_City_Country_Periods.
--   3) Insert or update clubs and ensure club teams exist.
--
-- Prerequisite:
--   Run UEFA countries seed first so all referenced countries exist in tbl_Countries.
--
-- Notes:
--   - This seed is idempotent.
--   - Matching is case-insensitive and trims whitespace.
--   - Input contains one obvious correction: country 'Marsylia' is treated as 'Francja'.

WITH src AS (
  SELECT
    btrim(v.club_name) AS club_name,
    btrim(v.city_name) AS city_name,
    CASE
      WHEN lower(btrim(v.country_name)) = 'marsylia' THEN 'Francja'
      ELSE btrim(v.country_name)
    END AS country_name
  FROM (VALUES
    ('Arsenal', 'Londyn', 'Anglia'),
    ('Chelsea', 'Londyn', 'Anglia'),
    ('Tottenham', 'Londyn', 'Anglia'),
    ('West Ham', 'Londyn', 'Anglia'),
    ('Crystal Palace', 'Londyn', 'Anglia'),
    ('Fulham', 'Londyn', 'Anglia'),
    ('Manchester United', 'Manchester', 'Anglia'),
    ('Manchester City', 'Manchester', 'Anglia'),
    ('Liverpool', 'Liverpool', 'Anglia'),
    ('Everton', 'Liverpool', 'Anglia'),
    ('Aston Villa', 'Birmingham', 'Anglia'),
    ('Wolverhampton', 'Wolverhampton', 'Anglia'),
    ('Newcastle United', 'Newcastle', 'Anglia'),
    ('Brighton', 'Brighton', 'Anglia'),
    ('Burnley', 'Burnley', 'Anglia'),
    ('Sheffield United', 'Sheffield', 'Anglia'),
    ('Brentford', 'Londyn', 'Anglia'),
    ('Nottingham Forest', 'Nottingham', 'Anglia'),
    ('Luton Town', 'Luton', 'Anglia'),
    ('Ipswich Town', 'Ipswich', 'Anglia'),
    ('Plymouth Argyle', 'Plymuth', 'Anglia'),
    ('PSG', 'Paryż', 'Francja'),
    ('Olympique Marsylia', 'Marsylia', 'Marsylia'),
    ('Sparta Praga', 'Praga', 'Czechy'),
    ('Slavia Praga', 'Praga', 'Czechy'),
    ('Galatasaray', 'Stambuł', 'Turcja'),
    ('Trabzonspor', 'Trabzon', 'Turcja'),
    ('Bayern Monachium', 'Monachium', 'Niemcy'),
    ('Bayer Leverkusen', 'Leverkusen', 'Niemcy'),
    ('Union Berlin', 'Berlin', 'Niemcy'),
    ('Borussia Dortmund', 'Dortmund', 'Niemcy'),
    ('Dinamo Zagrzeb', 'Zagrzeb', 'Chorwacja'),
    ('Lokomotiw Moskwa', 'Moskwa', 'Rosja'),
    ('Konyaspor ', 'Konya', 'Turcja'),
    ('Rayo Vallecano', 'Madryt', 'Hiszpania'),
    ('Farmalicao', 'Vila Nova de Famalicao', 'Portugalia'),
    ('Leeds United', 'Leeds', 'Anglia'),
    ('Southampton', 'Southampton', 'Anglia'),
    ('Leicester City', 'Leicester', 'Anglia'),
    ('Norwich City', 'Norwich', 'Anglia'),
    ('Middlesbrough', 'Middlesbrough', 'Anglia'),
    ('Sunderland', 'Sunderland', 'Anglia'),
    ('Coventry City', 'Coventry', 'Anglia'),
    ('Hull City', 'Hull', 'Anglia'),
    ('Bristol City', 'Bristol', 'Anglia'),
    ('Birmingham City', 'Birmingham', 'Anglia'),
    ('Huddersfield Town', 'Huddersfield', 'Anglia'),
    ('Stoke City', 'Stoke-on-Trent', 'Anglia'),
    ('Preston North End', 'Preston', 'Anglia'),
    ('Blackburn Rovers', 'Blackburn', 'Anglia'),
    ('Millwall', 'Londyn', 'Anglia'),
    ('Queens Park Rangers', 'Londyn', 'Anglia'),
    ('Sheffield Wednesday', 'Sheffield', 'Anglia'),
    ('Watford', 'Watford', 'Anglia'),
    ('Rotherham United', 'Rotherham', 'Anglia'),
    ('West Bromwich Albion', 'West Bromwich', 'Anglia')
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
    WHERE lower(btrim(c.city_name)) = lower(btrim(dc.city_name))
  )
  RETURNING id, city_name
),
country_lookup AS (
  SELECT DISTINCT ON (lower(btrim(c.name)))
    lower(btrim(c.name)) AS country_key,
    c.id AS country_id
  FROM public."tbl_Countries" c
  JOIN (
    SELECT DISTINCT lower(btrim(country_name)) AS country_key
    FROM src
  ) s ON lower(btrim(c.name)) = s.country_key
  ORDER BY lower(btrim(c.name)), c.id
),
city_lookup AS (
  SELECT DISTINCT ON (city_key)
    city_key,
    city_id
  FROM (
    SELECT
      lower(btrim(c.city_name)) AS city_key,
      c.id AS city_id
    FROM public."tbl_Cities" c
    JOIN (
      SELECT DISTINCT lower(btrim(city_name)) AS city_key
      FROM src
    ) s ON lower(btrim(c.city_name)) = s.city_key

    UNION ALL

    SELECT
      lower(btrim(ic.city_name)) AS city_key,
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
    'Seed 014 mixed european clubs'
  FROM distinct_pairs dp
  JOIN city_lookup cl
    ON cl.city_key = lower(btrim(dp.city_name))
  JOIN country_lookup co
    ON co.country_key = lower(btrim(dp.country_name))
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
  ON cl.city_key = lower(btrim(dc.city_name))
ON CONFLICT (name) DO UPDATE
SET club_city_id = EXCLUDED.club_city_id;

WITH src AS (
  SELECT
    btrim(v.club_name) AS club_name
  FROM (VALUES
    ('Arsenal'),
    ('Chelsea'),
    ('Tottenham'),
    ('West Ham'),
    ('Crystal Palace'),
    ('Fulham'),
    ('Manchester United'),
    ('Manchester City'),
    ('Liverpool'),
    ('Everton'),
    ('Aston Villa'),
    ('Wolverhampton'),
    ('Newcastle United'),
    ('Brighton'),
    ('Burnley'),
    ('Sheffield United'),
    ('Brentford'),
    ('Nottingham Forest'),
    ('Luton Town'),
    ('Ipswich Town'),
    ('Plymouth Argyle'),
    ('PSG'),
    ('Olympique Marsylia'),
    ('Sparta Praga'),
    ('Slavia Praga'),
    ('Galatasaray'),
    ('Trabzonspor'),
    ('Bayern Monachium'),
    ('Bayer Leverkusen'),
    ('Union Berlin'),
    ('Borussia Dortmund'),
    ('Dinamo Zagrzeb'),
    ('Lokomotiw Moskwa'),
    ('Konyaspor '),
    ('Rayo Vallecano'),
    ('Farmalicao'),
    ('Leeds United'),
    ('Southampton'),
    ('Leicester City'),
    ('Norwich City'),
    ('Middlesbrough'),
    ('Sunderland'),
    ('Coventry City'),
    ('Hull City'),
    ('Bristol City'),
    ('Birmingham City'),
    ('Huddersfield Town'),
    ('Stoke City'),
    ('Preston North End'),
    ('Blackburn Rovers'),
    ('Millwall'),
    ('Queens Park Rangers'),
    ('Sheffield Wednesday'),
    ('Watford'),
    ('Rotherham United'),
    ('West Bromwich Albion')
  ) AS v(club_name)
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
  ON lower(btrim(c.name)) = lower(btrim(dc.club_name))
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Teams" t
  WHERE t.club_id = c.id
);
