-- 0XX_tbl_Club_History_event_type_enum.sql

-- 1) Create enum type (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'club_history_event_type_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.club_history_event_type_enum AS ENUM (
      'FOUNDED',
      'DISSOLVED',
      'NAME_CHANGED',
      'RELOCATED',
      'MERGED',
      'REFORMED'
    );
  END IF;
END $$;

-- 2) Convert column type from text -> enum
--    Mapping rules:
--    - NULL stays NULL
--    - values are normalized to upper-case and cast to enum
--    - if existing values are not in the enum, this will fail (good: it forces cleanup)
ALTER TABLE public."tbl_Club_History"
  ALTER COLUMN event_type TYPE public.club_history_event_type_enum
  USING (
    CASE
      WHEN event_type IS NULL THEN NULL
      ELSE upper(btrim(event_type))::public.club_history_event_type_enum
    END
  );
