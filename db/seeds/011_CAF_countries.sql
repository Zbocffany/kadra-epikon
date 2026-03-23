-- Seed: członkowie CAF (54) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='CAF'
-- Upsert po fifa_code (UNIQUE) + pominięcie rekordów istniejących już po nazwie

WITH caf AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'CAF'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Algieria', 'ALG'),
    ('Angola', 'ANG'),
    ('Benin', 'BEN'),
    ('Botswana', 'BOT'),
    ('Burkina Faso', 'BFA'),
    ('Burundi', 'BDI'),
    ('Czad', 'CHA'),
    ('Demokratyczna Republika Konga', 'COD'),
    ('Dżibuti', 'DJI'),
    ('Egipt', 'EGY'),
    ('Erytrea', 'ERI'),
    ('Eswatini', 'SWZ'),
    ('Etiopia', 'ETH'),
    ('Gabon', 'GAB'),
    ('Gambia', 'GAM'),
    ('Ghana', 'GHA'),
    ('Gwinea', 'GUI'),
    ('Gwinea Bissau', 'GNB'),
    ('Gwinea Równikowa', 'EQG'),
    ('Kamerun', 'CMR'),
    ('Kenia', 'KEN'),
    ('Komory', 'COM'),
    ('Republika Konga', 'CGO'),
    ('Lesotho', 'LES'),
    ('Liberia', 'LBR'),
    ('Libia', 'LBY'),
    ('Madagaskar', 'MAD'),
    ('Malawi', 'MWI'),
    ('Mali', 'MLI'),
    ('Maroko', 'MAR'),
    ('Mauretania', 'MTN'),
    ('Mauritius', 'MRI'),
    ('Mozambik', 'MOZ'),
    ('Namibia', 'NAM'),
    ('Niger', 'NIG'),
    ('Nigeria', 'NGA'),
    ('Republika Południowej Afryki', 'RSA'),
    ('Republika Zielonego Przylądka', 'CPV'),
    ('Republika Środkowoafrykańska', 'CTA'),
    ('Rwanda', 'RWA'),
    ('Wyspy Świętego Tomasza i Książęca', 'STP'),
    ('Senegal', 'SEN'),
    ('Seszele', 'SEY'),
    ('Sierra Leone', 'SLE'),
    ('Somalia', 'SOM'),
    ('Sudan', 'SDN'),
    ('Sudan Południowy', 'SSD'),
    ('Tanzania', 'TAN'),
    ('Togo', 'TOG'),
    ('Tunezja', 'TUN'),
    ('Uganda', 'UGA'),
    ('Wybrzeże Kości Słoniowej', 'CIV'),
    ('Zambia', 'ZAM'),
    ('Zimbabwe', 'ZIM')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  c.federation_id
FROM src s
CROSS JOIN caf c
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Countries" existing
  WHERE lower(existing.name) = lower(s.name)
)
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;