-- 018_tbl_Country_History_add_event_date_precision.sql
--
-- Purpose:
--   Add event_date_precision to tbl_Country_History, reusing the existing
--   event_date_precision_enum (YEAR | MONTH | DAY) created in migration 011.
--
-- Logic:
--   - Backfill existing rows that have event_date set to 'DAY'.
--   - Add CHECK constraint: date and precision must both be set or both NULL.

ALTER TABLE public."tbl_Country_History"
  ADD COLUMN IF NOT EXISTS event_date_precision public.event_date_precision_enum NULL;

UPDATE public."tbl_Country_History"
SET event_date_precision = 'DAY'::public.event_date_precision_enum
WHERE event_date IS NOT NULL
  AND event_date_precision IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_tbl_Country_History_event_date_precision_consistency'
  ) THEN
    ALTER TABLE public."tbl_Country_History"
      ADD CONSTRAINT "chk_tbl_Country_History_event_date_precision_consistency"
      CHECK (
        (event_date IS NULL AND event_date_precision IS NULL)
        OR
        (event_date IS NOT NULL AND event_date_precision IS NOT NULL)
      );
  END IF;
END $$;
