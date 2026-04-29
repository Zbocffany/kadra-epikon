BEGIN;

ALTER TABLE "tbl_Matches"
  DROP CONSTRAINT IF EXISTS "chk_tbl_Matches_stadium_or_city";

ALTER TABLE "tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_stadium_or_city"
  CHECK (
    result_type = 'WALKOVER'
    OR match_stadium_id IS NOT NULL
    OR match_city_id IS NOT NULL
  );

COMMIT;
