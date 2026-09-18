-- 045_poland_voivodeship_statistics_rpc.sql
-- Publiczne agregacje dla strony "Polska":
--   1) statystyki reprezentantów per województwo (mapka + kafelek "Nieznane"),
--   2) lista reprezentantów urodzonych poza granicami Polski.
-- Zasady:
--   - "Zagrał" = tbl_Match_Participants (role=PLAYER, team=POL, is_starting=true)
--     LUB wszedł jako secondary_person_id w zdarzeniu SUBSTITUTION drużyny POL.
--   - Mecze: editorial_status=VERIFIED, match_status=FINISHED, result_type<>WALKOVER.
--   - Gole = GOAL + PENALTY_GOAL (bez OWN_GOAL, bez konkursu karnych).
--   - Czerwone kartki = RED_CARD + SECOND_YELLOW_CARD.
--   - "Kluby" = distinct club_team_id z Match_Participants dla polskich meczów.
--   - Województwo: tbl_Cities.voivodeship dla birth_city_id.
--     Jeśli birth_city_id brak / voivodeship=NULL, a osoba urodziła się w Polsce
--     (lub brak informacji o kraju) → bucket 'NIEZNANE'.
--     Jeśli urodzona za granicą → wykluczona z bucketów, trafia do drugiej RPC.

BEGIN;

-- ---------------------------------------------------------------------------
-- Indeksy pod nowe zapytania
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "idx_tbl_People_birth_city_id"
  ON public."tbl_People" (birth_city_id)
  WHERE birth_city_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_tbl_People_birth_country_id"
  ON public."tbl_People" (birth_country_id)
  WHERE birth_country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_tbl_Cities_voivodeship"
  ON public."tbl_Cities" (voivodeship)
  WHERE voivodeship IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_team_role_person"
  ON public."tbl_Match_Participants" (team_id, role, person_id)
  WHERE role = 'PLAYER';

CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_team_type_primary_person"
  ON public."tbl_Match_Events" (team_id, event_type, primary_person_id)
  WHERE primary_person_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RPC 1: statystyki per województwo (16 województw + NIEZNANE)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_poland_voivodeship_statistics()
