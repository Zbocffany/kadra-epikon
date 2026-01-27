-- Seed: członkowie UEFA (55) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='UEFA'
-- Upsert po fifa_code (UNIQUE)

WITH uefa AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'UEFA'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Albania', 'ALB'),
    ('Andora', 'AND'),
    ('Armenia', 'ARM'),
    ('Austria', 'AUT'),
    ('Azerbejdżan', 'AZE'),
    ('Białoruś', 'BLR'),
    ('Belgia', 'BEL'),
    ('Bośnia i Hercegowina', 'BIH'),
    ('Bułgaria', 'BUL'),
    ('Chorwacja', 'CRO'),
    ('Cypr', 'CYP'),
    ('Czechy', 'CZE'),
    ('Czarnogóra', 'MNE'),
    ('Dania', 'DEN'),
    ('Anglia', 'ENG'),
    ('Estonia', 'EST'),
    ('Wyspy Owcze', 'FRO'),
    ('Finlandia', 'FIN'),
    ('Francja', 'FRA'),
    ('Gruzja', 'GEO'),
    ('Niemcy', 'GER'),
    ('Gibraltar', 'GIB'),
    ('Grecja', 'GRE'),
    ('Węgry', 'HUN'),
    ('Islandia', 'ISL'),
    ('Izrael', 'ISR'),
    ('Włochy', 'ITA'),
    ('Kazachstan', 'KAZ'),
    ('Kosowo', 'KOS'),
    ('Łotwa', 'LVA'),
    ('Liechtenstein', 'LIE'),
    ('Litwa', 'LTU'),
    ('Luksemburg', 'LUX'),
    ('Malta', 'MLT'),
    ('Mołdawia', 'MDA'),
    ('Holandia', 'NED'),
    ('Macedonia Północna', 'MKD'),
    ('Irlandia Północna', 'NIR'),
    ('Norwegia', 'NOR'),
    ('Polska', 'POL'),
    ('Portugalia', 'POR'),
    ('Irlandia', 'IRL'),
    ('Rumunia', 'ROU'),
    ('Rosja', 'RUS'),
    ('San Marino', 'SMR'),
    ('Szkocja', 'SCO'),
    ('Serbia', 'SRB'),
    ('Słowacja', 'SVK'),
    ('Słowenia', 'SVN'),
    ('Hiszpania', 'ESP'),
    ('Szwecja', 'SWE'),
    ('Szwajcaria', 'SUI'),
    ('Turcja', 'TUR'),
    ('Ukraina', 'UKR'),
    ('Walia', 'WAL')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  u.federation_id
FROM src s
CROSS JOIN uefa u
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;
