-- Listy krajów i stadionów w panelu admina liczone w jednym zapytaniu każda
-- (spójnie z 050–052). Bilans dotyczy meczów reprezentacji Polski.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_countries_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH list AS (
    SELECT
      country.id,
      country.name,
      country.fifa_code::text AS fifa_code,
      federation.short_name AS federation_short_name,
      COALESCE(stats.matches, 0) AS matches,
      COALESCE(stats.wins, 0) AS wins,
      COALESCE(stats.draws, 0) AS draws,
      COALESCE(stats.losses, 0) AS losses,
      COALESCE(stats.goals_for, 0) AS goals_for,
      COALESCE(stats.goals_against, 0) AS goals_against
    FROM public."tbl_Countries" AS country
    LEFT JOIN public."tbl_Federations" AS federation ON federation.id = country.federation_id
    LEFT JOIN public.get_poland_country_statistics() AS stats ON stats.country_id = country.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(list) ORDER BY list.name, list.id), '[]'::jsonb)
  FROM list
$$;

REVOKE ALL ON FUNCTION public.get_admin_countries_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_countries_list() TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_stadiums_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  poland_teams AS (
    SELECT team.id
    FROM public."tbl_Teams" AS team
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE team.club_id IS NULL
      AND lower(trim(country.name)) = 'polska'
  ),
  poland_matches AS (
    SELECT
      match.match_stadium_id AS stadium_id,
      CASE WHEN match.home_team_id IN (SELECT id FROM poland_teams)
        THEN match.home_goals ELSE match.away_goals END AS poland_goals,
      CASE WHEN match.home_team_id IN (SELECT id FROM poland_teams)
        THEN match.away_goals ELSE match.home_goals END AS opponent_goals
    FROM public."tbl_Matches" AS match
    WHERE (
        match.home_team_id IN (SELECT id FROM poland_teams)
        OR match.away_team_id IN (SELECT id FROM poland_teams)
      )
      AND match.match_stadium_id IS NOT NULL
      AND match.match_status = 'FINISHED'
      AND match.editorial_status = 'VERIFIED'
      AND match.result_type <> 'WALKOVER'
  ),
  stats AS (
    SELECT
      stadium_id,
      count(*) AS matches,
      count(*) FILTER (WHERE poland_goals > opponent_goals) AS wins,
      count(*) FILTER (WHERE poland_goals = opponent_goals) AS draws,
      count(*) FILTER (WHERE poland_goals < opponent_goals) AS losses,
      sum(poland_goals) AS goals_for,
      sum(opponent_goals) AS goals_against
    FROM poland_matches
    GROUP BY stadium_id
  ),
  list AS (
    SELECT
      stadium.id,
      stadium.name,
      stadium.stadium_city_id,
      city.city_name,
      country.name AS country_name,
      country.fifa_code::text AS country_fifa_code,
      COALESCE(stats.matches, 0) AS matches,
      COALESCE(stats.wins, 0) AS wins,
      COALESCE(stats.draws, 0) AS draws,
      COALESCE(stats.losses, 0) AS losses,
      COALESCE(stats.goals_for, 0) AS goals_for,
      COALESCE(stats.goals_against, 0) AS goals_against
    FROM public."tbl_Stadiums" AS stadium
    LEFT JOIN public."tbl_Cities" AS city ON city.id = stadium.stadium_city_id
    LEFT JOIN public."tbl_Countries" AS country ON country.id = city.current_country_id
    LEFT JOIN stats ON stats.stadium_id = stadium.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(list) ORDER BY list.name, list.id), '[]'::jsonb)
  FROM list
$$;

REVOKE ALL ON FUNCTION public.get_admin_stadiums_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_stadiums_list() TO service_role;

COMMIT;
