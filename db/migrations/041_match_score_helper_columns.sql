BEGIN;

ALTER TABLE public."tbl_Matches"
  ADD COLUMN IF NOT EXISTS home_goals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_goals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_goals_ht integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_goals_ht integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_shootout_goals integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_shootout_goals integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_tbl_Matches_nonnegative_score'
      AND conrelid = 'public."tbl_Matches"'::regclass
  ) THEN
    ALTER TABLE public."tbl_Matches"
      ADD CONSTRAINT "chk_tbl_Matches_nonnegative_score" CHECK (
        home_goals >= 0
        AND away_goals >= 0
        AND home_goals_ht >= 0
        AND away_goals_ht >= 0
        AND home_shootout_goals >= 0
        AND away_shootout_goals >= 0
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_match_score(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public."tbl_Matches" AS match
  SET
    home_goals = score.home_goals,
    away_goals = score.away_goals,
    home_goals_ht = score.home_goals_ht,
    away_goals_ht = score.away_goals_ht,
    home_shootout_goals = score.home_shootout_goals,
    away_shootout_goals = score.away_shootout_goals
  FROM (
    SELECT
      count(*) FILTER (
        WHERE event.event_type IN ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL')
          AND event.team_id = source_match.home_team_id
      )::integer AS home_goals,
      count(*) FILTER (
        WHERE event.event_type IN ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL')
          AND event.team_id = source_match.away_team_id
      )::integer AS away_goals,
      count(*) FILTER (
        WHERE event.event_type IN ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL')
          AND event.team_id = source_match.home_team_id
          AND event.minute <= 45
      )::integer AS home_goals_ht,
      count(*) FILTER (
        WHERE event.event_type IN ('GOAL', 'OWN_GOAL', 'PENALTY_GOAL')
          AND event.team_id = source_match.away_team_id
          AND event.minute <= 45
      )::integer AS away_goals_ht,
      count(*) FILTER (
        WHERE event.event_type = 'PENALTY_SHOOTOUT_SCORED'
          AND event.team_id = source_match.home_team_id
      )::integer AS home_shootout_goals,
      count(*) FILTER (
        WHERE event.event_type = 'PENALTY_SHOOTOUT_SCORED'
          AND event.team_id = source_match.away_team_id
      )::integer AS away_shootout_goals
    FROM public."tbl_Matches" AS source_match
    LEFT JOIN public."tbl_Match_Events" AS event
      ON event.match_id = source_match.id
    WHERE source_match.id = p_match_id
    GROUP BY source_match.id
  ) AS score
  WHERE match.id = p_match_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_inserted_match_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_match_id uuid;
BEGIN
  FOR affected_match_id IN
    SELECT DISTINCT match_id FROM inserted_events WHERE match_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_match_score(affected_match_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_deleted_match_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_match_id uuid;
BEGIN
  FOR affected_match_id IN
    SELECT DISTINCT match_id FROM deleted_events WHERE match_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_match_score(affected_match_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_updated_match_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_match_id uuid;
BEGIN
  FOR affected_match_id IN
    SELECT match_id FROM inserted_events WHERE match_id IS NOT NULL
    UNION
    SELECT match_id FROM deleted_events WHERE match_id IS NOT NULL
  LOOP
    PERFORM public.recalculate_match_score(affected_match_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_match_score_after_team_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.recalculate_match_score(NEW.id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_match_score(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_inserted_match_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_deleted_match_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_updated_match_scores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_match_score_after_team_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS "trg_recalculate_match_score_insert" ON public."tbl_Match_Events";
CREATE TRIGGER "trg_recalculate_match_score_insert"
AFTER INSERT ON public."tbl_Match_Events"
REFERENCING NEW TABLE AS inserted_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.recalculate_inserted_match_scores();

DROP TRIGGER IF EXISTS "trg_recalculate_match_score_delete" ON public."tbl_Match_Events";
CREATE TRIGGER "trg_recalculate_match_score_delete"
AFTER DELETE ON public."tbl_Match_Events"
REFERENCING OLD TABLE AS deleted_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.recalculate_deleted_match_scores();

DROP TRIGGER IF EXISTS "trg_recalculate_match_score_update" ON public."tbl_Match_Events";
CREATE TRIGGER "trg_recalculate_match_score_update"
AFTER UPDATE ON public."tbl_Match_Events"
REFERENCING OLD TABLE AS deleted_events NEW TABLE AS inserted_events
FOR EACH STATEMENT
EXECUTE FUNCTION public.recalculate_updated_match_scores();

DROP TRIGGER IF EXISTS "trg_recalculate_match_score_team_change" ON public."tbl_Matches";
CREATE TRIGGER "trg_recalculate_match_score_team_change"
AFTER UPDATE OF home_team_id, away_team_id ON public."tbl_Matches"
FOR EACH ROW
WHEN (
  OLD.home_team_id IS DISTINCT FROM NEW.home_team_id
  OR OLD.away_team_id IS DISTINCT FROM NEW.away_team_id
)
EXECUTE FUNCTION public.recalculate_match_score_after_team_change();

DO $$
DECLARE
  match_id_to_recalculate uuid;
BEGIN
  FOR match_id_to_recalculate IN
    SELECT id FROM public."tbl_Matches"
  LOOP
    PERFORM public.recalculate_match_score(match_id_to_recalculate);
  END LOOP;
END $$;

COMMENT ON COLUMN public."tbl_Matches".home_goals IS
  'Derived goals credited to the home team during regulation and extra time. Excludes shootouts.';
COMMENT ON COLUMN public."tbl_Matches".away_goals IS
  'Derived goals credited to the away team during regulation and extra time. Excludes shootouts.';
COMMENT ON COLUMN public."tbl_Matches".home_goals_ht IS
  'Derived home goals through minute 45. Excludes shootouts.';
COMMENT ON COLUMN public."tbl_Matches".away_goals_ht IS
  'Derived away goals through minute 45. Excludes shootouts.';
COMMENT ON COLUMN public."tbl_Matches".home_shootout_goals IS
  'Derived successful home-team kicks in a post-match penalty shootout.';
COMMENT ON COLUMN public."tbl_Matches".away_shootout_goals IS
  'Derived successful away-team kicks in a post-match penalty shootout.';

COMMENT ON COLUMN public."tbl_Matches".editorial_status IS
'Editorial workflow status, distinct from sporting match_status.

Values: DRAFT, PARTIAL, COMPLETE, VERIFIED.
VERIFIED is only allowed for a concluded match.

Match-event rows remain the score source of truth. Helper score columns on tbl_Matches
are maintained automatically by database triggers.';

COMMIT;