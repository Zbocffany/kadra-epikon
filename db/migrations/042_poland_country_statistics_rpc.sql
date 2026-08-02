BEGIN;

CREATE INDEX IF NOT EXISTS "idx_tbl_Teams_country_id_national"
  ON public."tbl_Teams" (country_id)
  WHERE club_id IS NULL AND country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_verified_finished_home_date"
  ON public."tbl_Matches" (home_team_id, match_date)
  WHERE editorial_status = 'VERIFIED'
    AND match_status = 'FINISHED'
    AND result_type IS DISTINCT FROM 'WALKOVER';

CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_verified_finished_away_date"
  ON public."tbl_Matches" (away_team_id, match_date)
  WHERE editorial_status = 'VERIFIED'
    AND match_status = 'FINISHED'
    AND result_type IS DISTINCT FROM 'WALKOVER';

CREATE OR REPLACE FUNCTION public.get_poland_country_statistics()
RETURNS TABLE (
  country_id uuid,
  country_name text,
  fifa_code text,
  matches bigint,
  wins bigint,
  draws bigint,
  losses bigint,
  goals_for bigint,
  goals_against bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH RECURSIVE
  poland_teams AS (
    SELECT team.id
    FROM public."tbl_Teams" AS team
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE team.club_id IS NULL
      AND (
        upper(trim(country.fifa_code::text)) = 'POL'
        OR lower(trim(country.name)) = 'polska'
      )
  ),
  base_matches AS (
    SELECT
      match.id AS match_id,
      match.match_date,
      opponent.country_id AS original_country_id,
      CASE
        WHEN match.home_team_id IN (SELECT id FROM poland_teams) THEN match.home_goals
        ELSE match.away_goals
      END AS poland_goals,
      CASE
        WHEN match.home_team_id IN (SELECT id FROM poland_teams) THEN match.away_goals
        ELSE match.home_goals
      END AS opponent_goals
    FROM public."tbl_Matches" AS match
    JOIN public."tbl_Teams" AS opponent
      ON opponent.id = CASE
        WHEN match.home_team_id IN (SELECT id FROM poland_teams) THEN match.away_team_id
        ELSE match.home_team_id
      END
    WHERE match.editorial_status = 'VERIFIED'
      AND match.match_status = 'FINISHED'
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND opponent.club_id IS NULL
      AND opponent.country_id IS NOT NULL
      AND (
        match.home_team_id IN (SELECT id FROM poland_teams)
        OR match.away_team_id IN (SELECT id FROM poland_teams)
      )
  ),
  succession_walk AS (
    SELECT
      base.match_id,
      base.match_date,
      base.original_country_id AS resolved_country_id,
      base.match_date AS cursor_date,
      base.poland_goals,
      base.opponent_goals,
      ARRAY[]::uuid[] AS traversed_successions,
      0 AS depth
    FROM base_matches AS base

    UNION ALL

    SELECT
      walk.match_id,
      walk.match_date,
      successor.postcountry_id,
      successor.effective_date,
      walk.poland_goals,
      walk.opponent_goals,
      walk.traversed_successions || successor.id,
      walk.depth + 1
    FROM succession_walk AS walk
    JOIN LATERAL (
      SELECT
        succession.id,
        succession.postcountry_id,
        succession.effective_date
      FROM public."tbl_Successions" AS succession
      WHERE succession.precountry_id = walk.resolved_country_id
        AND succession.effective_date IS NOT NULL
        AND succession.effective_date > walk.cursor_date
        AND NOT succession.id = ANY(walk.traversed_successions)
      ORDER BY succession.effective_date ASC, succession.id ASC
      LIMIT 1
    ) AS successor ON true
    WHERE walk.depth < 32
  ),
  resolved_matches AS (
    SELECT DISTINCT ON (walk.match_id)
      walk.match_id,
      walk.resolved_country_id,
      walk.poland_goals,
      walk.opponent_goals
    FROM succession_walk AS walk
    ORDER BY walk.match_id, walk.depth DESC
  )
  SELECT
    country.id AS country_id,
    country.name AS country_name,
    trim(country.fifa_code::text) AS fifa_code,
    count(*) AS matches,
    count(*) FILTER (
      WHERE resolved.poland_goals > resolved.opponent_goals
    ) AS wins,
    count(*) FILTER (
      WHERE resolved.poland_goals = resolved.opponent_goals
    ) AS draws,
    count(*) FILTER (
      WHERE resolved.poland_goals < resolved.opponent_goals
    ) AS losses,
    sum(resolved.poland_goals)::bigint AS goals_for,
    sum(resolved.opponent_goals)::bigint AS goals_against
  FROM resolved_matches AS resolved
  JOIN public."tbl_Countries" AS country ON country.id = resolved.resolved_country_id
  GROUP BY country.id, country.name, country.fifa_code
  ORDER BY country.name;
$$;

REVOKE ALL ON FUNCTION public.get_poland_country_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poland_country_statistics() TO service_role;

CREATE OR REPLACE FUNCTION public.get_poland_match_ids_for_football_country(
  p_country_id uuid
)
RETURNS TABLE (match_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH RECURSIVE
  poland_teams AS (
    SELECT team.id
    FROM public."tbl_Teams" AS team
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE team.club_id IS NULL
      AND (
        upper(trim(country.fifa_code::text)) = 'POL'
        OR lower(trim(country.name)) = 'polska'
      )
  ),
  base_matches AS (
    SELECT
      match.id AS match_id,
      match.match_date,
      opponent.country_id AS original_country_id
    FROM public."tbl_Matches" AS match
    JOIN public."tbl_Teams" AS opponent
      ON opponent.id = CASE
        WHEN match.home_team_id IN (SELECT id FROM poland_teams) THEN match.away_team_id
        ELSE match.home_team_id
      END
    WHERE match.editorial_status = 'VERIFIED'
      AND match.match_status = 'FINISHED'
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND opponent.club_id IS NULL
      AND opponent.country_id IS NOT NULL
      AND (
        match.home_team_id IN (SELECT id FROM poland_teams)
        OR match.away_team_id IN (SELECT id FROM poland_teams)
      )
  ),
  succession_walk AS (
    SELECT
      base.match_id,
      base.original_country_id AS resolved_country_id,
      base.match_date AS cursor_date,
      ARRAY[]::uuid[] AS traversed_successions,
      0 AS depth
    FROM base_matches AS base

    UNION ALL

    SELECT
      walk.match_id,
      successor.postcountry_id,
      successor.effective_date,
      walk.traversed_successions || successor.id,
      walk.depth + 1
    FROM succession_walk AS walk
    JOIN LATERAL (
      SELECT
        succession.id,
        succession.postcountry_id,
        succession.effective_date
      FROM public."tbl_Successions" AS succession
      WHERE succession.precountry_id = walk.resolved_country_id
        AND succession.effective_date IS NOT NULL
        AND succession.effective_date > walk.cursor_date
        AND NOT succession.id = ANY(walk.traversed_successions)
      ORDER BY succession.effective_date ASC, succession.id ASC
      LIMIT 1
    ) AS successor ON true
    WHERE walk.depth < 32
  ),
  resolved_matches AS (
    SELECT DISTINCT ON (walk.match_id)
      walk.match_id,
      walk.resolved_country_id
    FROM succession_walk AS walk
    ORDER BY walk.match_id, walk.depth DESC
  )
  SELECT resolved.match_id
  FROM resolved_matches AS resolved
  WHERE resolved.resolved_country_id = p_country_id
  ORDER BY resolved.match_id;
$$;

REVOKE ALL ON FUNCTION public.get_poland_match_ids_for_football_country(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poland_match_ids_for_football_country(uuid) TO service_role;

COMMIT;