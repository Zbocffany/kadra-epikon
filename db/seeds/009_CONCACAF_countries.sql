-- Seed: członkowie CONCACAF (41) w tbl_Countries
-- Wymaga: seeded tbl_Federations z rekordem short_name='CONCACAF'
-- Upsert po fifa_code (UNIQUE) + pominięcie rekordów istniejących już po nazwie

WITH concacaf AS (
  SELECT id AS federation_id
  FROM public."tbl_Federations"
  WHERE short_name = 'CONCACAF'
  LIMIT 1
),
src AS (
  SELECT *
  FROM (VALUES
    ('Anguilla', 'AIA'),
    ('Antigua i Barbuda', 'ATG'),
    ('Aruba', 'ARU'),
    ('Bahamy', 'BAH'),
    ('Barbados', 'BRB'),
    ('Belize', 'BLZ'),
    ('Bermudy', 'BER'),
    ('Brytyjskie Wyspy Dziewicze', 'VGB'),
    ('Kanada', 'CAN'),
    ('Kajmany', 'CAY'),
    ('Kostaryka', 'CRC'),
    ('Kuba', 'CUB'),
    ('Curaçao', 'CUW'),
    ('Dominika', 'DMA'),
    ('Dominikana', 'DOM'),
    ('Salwador', 'SLV'),
    ('Gujana Francuska', 'GUF'),
    ('Grenada', 'GRN'),
    ('Gwadelupa', 'GLP'),
    ('Gwatemala', 'GUA'),
    ('Gujana', 'GUY'),
    ('Haiti', 'HAI'),
    ('Honduras', 'HON'),
    ('Jamajka', 'JAM'),
    ('Martynika', 'MTQ'),
    ('Meksyk', 'MEX'),
    ('Montserrat', 'MSR'),
    ('Nikaragua', 'NCA'),
    ('Panama', 'PAN'),
    ('Portoryko', 'PUR'),
    ('Saint Kitts i Nevis', 'SKN'),
    ('Saint Lucia', 'LCA'),
    ('Saint Martin', 'MAF'),
    ('Saint Vincent i Grenadyny', 'VIN'),
    ('Sint Maarten', 'SMA'),
    ('Surinam', 'SUR'),
    ('Trynidad i Tobago', 'TRI'),
    ('Turks i Caicos', 'TCA'),
    ('Wyspy Dziewicze Stanów Zjednoczonych', 'VIR'),
    ('Stany Zjednoczone', 'USA'),
    ('Karaiby Niderlandzkie', 'BOE')
  ) AS v(name, fifa_code)
)
INSERT INTO public."tbl_Countries" (id, name, fifa_code, federation_id)
SELECT
  gen_random_uuid(),
  s.name,
  s.fifa_code,
  c.federation_id
FROM src s
CROSS JOIN concacaf c
WHERE NOT EXISTS (
  SELECT 1
  FROM public."tbl_Countries" existing
  WHERE lower(existing.name) = lower(s.name)
)
ON CONFLICT (fifa_code) DO UPDATE
SET
  name = EXCLUDED.name,
  federation_id = EXCLUDED.federation_id;