-- Seed: członkowie AFC (47) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='AFC'
-- Upsert po fifa_code (UNIQUE) + pominięcie rekordów istniejących już po nazwie

WITH afc AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'AFC'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Afganistan', 'AFG'),
    ('Arabia Saudyjska', 'KSA'),
    ('Australia', 'AUS'),
    ('Bahrajn', 'BHR'),
    ('Bangladesz', 'BAN'),
    ('Bhutan', 'BHU'),
    ('Brunei', 'BRU'),
    ('Chiny', 'CHN'),
    ('Chińskie Tajpej', 'TPE'),
    ('Filipiny', 'PHI'),
    ('Guam', 'GUM'),
    ('Hongkong', 'HKG'),
    ('Indie', 'IND'),
    ('Indonezja', 'IDN'),
    ('Irak', 'IRQ'),
    ('Iran', 'IRN'),
    ('Japonia', 'JPN'),
    ('Jemen', 'YEM'),
    ('Jordania', 'JOR'),
    ('Kambodża', 'CAM'),
    ('Katar', 'QAT'),
    ('Kirgistan', 'KGZ'),
    ('Korea Południowa', 'KOR'),
    ('Korea Północna', 'PRK'),
    ('Kuwejt', 'KUW'),
    ('Laos', 'LAO'),
    ('Liban', 'LBN'),
    ('Makau', 'MAC'),
    ('Malediwy', 'MDV'),
    ('Malezja', 'MAS'),
    ('Mjanma', 'MYA'),
    ('Mongolia', 'MNG'),
    ('Nepal', 'NEP'),
    ('Mariany Północne', 'NMI'),
    ('Oman', 'OMA'),
    ('Pakistan', 'PAK'),
    ('Palestyna', 'PLE'),
    ('Singapur', 'SGP'),
    ('Sri Lanka', 'SRI'),
    ('Syria', 'SYR'),
    ('Tadżykistan', 'TJK'),
    ('Tajlandia', 'THA'),
    ('Timor Wschodni', 'TLS'),
    ('Turkmenistan', 'TKM'),
    ('Uzbekistan', 'UZB'),
    ('Wietnam', 'VIE'),
    ('Zjednoczone Emiraty Arabskie', 'UAE')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  a.federation_id
FROM src s
CROSS JOIN afc a
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Countries" existing
  WHERE lower(existing.name) = lower(s.name)
)
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;