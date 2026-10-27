-- Poprawka 054: statystyki roczne pomijają mecze zaplanowane (SCHEDULED),
-- tak jak wcześniejsze liczenie w TS — trener wpisany do przyszłego meczu nie zawyża licznika.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_matches_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  team_info AS (
    SELECT
      team.id,
      CASE
        WHEN team.country_id IS NOT NULL THEN COALESCE(country.name, '—')
        ELSE COALESCE(club.name, '—')
      END AS name,
      CASE WHEN team.country_id IS NOT NULL THEN country.fifa_code::text END AS fifa_code
    FROM public."tbl_Teams" AS team
    LEFT JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    LEFT JOIN public."tbl_Clubs" AS club ON club.id = team.club_id
  ),
  match_list AS (
    SELECT
      match.id,
      match.match_date,
      match.match_time,
      match.match_status,
      match.result_type,
      match.walkover_winner_team_id,
      match.attendance,
      match.editorial_status,
      COALESCE(competition.name, '—') AS competition_name,
      level.name AS match_level_name,
      COALESCE(home.name, '—') AS home_team_name,
      COALESCE(away.name, '—') AS away_team_name,
      home.fifa_code AS home_team_fifa_code,
      away.fifa_code AS away_team_fifa_code,
      CASE
        WHEN match.result_type = 'WALKOVER' AND match.walkover_winner_team_id = match.home_team_id THEN '3:0'
        WHEN match.result_type = 'WALKOVER' AND match.walkover_winner_team_id = match.away_team_id THEN '0:3'
        WHEN match.match_status = 'FINISHED' THEN match.home_goals || ':' || match.away_goals
      END AS final_score,
      CASE
        WHEN match.result_type IN ('PENALTIES', 'EXTRA_TIME_AND_PENALTIES')
          THEN match.home_shootout_goals || ':' || match.away_shootout_goals
      END AS shootout_score
    FROM public."tbl_Matches" AS match
    LEFT JOIN public."tbl_Competitions" AS competition ON competition.id = match.competition_id
    LEFT JOIN public."tbl_Match_Levels" AS level ON level.id = match.match_level_id
    LEFT JOIN team_info AS home ON home.id = match.home_team_id
    LEFT JOIN team_info AS away ON away.id = match.away_team_id
  ),
  poland_country AS (
    SELECT COALESCE(
      (SELECT id FROM public."tbl_Countries" WHERE fifa_code = 'POL' LIMIT 1),
      (SELECT id FROM public."tbl_Countries" WHERE name ILIKE 'Polska' LIMIT 1)
    ) AS id
  ),
  poland_participants AS (
    SELECT
      to_char(match.match_date, 'YYYY') AS year,
      mp.match_id,
      mp.person_id,
      mp.role,
      mp.is_starting
    FROM public."tbl_Match_Participants" AS mp
    JOIN public."tbl_Matches" AS match ON match.id = mp.match_id
    JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
    WHERE team.country_id = (SELECT id FROM poland_country)
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND match.match_status <> 'SCHEDULED'
  ),
  person_names AS (
    SELECT
      person.id,
      COALESCE(
        NULLIF(concat_ws(' ', NULLIF(trim(person.first_name), ''), NULLIF(trim(person.last_name), '')), ''),
        NULLIF(trim(person.nickname), ''),
        '—'
      ) AS name
    FROM public."tbl_People" AS person
  ),
  coach_counts AS (
    SELECT year, person_id, count(*) AS cnt
    FROM poland_participants
    WHERE role = 'COACH'
    GROUP BY year, person_id
  ),
  appearance_counts AS (
    SELECT pp.year, pp.person_id, count(*) AS cnt
    FROM poland_participants AS pp
    WHERE pp.role = 'PLAYER'
      AND (
        pp.is_starting IS TRUE
        OR EXISTS (
          SELECT 1
          FROM public."tbl_Match_Events" AS event
          WHERE event.match_id = pp.match_id
            AND event.event_type = 'SUBSTITUTION'
            AND event.secondary_person_id = pp.person_id
        )
      )
    GROUP BY pp.year, pp.person_id
  ),
  goal_counts AS (
    SELECT players.year, players.person_id, count(*) AS cnt
    FROM (
      SELECT DISTINCT year, match_id, person_id
      FROM poland_participants
      WHERE role = 'PLAYER'
    ) AS players
    JOIN public."tbl_Match_Events" AS event
      ON event.match_id = players.match_id
     AND event.primary_person_id = players.person_id
    WHERE event.event_type IN ('GOAL', 'PENALTY_GOAL')
    GROUP BY players.year, players.person_id
  ),
  -- rank() zachowuje remisy na granicy; ostateczne cięcie (2 / 3) robi aplikacja.
  top_appearances AS (
    SELECT * FROM (
      SELECT *, rank() OVER (PARTITION BY year ORDER BY cnt DESC) AS rnk FROM appearance_counts
    ) AS ranked
    WHERE rnk <= 2
  ),
  top_scorers AS (
    SELECT * FROM (
      SELECT *, rank() OVER (PARTITION BY year ORDER BY cnt DESC) AS rnk FROM goal_counts
    ) AS ranked
    WHERE rnk <= 3
  )
  SELECT jsonb_build_object(
    'matches', (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(match_list) ORDER BY match_list.match_date DESC, match_list.match_time DESC, match_list.id DESC),
        '[]'::jsonb
      )
      FROM match_list
    ),
    'coaches', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('year', c.year, 'personId', c.person_id, 'name', n.name, 'count', c.cnt)), '[]'::jsonb)
      FROM coach_counts AS c
      JOIN person_names AS n ON n.id = c.person_id
    ),
    'topAppearances', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('year', a.year, 'personId', a.person_id, 'name', n.name, 'count', a.cnt)), '[]'::jsonb)
      FROM top_appearances AS a
      JOIN person_names AS n ON n.id = a.person_id
    ),
    'topScorers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('year', g.year, 'personId', g.person_id, 'name', n.name, 'count', g.cnt)), '[]'::jsonb)
      FROM top_scorers AS g
      JOIN person_names AS n ON n.id = g.person_id
    )
  )
$$;

REVOKE ALL ON FUNCTION public.get_admin_matches_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_matches_list() TO service_role;

COMMIT;
