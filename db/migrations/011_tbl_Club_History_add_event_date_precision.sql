-- 0XX_tbl_Club_History_add_event_date_precision.sql

-- 1) Create enum type (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'event_date_precision_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.event_date_precision_enum AS ENUM ('YEAR', 'MONTH', 'DAY');
  END IF;
END $$;

-- 2) Add column (nullable)
ALTER TABLE public."tbl_Club_History"
  ADD COLUMN IF NOT EXISTS event_date_precision public.event_date_precision_enum NULL;

-- 3) Backfill existing rows safely
UPDATE public."tbl_Club_History"
SET event_date_precision = 'DAY'::public.event_date_precision_enum
WHERE event_date IS NOT NULL
  AND event_date_precision IS NULL;

-- 4) Add consistency CHECK constraint (safe way)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_tbl_Club_History_event_date_precision_consistency'
  ) THEN
    ALTER TABLE public."tbl_Club_History"
      ADD CONSTRAINT "chk_tbl_Club_History_event_date_precision_consistency"
      CHECK (
        (event_date IS NULL AND event_date_precision IS NULL)
        OR
        (event_date IS NOT NULL AND event_date_precision IS NOT NULL)
      );
  END IF;
END $$;
