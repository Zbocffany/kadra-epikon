-- Seed: członkowie OFC (11) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='OFC'
-- Upsert po fifa_code (UNIQUE) + pominięcie rekordów istniejących już po nazwie

WITH ofc AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'OFC'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Fidżi', 'FIJ'),
    ('Nowa Kaledonia', 'NCL'),
    ('Nowa Zelandia', 'NZL'),
    ('Papua-Nowa Gwinea', 'PNG'),
    ('Samoa', 'SAM'),
    ('Tahiti', 'TAH'),
    ('Tonga', 'TGA'),
    ('Vanuatu', 'VAN'),
    ('Wyspy Cooka', 'COK'),
    ('Wyspy Salomona', 'SOL'),
    ('Samoa Amerykańskie', 'ASA')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  o.federation_id
FROM src s
CROSS JOIN ofc o
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Countries" existing
  WHERE lower(existing.name) = lower(s.name)
)
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;