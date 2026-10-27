-- Krok 2 refaktoru /players: zwarta paczka danych dla publicznej listy piłkarzy.
-- {
--   matches: [...]  -- każdy mecz Polski raz (dane do wyświetlania i filtrów)
--   people:  [...]  -- zawodnicy, którzy grali dla Polski lub przeciw Polsce
--   facts:   [[personIdx, matchIdx, side, flags, goals, assists, yellow, red, minutes], ...]
-- }
-- side: 1 = gospodarz, 2 = gość, 0 = brak/nieznana drużyna.
-- flags (bity): 1 = is_starting true, 2 = is_starting null, 4 = played, 8 = is_poland_player.
-- Reguły statystyk pochodzą z v_player_match_facts (056).
-- Indeksy: 035/036/038/045 (participants, events, periods, people.birth_city_id).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_players_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  poland_country AS (
    SELECT id FROM public."tbl_Countries" WHERE name ILIKE 'Polska' LIMIT 1
  ),
  match_poland AS (
    SELECT
      match.id AS match_id,
      CASE
        WHEN home.country_id = (SELECT id FROM poland_country) THEN match.home_team_id
        WHEN away.country_id = (SELECT id FROM poland_country) THEN match.away_team_id
      END AS poland_team_id
    FROM public."tbl_Matches" AS match
    JOIN public."tbl_Teams" AS home ON home.id = match.home_team_id
    JOIN public."tbl_Teams" AS away ON away.id = match.away_team_id
    WHERE match.result_type::text IS DISTINCT FROM 'WALKOVER'
  ),
  -- Zgodnie z getRepresentedPolandByPersonId / getPlayedAgainstPolandByPersonId.
  poland_flags AS (
    SELECT
      mp.person_id,
      bool_or(mp.team_id = mpol.poland_team_id) AS has_represented_poland,
      bool_or(
        mp.team_id IS NOT NULL
        AND mp.team_id <> mpol.poland_team_id
        AND (
          mp.is_starting IS TRUE
          OR EXISTS (
            SELECT 1
            FROM public."tbl_Match_Events" AS event
            WHERE event.match_id = mp.match_id
              AND event.event_type::text = 'SUBSTITUTION'
              AND event.secondary_person_id = mp.person_id
          )
        )
      ) AS has_played_against_poland
    FROM public."tbl_Match_Participants" AS mp
    JOIN match_poland AS mpol ON mpol.match_id = mp.match_id
    WHERE mp.role::text = 'PLAYER'
      AND mpol.poland_team_id IS NOT NULL
    GROUP BY mp.person_id
  ),
  listed_people AS (
    SELECT person_id, has_represented_poland, has_played_against_poland
    FROM poland_flags
    WHERE has_represented_poland OR has_played_against_poland
  ),
  roles AS (
    SELECT
      mp.person_id,
      array_agg(DISTINCT mp.role::text ORDER BY mp.role::text) AS roles
    FROM public."tbl_Match_Participants" AS mp
    JOIN listed_people ON listed_people.person_id = mp.person_id
    GROUP BY mp.person_id
  ),
  represented AS (
    SELECT
      src.person_id,
      jsonb_agg(
        jsonb_build_object('name', country.name, 'fifa_code', country.fifa_code::text)
        ORDER BY country.name
      ) AS countries
    FROM (
      SELECT pc.person_id, pc.country_id
      FROM public."tbl_Person_Countries" AS pc
      JOIN listed_people ON listed_people.person_id = pc.person_id
      UNION
      SELECT mp.person_id, team.country_id
      FROM public."tbl_Match_Participants" AS mp
      JOIN listed_people ON listed_people.person_id = mp.person_id
      JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
      WHERE mp.role::text = 'PLAYER'
        AND team.club_id IS NULL
        AND team.country_id IS NOT NULL
    ) AS src
    JOIN public."tbl_Countries" AS country ON country.id = src.country_id
    WHERE country.name IS NOT NULL
    GROUP BY src.person_id
  ),
  coached AS (
    SELECT mp.person_id, array_agg(DISTINCT country.name) AS names
    FROM public."tbl_Match_Participants" AS mp
    JOIN listed_people ON listed_people.person_id = mp.person_id
    JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE mp.role::text = 'COACH'
      AND country.name IS NOT NULL
    GROUP BY mp.person_id
  ),
  people_rows AS (
    SELECT
      (row_number() OVER (ORDER BY person.id) - 1)::int AS idx,
      person.id,
      person.first_name,
      person.last_name,
      person.nickname,
      person.birth_date,
      person.death_date,
      historical_country.name AS birth_country_name,
      historical_country.fifa_code::text AS birth_country_fifa_code,
      current_country.name AS birth_country_current_name,
      current_country.fifa_code::text AS birth_country_current_fifa_code,
      COALESCE(
        represented.countries,
        CASE
          WHEN fallback_country.name IS NOT NULL THEN jsonb_build_array(
            jsonb_build_object('name', fallback_country.name, 'fifa_code', fallback_country.fifa_code::text)
          )
          ELSE '[]'::jsonb
        END
      ) AS represented_countries,
      COALESCE(coached.names, ARRAY[]::text[]) AS coached_country_names,
      COALESCE(roles.roles, ARRAY[]::text[]) AS roles,
      listed_people.has_represented_poland,
      listed_people.has_played_against_poland
    FROM listed_people
    JOIN public."tbl_People" AS person ON person.id = listed_people.person_id
    LEFT JOIN public."tbl_Cities" AS city ON city.id = person.birth_city_id
    -- Jak resolveCityCountry(): historyczny = okres z dnia urodzenia, inaczej aktualny;
    -- aktualny = okres otwarty, inaczej najpóźniejszy; bez okresów = fallback.
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = person.birth_city_id
        AND person.birth_date IS NOT NULL
        AND person.birth_date >= COALESCE(period.valid_from, '-infinity'::date)
        AND person.birth_date <= COALESCE(period.valid_to, 'infinity'::date)
      LIMIT 1
    ) AS birth_period ON person.birth_city_id IS NOT NULL
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = person.birth_city_id
      ORDER BY (period.valid_to IS NULL) DESC, period.valid_to DESC NULLS LAST, period.valid_from DESC NULLS LAST
      LIMIT 1
    ) AS current_period ON person.birth_city_id IS NOT NULL
    LEFT JOIN public."tbl_Countries" AS historical_country
      ON historical_country.id = CASE
        WHEN person.birth_city_id IS NULL THEN person.birth_country_id
        ELSE COALESCE(birth_period.country_id, current_period.country_id, person.birth_country_id, city.current_country_id)
      END
    LEFT JOIN public."tbl_Countries" AS current_country
      ON current_country.id = CASE
        WHEN person.birth_city_id IS NULL THEN person.birth_country_id
        ELSE COALESCE(current_period.country_id, person.birth_country_id, city.current_country_id)
      END
    LEFT JOIN public."tbl_Countries" AS fallback_country ON fallback_country.id = person.birth_country_id
    LEFT JOIN represented ON represented.person_id = person.id
    LEFT JOIN coached ON coached.person_id = person.id
    LEFT JOIN roles ON roles.person_id = person.id
  ),
  facts AS (
    SELECT facts.*
    FROM public.v_player_match_facts AS facts
    JOIN listed_people ON listed_people.person_id = facts.person_id
  ),
  team_info AS (
    SELECT
      team.id,
      team.country_id,
      CASE
        WHEN team.country_id IS NOT NULL THEN COALESCE(country.name, '—')
        WHEN team.club_id IS NOT NULL THEN COALESCE(club.name, '—')
        ELSE '—'
      END AS name,
      CASE WHEN team.country_id IS NOT NULL THEN country.fifa_code::text END AS fifa_code
    FROM public."tbl_Teams" AS team
    LEFT JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    LEFT JOIN public."tbl_Clubs" AS club ON club.id = team.club_id
  ),
  match_rows AS (
    SELECT
      (row_number() OVER (ORDER BY match.match_date, match.id) - 1)::int AS idx,
      match.id,
      match.match_date,
      match.match_time,
      match.match_status::text AS match_status,
      match.result_type::text AS result_type,
      match.walkover_winner_team_id,
      match.editorial_status::text AS editorial_status,
      COALESCE(competition.name, '') AS competition_name,
      level.name AS match_level_name,
      match.home_team_id,
      match.away_team_id,
      home.country_id AS home_country_id,
      away.country_id AS away_country_id,
      home.name AS home_team_name,
      away.name AS away_team_name,
      home.fifa_code AS home_team_fifa_code,
      away.fifa_code AS away_team_fifa_code,
      mpol.poland_team_id,
      match.home_goals,
      match.away_goals,
      match.home_shootout_goals,
      match.away_shootout_goals,
      venue_city.id AS venue_city_id,
      venue_city.city_name AS venue_city_name,
      venue_country.id AS venue_country_id,
      venue_country.name AS venue_country_name,
      match.match_stadium_id AS venue_stadium_id,
      stadium.name AS venue_stadium_name
    FROM public."tbl_Matches" AS match
    JOIN (SELECT DISTINCT match_id FROM facts) AS used ON used.match_id = match.id
    JOIN match_poland AS mpol ON mpol.match_id = match.id
    JOIN team_info AS home ON home.id = match.home_team_id
    JOIN team_info AS away ON away.id = match.away_team_id
    LEFT JOIN public."tbl_Competitions" AS competition ON competition.id = match.competition_id
    LEFT JOIN public."tbl_Match_Levels" AS level ON level.id = match.match_level_id
    LEFT JOIN public."tbl_Stadiums" AS stadium ON stadium.id = match.match_stadium_id
    LEFT JOIN public."tbl_Cities" AS venue_city ON venue_city.id = COALESCE(stadium.stadium_city_id, match.match_city_id)
    -- Jak getMatchVenuesByMatchId(): okres z dnia meczu, potem current_country_id, potem najnowszy okres.
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = venue_city.id
        AND (period.valid_from IS NULL OR period.valid_from <= match.match_date)
        AND (period.valid_to IS NULL OR match.match_date <= period.valid_to)
      LIMIT 1
    ) AS venue_in_range ON true
    LEFT JOIN LATERAL (
      SELECT period.country_id
      FROM public."tbl_City_Country_Periods" AS period
      WHERE period.city_id = venue_city.id
      ORDER BY (period.valid_to IS NULL) DESC, period.valid_to DESC NULLS LAST, period.valid_from DESC NULLS LAST
      LIMIT 1
    ) AS venue_latest ON true
    LEFT JOIN public."tbl_Countries" AS venue_country
      ON venue_country.id = COALESCE(venue_in_range.country_id, venue_city.current_country_id, venue_latest.country_id)
  )
  SELECT jsonb_build_object(
    'polandCountryId', (SELECT id FROM poland_country),
    'matches', (
      SELECT COALESCE(jsonb_agg(to_jsonb(match_rows) - 'idx' ORDER BY match_rows.idx), '[]'::jsonb)
      FROM match_rows
    ),
    'people', (
      SELECT COALESCE(jsonb_agg(to_jsonb(people_rows) - 'idx' ORDER BY people_rows.idx), '[]'::jsonb)
      FROM people_rows
    ),
    'facts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_array(
            p.idx,
            m.idx,
            CASE WHEN f.team_id = m.home_team_id THEN 1 WHEN f.team_id = m.away_team_id THEN 2 ELSE 0 END,
            (CASE WHEN f.is_starting IS TRUE THEN 1 ELSE 0 END)
              | (CASE WHEN f.is_starting IS NULL THEN 2 ELSE 0 END)
              | (CASE WHEN f.played THEN 4 ELSE 0 END)
              | (CASE WHEN f.is_poland_player THEN 8 ELSE 0 END),
            f.goal_count,
            f.assist_count,
            f.yellow_card_count,
            f.red_card_count,
            f.minute_count
          )
          ORDER BY p.idx, m.idx
        ),
        '[]'::jsonb
      )
      FROM facts AS f
      JOIN people_rows AS p ON p.id = f.person_id
      JOIN match_rows AS m ON m.id = f.match_id
    )
  )
$$;

REVOKE ALL ON FUNCTION public.get_public_players_payload() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_players_payload() TO service_role;

COMMIT;
