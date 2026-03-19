-- 019_tbl_Successions_add_source_event_id.sql
--
-- Purpose:
--   Link football succession rows to a concrete country-history event.
--   This allows showing and editing succession directly in event details.

ALTER TABLE public."tbl_Successions"
  ADD COLUMN IF NOT EXISTS source_event_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tbl_Successions_source_event_id'
  ) THEN
    ALTER TABLE public."tbl_Successions"
      ADD CONSTRAINT "fk_tbl_Successions_source_event_id"
      FOREIGN KEY (source_event_id)
      REFERENCES public."tbl_Country_History"(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tbl_Successions_source_event_id
  ON public."tbl_Successions"(source_event_id);
