-- 0XX_add_federations_remove_iso_add_voivodeship.sql

-- =========================================================
-- 1) Remove iso_code from tbl_Countries (drop constraints first)
-- =========================================================

ALTER TABLE public."tbl_Countries"
  DROP CONSTRAINT IF EXISTS "tbl_Countries_iso_code_unique";

ALTER TABLE public."tbl_Countries"
  DROP CONSTRAINT IF EXISTS "tbl_Countries_iso_code_format_check";

ALTER TABLE public."tbl_Countries"
  DROP COLUMN IF EXISTS iso_code;


-- =========================================================
-- 2) Add voivodeship enum + nullable column to tbl_Cities
--    (values in Polish, without diacritics for easier handling)
-- =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'voivodeship_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.voivodeship_enum AS ENUM (
      'DOLNOSLASKIE',
      'KUJAWSKO_POMORSKIE',
      'LUBELSKIE',
      'LUBUSKIE',
      'LODZKIE',
      'MALOPOLSKIE',
      'MAZOWIECKIE',
      'OPOLSKIE',
      'PODKARPACKIE',
      'PODLASKIE',
      'POMORSKIE',
      'SLASKIE',
      'SWIETOKRZYSKIE',
      'WARMINSKO_MAZURSKIE',
      'WIELKOPOLSKIE',
      'ZACHODNIOPOMORSKIE'
    );
  END IF;
END $$;

ALTER TABLE public."tbl_Cities"
  ADD COLUMN IF NOT EXISTS voivodeship public.voivodeship_enum NULL;


-- =========================================================
-- 3) Create tbl_Federations and add federation_id to tbl_Countries
-- =========================================================

CREATE TABLE IF NOT EXISTS public."tbl_Federations" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  short_name text NOT NULL,
  full_name text NOT NULL,
  foundation_year integer NULL,
  CONSTRAINT "tbl_Federations_pkey" PRIMARY KEY (id),
  CONSTRAINT "tbl_Federations_short_name_unique" UNIQUE (short_name),
  CONSTRAINT "chk_tbl_Federations_foundation_year_reasonable" CHECK (
    foundation_year IS NULL OR
    (foundation_year >= 1800 AND foundation_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int)
  )
) TABLESPACE pg_default;

ALTER TABLE public."tbl_Countries"
  ADD COLUMN IF NOT EXISTS federation_id uuid NULL;

-- FK (add only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tbl_Countries_federation_id_fkey'
  ) THEN
    ALTER TABLE public."tbl_Countries"
      ADD CONSTRAINT "tbl_Countries_federation_id_fkey"
      FOREIGN KEY (federation_id)
      REFERENCES public."tbl_Federations" (id);
  END IF;
END $$;
