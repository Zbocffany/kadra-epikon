-- Seed: członkowie CONMEBOL (10) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='CONMEBOL'
-- Upsert po fifa_code (UNIQUE) + pominięcie rekordów istniejących już po nazwie

WITH conmebol AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'CONMEBOL'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Argentyna', 'ARG'),
    ('Boliwia', 'BOL'),
    ('Brazylia', 'BRA'),
    ('Chile', 'CHI'),
    ('Kolumbia', 'COL'),
    ('Ekwador', 'ECU'),
    ('Paragwaj', 'PAR'),
    ('Peru', 'PER'),
    ('Urugwaj', 'URU'),
    ('Wenezuela', 'VEN')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  c.federation_id
FROM src s
CROSS JOIN conmebol c
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Countries" existing
  WHERE lower(existing.name) = lower(s.name)
)
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;