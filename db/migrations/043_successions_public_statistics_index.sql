BEGIN;

CREATE INDEX IF NOT EXISTS "idx_tbl_Successions_precountry_effective_date_id"
  ON public."tbl_Successions" (precountry_id, effective_date, id)
  WHERE effective_date IS NOT NULL;

COMMIT;
