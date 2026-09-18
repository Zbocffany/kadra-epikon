-- 046_poland_players_unknown_voivodeship_rpc.sql
-- Trzeci RPC do widoku "Polska":
--   Lista reprezentantów, którzy urodzili się w Polsce (lub nie mamy informacji
--   o kraju), a nie mamy przypisanego województwa (brak birth_city_id lub
--   city.voivodeship IS NULL). Zasady kwalifikacji zawodnika = jak w RPC 045.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_poland_players_unknown_voivodeship()
RETURNS TABLE (
  person_id uuid,
  first_name text,
  last_name text,
  birth_city_id uuid,
  birth_city_name text,
  appearance_count bigint,
  goal_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  poland_country AS (
    SELECT country.id
    FROM public."tbl_Countries" AS country
    WHERE upper(trim(country.fifa_code::text)) = 'POL'
       OR lower(trim(country.name)) = 'polska'
    LIMIT 1
  ),
  poland_team AS (
    SELECT team.id
    FROM public."tbl_Teams" AS team
    WHERE team.club_id IS NULL
      AND team.country_id = (SELECT id FROM poland_country)
  ),
  eligible_matches AS (
    SELECT match.id AS match_id
    FROM public."tbl_Matches" AS match
    WHERE match.editorial_status = 'VERIFIED'
      AND match.match_status = 'FINISHED'
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND (
        match.home_team_id IN (SELECT id FROM poland_team)
        OR match.away_team_id IN (SELECT id FROM poland_team)
      )
  ),
  substitutions_in AS (
    SELECT DISTINCT event.match_id, event.secondary_person_id AS person_id
    FROM public."tbl_Match_Events" AS event
    WHERE event.event_type = 'SUBSTITUTION'
      AND event.secondary_person_id IS NOT NULL
      AND event.team_id IN (SELECT id FROM poland_team)
      AND event.match_id IN (SELECT match_id FROM eligible_matches)
  ),
  played_participants AS (
    SELECT DISTINCT mp.match_id, mp.person_id
    FROM public."tbl_Match_Participants" AS mp
    WHERE mp.role = 'PLAYER'
      AND mp.team_id IN (SELECT id FROM poland_team)
      AND mp.match_id IN (SELECT match_id FROM eligible_matches)
      AND (
        mp.is_starting = true
        OR EXISTS (
          SELECT 1 FROM substitutions_in AS si
          WHERE si.match_id = mp.match_id AND si.person_id = mp.person_id
        )
      )
  ),
  goal_events AS (
    SELECT event.primary_person_id AS person_id, count(*) AS cnt
    FROM public."tbl_Match_Events" AS event
    WHERE event.event_type IN ('GOAL', 'PENALTY_GOAL')
      AND event.team_id IN (SELECT id FROM poland_team)
      AND event.match_id IN (SELECT match_id FROM eligible_matches)
      AND event.primary_person_id IS NOT NULL
    GROUP BY event.primary_person_id
  ),
  unknown_players AS (
    SELECT
      person.id AS person_id,
      person.first_name,
      person.last_name,
      person.birth_city_id,
      birth_city.city_name AS birth_city_name
    FROM public."tbl_People" AS person
    LEFT JOIN public."tbl_Cities" AS birth_city ON birth_city.id = person.birth_city_id
    WHERE person.id IN (SELECT DISTINCT person_id FROM played_participants)
      -- brak województwa (albo brak city, albo city bez enum voivodeship)
      AND (person.birth_city_id IS NULL OR birth_city.voivodeship IS NULL)
      -- osoba NIE jest urodzona w innym kraju
      AND (
        birth_city.current_country_id IS NULL
        OR birth_city.current_country_id = (SELECT id FROM poland_country)
      )
      AND (
        person.birth_country_id IS NULL
        OR person.birth_country_id = (SELECT id FROM poland_country)
      )
  )
  SELECT
    up.person_id,
    up.first_name,
    up.last_name,
    up.birth_city_id,
    up.birth_city_name,
    count(DISTINCT pp.match_id)::bigint AS appearance_count,
    COALESCE(max(ge.cnt), 0)::bigint AS goal_count
  FROM unknown_players AS up
  JOIN played_participants AS pp ON pp.person_id = up.person_id
  LEFT JOIN goal_events AS ge ON ge.person_id = up.person_id
  GROUP BY up.person_id, up.first_name, up.last_name, up.birth_city_id, up.birth_city_name
  ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_poland_players_unknown_voivodeship() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poland_players_unknown_voivodeship() TO service_role;

COMMIT;