RETURNS TABLE (
  voivodeship_code text,
  player_count bigint,
  appearance_count bigint,
  goal_count bigint,
  yellow_card_count bigint,
  red_card_count bigint,
  club_count bigint
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
    SELECT DISTINCT mp.match_id, mp.person_id, mp.club_team_id
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
  person_voivodeship AS (
    SELECT
      person.id AS person_id,
      CASE
        WHEN city.voivodeship IS NOT NULL THEN city.voivodeship::text
        WHEN city.current_country_id IS NOT NULL
             AND city.current_country_id IS DISTINCT FROM (SELECT id FROM poland_country)
          THEN NULL
        WHEN person.birth_country_id IS NOT NULL
             AND person.birth_country_id IS DISTINCT FROM (SELECT id FROM poland_country)
          THEN NULL
        ELSE 'NIEZNANE'
      END AS voivodeship_code
    FROM public."tbl_People" AS person
    LEFT JOIN public."tbl_Cities" AS city ON city.id = person.birth_city_id
    WHERE person.id IN (SELECT DISTINCT person_id FROM played_participants)
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
  yellow_events AS (
    SELECT event.primary_person_id AS person_id, count(*) AS cnt
    FROM public."tbl_Match_Events" AS event
    WHERE event.event_type = 'YELLOW_CARD'
      AND event.team_id IN (SELECT id FROM poland_team)
      AND event.match_id IN (SELECT match_id FROM eligible_matches)
      AND event.primary_person_id IS NOT NULL
    GROUP BY event.primary_person_id
  ),
  red_events AS (
    SELECT event.primary_person_id AS person_id, count(*) AS cnt
    FROM public."tbl_Match_Events" AS event
    WHERE event.event_type IN ('RED_CARD', 'SECOND_YELLOW_CARD')
      AND event.team_id IN (SELECT id FROM poland_team)
      AND event.match_id IN (SELECT match_id FROM eligible_matches)
      AND event.primary_person_id IS NOT NULL
    GROUP BY event.primary_person_id
  ),
  player_stats AS (
    SELECT
      pv.voivodeship_code,
      pv.person_id,
      count(DISTINCT played.match_id) AS appearances,
      COALESCE(max(ge.cnt), 0) AS goals,
      COALESCE(max(ye.cnt), 0) AS yellows,
      COALESCE(max(re.cnt), 0) AS reds
    FROM person_voivodeship AS pv
    JOIN played_participants AS played ON played.person_id = pv.person_id
    LEFT JOIN goal_events AS ge ON ge.person_id = pv.person_id
    LEFT JOIN yellow_events AS ye ON ye.person_id = pv.person_id
    LEFT JOIN red_events AS re ON re.person_id = pv.person_id
    WHERE pv.voivodeship_code IS NOT NULL
    GROUP BY pv.voivodeship_code, pv.person_id
  ),
  clubs_per_voivodeship AS (
    SELECT
      pv.voivodeship_code,
      count(DISTINCT played.club_team_id) AS club_count
    FROM person_voivodeship AS pv
    JOIN played_participants AS played ON played.person_id = pv.person_id
    WHERE pv.voivodeship_code IS NOT NULL
      AND played.club_team_id IS NOT NULL
    GROUP BY pv.voivodeship_code
  )
  SELECT
    ps.voivodeship_code,
    count(DISTINCT ps.person_id)::bigint AS player_count,
    sum(ps.appearances)::bigint AS appearance_count,
    sum(ps.goals)::bigint AS goal_count,
    sum(ps.yellows)::bigint AS yellow_card_count,
    sum(ps.reds)::bigint AS red_card_count,
    COALESCE(
      (SELECT club_count FROM clubs_per_voivodeship AS cv WHERE cv.voivodeship_code = ps.voivodeship_code),
      0
    )::bigint AS club_count
  FROM player_stats AS ps
  GROUP BY ps.voivodeship_code
  ORDER BY ps.voivodeship_code;
$$;

REVOKE ALL ON FUNCTION public.get_poland_voivodeship_statistics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poland_voivodeship_statistics() TO service_role;

-- ---------------------------------------------------------------------------
-- RPC 2: reprezentanci urodzeni poza Polską
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_poland_players_born_abroad()
RETURNS TABLE (
  person_id uuid,
  first_name text,
  last_name text,
  birth_country_id uuid,
  birth_country_name text,
  birth_country_fifa text,
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
  abroad_players AS (
    SELECT
      person.id AS person_id,
      person.first_name,
      person.last_name,
      COALESCE(birth_city.current_country_id, person.birth_country_id) AS birth_country_id,
      birth_country.name AS birth_country_name,
      trim(birth_country.fifa_code::text) AS birth_country_fifa,
      birth_city.city_name AS birth_city_name
    FROM public."tbl_People" AS person
    LEFT JOIN public."tbl_Cities" AS birth_city ON birth_city.id = person.birth_city_id
    LEFT JOIN public."tbl_Countries" AS birth_country
      ON birth_country.id = COALESCE(birth_city.current_country_id, person.birth_country_id)
    WHERE person.id IN (SELECT DISTINCT person_id FROM played_participants)
      AND COALESCE(birth_city.current_country_id, person.birth_country_id) IS NOT NULL
      AND COALESCE(birth_city.current_country_id, person.birth_country_id)
          IS DISTINCT FROM (SELECT id FROM poland_country)
  )
  SELECT
    ap.person_id,
    ap.first_name,
    ap.last_name,
    ap.birth_country_id,
    ap.birth_country_name,
    ap.birth_country_fifa,
    ap.birth_city_name,
    count(DISTINCT pp.match_id)::bigint AS appearance_count,
    COALESCE(max(ge.cnt), 0)::bigint AS goal_count
  FROM abroad_players AS ap
  JOIN played_participants AS pp ON pp.person_id = ap.person_id
  LEFT JOIN goal_events AS ge ON ge.person_id = ap.person_id
  GROUP BY
    ap.person_id, ap.first_name, ap.last_name,
    ap.birth_country_id, ap.birth_country_name,
    ap.birth_country_fifa, ap.birth_city_name
  ORDER BY ap.last_name NULLS LAST, ap.first_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_poland_players_born_abroad() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_poland_players_born_abroad() TO service_role;

COMMIT;
