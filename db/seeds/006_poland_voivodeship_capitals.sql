-- 006_poland_voivodeship_capitals.sql
--
-- Purpose:
--   1) Insert missing Polish voivodeship-capital cities into tbl_Cities.
--   2) Ensure voivodeship value is set correctly for all those cities.
--
-- Prerequisite:
--   Run seed 005 first (it renames voivodeship_enum labels to Polish format).
--
-- Notes:
--   - This seed is idempotent.
--   - Matching is case-insensitive by city_name.

WITH capitals AS (
  SELECT *
  FROM (
    VALUES
      ('Wrocław', 'Dolnośląskie'::public.voivodeship_enum),
      ('Bydgoszcz', 'Kujawsko-pomorskie'::public.voivodeship_enum),
      ('Toruń', 'Kujawsko-pomorskie'::public.voivodeship_enum),
      ('Lublin', 'Lubelskie'::public.voivodeship_enum),
      ('Gorzów Wielkopolski', 'Lubuskie'::public.voivodeship_enum),
      ('Zielona Góra', 'Lubuskie'::public.voivodeship_enum),
      ('Łódź', 'Łódzkie'::public.voivodeship_enum),
      ('Kraków', 'Małopolskie'::public.voivodeship_enum),
      ('Warszawa', 'Mazowieckie'::public.voivodeship_enum),
      ('Opole', 'Opolskie'::public.voivodeship_enum),
      ('Rzeszów', 'Podkarpackie'::public.voivodeship_enum),
      ('Białystok', 'Podlaskie'::public.voivodeship_enum),
      ('Gdańsk', 'Pomorskie'::public.voivodeship_enum),
      ('Katowice', 'Śląskie'::public.voivodeship_enum),
      ('Kielce', 'Świętokrzyskie'::public.voivodeship_enum),
      ('Olsztyn', 'Warmińsko-mazurskie'::public.voivodeship_enum),
      ('Poznań', 'Wielkopolskie'::public.voivodeship_enum),
      ('Szczecin', 'Zachodniopomorskie'::public.voivodeship_enum)
  ) AS t(city_name, voivodeship)
),
insert_missing AS (
  INSERT INTO public."tbl_Cities" (id, city_name, voivodeship)
  SELECT
    gen_random_uuid(),
    c.city_name,
    c.voivodeship
  FROM capitals c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."tbl_Cities" x
    WHERE lower(x.city_name) = lower(c.city_name)
  )
  RETURNING id
)
UPDATE public."tbl_Cities" c
SET voivodeship = m.voivodeship
FROM capitals m
WHERE lower(c.city_name) = lower(m.city_name)
  AND c.voivodeship IS DISTINCT FROM m.voivodeship;
