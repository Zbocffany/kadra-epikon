BEGIN;

ALTER TABLE "tbl_Matches"
  ADD COLUMN IF NOT EXISTS "walkover_winner_team_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tbl_Matches_walkover_winner_team'
      AND table_name = 'tbl_Matches'
  ) THEN
    ALTER TABLE "tbl_Matches"
      ADD CONSTRAINT "fk_tbl_Matches_walkover_winner_team"
      FOREIGN KEY ("walkover_winner_team_id") REFERENCES "tbl_Teams" ("id");
  END IF;
END $$;

ALTER TABLE "tbl_Matches"
  DROP CONSTRAINT IF EXISTS "chk_tbl_Matches_walkover_winner_team";

ALTER TABLE "tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_walkover_winner_team"
  CHECK (
    (
      result_type = 'WALKOVER'
      AND walkover_winner_team_id IS NOT NULL
      AND (
        walkover_winner_team_id = home_team_id
        OR walkover_winner_team_id = away_team_id
      )
    )
    OR
    (
      result_type IS DISTINCT FROM 'WALKOVER'
      AND walkover_winner_team_id IS NULL
    )
  ) NOT VALID;

COMMIT;