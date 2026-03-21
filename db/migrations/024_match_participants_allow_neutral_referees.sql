BEGIN;

DROP INDEX IF EXISTS public."tbl_Match_Participants_match_id_team_id_person_id_role_idx";

ALTER TABLE public."tbl_Match_Participants"
  ALTER COLUMN team_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "tbl_Match_Participants_match_id_team_id_person_id_role_idx"
ON public."tbl_Match_Participants" USING btree (match_id, team_id, person_id, role)
WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "tbl_Match_Participants_match_id_person_id_role_referee_idx"
ON public."tbl_Match_Participants" USING btree (match_id, person_id, role)
WHERE team_id IS NULL;

COMMENT ON COLUMN public."tbl_Match_Participants".team_id IS
'Wymagane dla PLAYER i COACH. Dla REFEREE pole powinno być NULL, bo sędzia nie należy do żadnej z drużyn.';

COMMIT;