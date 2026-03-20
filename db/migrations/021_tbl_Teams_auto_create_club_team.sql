-- 021_tbl_Teams_auto_create_club_team.sql
--
-- Goal:
--   1) Backfill missing club-team rows in tbl_Teams for existing clubs.
--   2) Auto-create team row when a new club is inserted.
--
-- Notes:
--   - One club should map to exactly one team row where country_id IS NULL.
--   - Script is idempotent.

-- 1) Backfill missing club teams
INSERT INTO public."tbl_Teams" (id, country_id, club_id)
SELECT
  gen_random_uuid(),
  NULL,
  c.id
FROM public."tbl_Clubs" c
LEFT JOIN public."tbl_Teams" t
  ON t.club_id = c.id
WHERE t.id IS NULL;

-- 2) Trigger function for future inserts
CREATE OR REPLACE FUNCTION public.fn_tbl_clubs_create_team()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public."tbl_Teams" (id, country_id, club_id)
  VALUES (gen_random_uuid(), NULL, NEW.id)
  ON CONFLICT (club_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Trigger binding
DROP TRIGGER IF EXISTS trg_tbl_clubs_create_team ON public."tbl_Clubs";

CREATE TRIGGER trg_tbl_clubs_create_team
AFTER INSERT ON public."tbl_Clubs"
FOR EACH ROW
EXECUTE FUNCTION public.fn_tbl_clubs_create_team();
