-- 005_poland_voivodeships_for_cities.sql
--
-- Purpose:
--   1) Rename existing voivodeship_enum values to Polish display format
--      (First letter uppercase, no underscores, with Polish diacritics).
--   2) Fill tbl_Cities.voivodeship for Polish voivodeship-capital cities.
--
-- Notes:
--   - voivodeship_enum already exists in migration 008.
--   - This seed is idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'DOLNOSLASKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Dolnośląskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'DOLNOSLASKIE' TO 'Dolnośląskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'KUJAWSKO_POMORSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Kujawsko-pomorskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'KUJAWSKO_POMORSKIE' TO 'Kujawsko-pomorskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'LUBELSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Lubelskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'LUBELSKIE' TO 'Lubelskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'LUBUSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Lubuskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'LUBUSKIE' TO 'Lubuskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'LODZKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Łódzkie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'LODZKIE' TO 'Łódzkie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'MALOPOLSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Małopolskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'MALOPOLSKIE' TO 'Małopolskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'MAZOWIECKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Mazowieckie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'MAZOWIECKIE' TO 'Mazowieckie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'OPOLSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Opolskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'OPOLSKIE' TO 'Opolskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'PODKARPACKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Podkarpackie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'PODKARPACKIE' TO 'Podkarpackie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'PODLASKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Podlaskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'PODLASKIE' TO 'Podlaskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'POMORSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Pomorskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'POMORSKIE' TO 'Pomorskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'SLASKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Śląskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'SLASKIE' TO 'Śląskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'SWIETOKRZYSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Świętokrzyskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'SWIETOKRZYSKIE' TO 'Świętokrzyskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'WARMINSKO_MAZURSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Warmińsko-mazurskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'WARMINSKO_MAZURSKIE' TO 'Warmińsko-mazurskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'WIELKOPOLSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Wielkopolskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'WIELKOPOLSKIE' TO 'Wielkopolskie';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'ZACHODNIOPOMORSKIE'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'voivodeship_enum'
      AND e.enumlabel = 'Zachodniopomorskie'
  ) THEN
    ALTER TYPE public.voivodeship_enum RENAME VALUE 'ZACHODNIOPOMORSKIE' TO 'Zachodniopomorskie';
  END IF;
END $$;

WITH voiv_map AS (
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
  ) AS t(city_alias, voivodeship)
)
UPDATE public."tbl_Cities" c
SET voivodeship = m.voivodeship
FROM voiv_map m
WHERE lower(c.city_name) = lower(m.city_alias)
  AND c.voivodeship IS DISTINCT FROM m.voivodeship;
