-- Lista miast w panelu admina (/admin/cities) liczona w jednym zapytaniu
-- zamiast porcjowanych zapytań w TS (getAdminCitiesList). Statystyki dotyczą
-- zawodników urodzonych w mieście i grających dla Polski: zawodnicy, występy, gole.
-- Indeksy: tbl_People (birth_city_id) z 037/045, tbl_Match_Participants (team_id, role, person_id) z 045.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_cities_list()
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
  -- Występ = podstawowy skład albo wejście z ławki.
  played AS (
    SELECT DISTINCT person.birth_city_id AS city_id, mp.person_id, mp.match_id
    FROM public."tbl_Match_Participants" AS mp
    JOIN public."tbl_People" AS person ON person.id = mp.person_id
    JOIN public."tbl_Matches" AS match ON match.id = mp.match_id
    WHERE mp.role = 'PLAYER'
      AND mp.team_id IN (SELECT id FROM poland_teams)
      AND person.birth_city_id IS NOT NULL
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND (
        mp.is_starting
        OR EXISTS (
          SELECT 1
          FROM public."tbl_Match_Events" AS event
          WHERE event.match_id = mp.match_id
            AND event.event_type = 'SUBSTITUTION'
            AND event.secondary_person_id = mp.person_id
        )
      )
  ),
  stats AS (
    SELECT city_id, count(DISTINCT person_id) AS player_count, count(*) AS appearance_count
    FROM played
    GROUP BY city_id
  ),
  goals AS (
    SELECT played.city_id, count(*) AS goal_count
    FROM played
    JOIN public."tbl_Match_Events" AS event
      ON event.match_id = played.match_id
     AND event.primary_person_id = played.person_id
    WHERE event.event_type IN ('GOAL', 'PENALTY_GOAL')
    GROUP BY played.city_id
  ),
  list AS (
    SELECT
      city.id,
      city.city_name,
      country.name AS country_name,
      country.fifa_code::text AS country_fifa_code,
      COALESCE(stats.player_count, 0) AS player_count,
      COALESCE(stats.appearance_count, 0) AS appearance_count,
      COALESCE(goals.goal_count, 0) AS goal_count
    FROM public."tbl_Cities" AS city
    LEFT JOIN public."tbl_Countries" AS country ON country.id = city.current_country_id
    LEFT JOIN stats ON stats.city_id = city.id
    LEFT JOIN goals ON goals.city_id = city.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(list) ORDER BY list.city_name, list.id), '[]'::jsonb)
  FROM list
$$;

REVOKE ALL ON FUNCTION public.get_admin_cities_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_cities_list() TO service_role;

COMMIT;
