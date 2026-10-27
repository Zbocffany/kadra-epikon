-- Lista klubów w panelu admina (/admin/clubs) liczona w jednym zapytaniu
-- zamiast porcjowanych zapytań w TS (getAdminClubs). Statystyki dotyczą
-- zawodników klubu grających dla Polski: zawodnicy, występy, gole.

BEGIN;

CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_club_team_id"
  ON public."tbl_Match_Participants" (club_team_id)
  WHERE club_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tbl_Teams_club_id"
  ON public."tbl_Teams" (club_id)
  WHERE club_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_admin_clubs_list()
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
    SELECT match.id
    FROM public."tbl_Matches" AS match
    WHERE (
        match.home_team_id IN (SELECT id FROM poland_teams)
        OR match.away_team_id IN (SELECT id FROM poland_teams)
      )
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
  ),
  -- Występ = podstawowy skład albo wejście z ławki.
  played AS (
    SELECT DISTINCT club_team.club_id, mp.person_id, mp.match_id
    FROM public."tbl_Match_Participants" AS mp
    JOIN poland_matches ON poland_matches.id = mp.match_id
    JOIN public."tbl_Teams" AS club_team ON club_team.id = mp.club_team_id
    WHERE mp.role = 'PLAYER'
      AND mp.team_id IN (SELECT id FROM poland_teams)
      AND club_team.club_id IS NOT NULL
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
    SELECT club_id, count(DISTINCT person_id) AS player_count, count(*) AS appearance_count
    FROM played
    GROUP BY club_id
  ),
  goals AS (
    SELECT played.club_id, count(*) AS goal_count
    FROM played
    JOIN public."tbl_Match_Events" AS event
      ON event.match_id = played.match_id
     AND event.primary_person_id = played.person_id
    WHERE event.event_type IN ('GOAL', 'PENALTY_GOAL')
    GROUP BY played.club_id
  ),
  founded AS (
    SELECT club_id, min(event_date) AS founded_date
    FROM public."tbl_Club_History"
    WHERE event_type = 'FOUNDED'
      AND event_date IS NOT NULL
    GROUP BY club_id
  ),
  list AS (
    SELECT
      club.id,
      club.name,
      city.city_name,
      historical_country.name AS country_name,
      historical_country.fifa_code::text AS country_fifa_code,
      current_country.name AS country_current_name,
      current_country.fifa_code::text AS country_current_fifa_code,
      COALESCE(stats.player_count, 0) AS player_count,
      COALESCE(stats.appearance_count, 0) AS appearance_count,
      COALESCE(goals.goal_count, 0) AS goal_count
    FROM public."tbl_Clubs" AS club
    LEFT JOIN public."tbl_Cities" AS city ON city.id = club.club_city_id
    LEFT JOIN founded ON founded.club_id = club.id
    -- Ta sama kolejność co resolveCityCountry(): okres z daty założenia,
    -- potem okres otwarty, potem najpóźniejszy zamknięty.
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = club.club_city_id
      ORDER BY
        (
          founded.founded_date IS NOT NULL
          AND founded.founded_date >= COALESCE(period.valid_from, '-infinity'::date)
          AND founded.founded_date <= COALESCE(period.valid_to, 'infinity'::date)
        ) DESC,
        (period.valid_to IS NULL) DESC,
        period.valid_to DESC NULLS LAST,
        period.valid_from DESC NULLS LAST
      LIMIT 1
    ) AS historical_period ON club.club_city_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = club.club_city_id
      ORDER BY
        (period.valid_to IS NULL) DESC,
        period.valid_to DESC NULLS LAST,
        period.valid_from DESC NULLS LAST
      LIMIT 1
    ) AS current_period ON club.club_city_id IS NOT NULL
    LEFT JOIN public."tbl_Countries" AS historical_country
      ON historical_country.id = COALESCE(historical_period.country_id, city.current_country_id)
    LEFT JOIN public."tbl_Countries" AS current_country
      ON current_country.id = COALESCE(current_period.country_id, city.current_country_id)
    LEFT JOIN stats ON stats.club_id = club.id
    LEFT JOIN goals ON goals.club_id = club.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(list) ORDER BY list.name, list.id), '[]'::jsonb)
  FROM list
$$;

REVOKE ALL ON FUNCTION public.get_admin_clubs_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_clubs_list() TO service_role;

COMMIT;
