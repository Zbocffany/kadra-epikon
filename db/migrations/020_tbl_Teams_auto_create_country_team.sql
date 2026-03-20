-- 020_tbl_Teams_auto_create_country_team.sql
--
-- Goal:
--   1) Backfill missing national-team rows in tbl_Teams for existing countries.
--   2) Auto-create team row when a new country is inserted.
--
-- Notes:
--   - One country should map to exactly one team row where club_id IS NULL.
--   - Script is idempotent.

-- 1) Backfill missing country teams
INSERT INTO public."tbl_Teams" (id, country_id, club_id)
SELECT
  gen_random_uuid(),
  c.id,
  NULL
FROM public."tbl_Countries" c
LEFT JOIN public."tbl_Teams" t
  ON t.country_id = c.id
WHERE t.id IS NULL;

-- 2) Trigger function for future inserts
CREATE OR REPLACE FUNCTION public.fn_tbl_countries_create_team()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public."tbl_Teams" (id, country_id, club_id)
  VALUES (gen_random_uuid(), NEW.id, NULL)
  ON CONFLICT (country_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Trigger binding
DROP TRIGGER IF EXISTS trg_tbl_countries_create_team ON public."tbl_Countries";

CREATE TRIGGER trg_tbl_countries_create_team
AFTER INSERT ON public."tbl_Countries"
FOR EACH ROW
EXECUTE FUNCTION public.fn_tbl_countries_create_team();
