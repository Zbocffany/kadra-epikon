-- Krok 4 refaktoru: zwarta paczka dla publicznych list trenerów i sędziów.
-- {
--   polandCountryId,
--   countries: [[name, fifa_code], ...],
--   matches:   [...]  -- jak w get_public_players_payload (058)
--   people:    [[id, first_name, last_name, nickname, birth_date, death_date,
--                birthCountryIdx, birthCountryCurrentIdx, [representedIdx...], [coachedIdx...],
--                rolesBits, coachBits], ...]
--     rolesBits: 1 = PLAYER, 2 = COACH, 4 = REFEREE
--     coachBits: 1 = has_coached_poland, 2 = has_coached_against_poland
--   coachFacts:   [[personIdx, matchIdx, side], ...]   -- side: 1 = gospodarz, 2 = gość, 0 = inna drużyna
--   refereeFacts: [[personIdx, matchIdx], ...]
-- }
-- Reguły odwzorowują getCoachPolandFilterMatchesByPersonId, getRefereePolandFilterMatchesByPersonId,
-- getCoachedPolandByPersonId, getCoachedAgainstPolandByPersonId i getCoachedCountryDataByPersonId.
-- Lista sędziów = wszystkie osoby z rolą REFEREE (jak dotychczasowy filtr strony).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_staff_payload()
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
  coach_rows AS (
    SELECT mp.person_id, mp.match_id, mp.team_id, mpol.poland_team_id
    FROM public."tbl_Match_Participants" AS mp
    JOIN match_poland AS mpol ON mpol.match_id = mp.match_id
    WHERE mp.role::text = 'COACH'
      AND mpol.poland_team_id IS NOT NULL
      AND mp.team_id IS NOT NULL
  ),
  coach_flags AS (
    SELECT
      person_id,
      bool_or(team_id = poland_team_id) AS has_coached_poland,
      bool_or(team_id <> poland_team_id) AS has_coached_against_poland
    FROM coach_rows
    GROUP BY person_id
  ),
  referee_rows AS (
    SELECT mp.person_id, mp.match_id
    FROM public."tbl_Match_Participants" AS mp
    JOIN match_poland AS mpol ON mpol.match_id = mp.match_id
    WHERE mp.role::text = 'REFEREE'
      AND mpol.poland_team_id IS NOT NULL
  ),
  listed_people AS (
    SELECT person_id FROM coach_flags
    UNION
    SELECT DISTINCT person_id FROM public."tbl_Match_Participants" WHERE role::text = 'REFEREE'
  ),
  roles AS (
    SELECT
      mp.person_id,
      bit_or(CASE mp.role::text WHEN 'PLAYER' THEN 1 WHEN 'COACH' THEN 2 WHEN 'REFEREE' THEN 4 ELSE 0 END) AS bits
    FROM public."tbl_Match_Participants" AS mp
    JOIN listed_people ON listed_people.person_id = mp.person_id
    GROUP BY mp.person_id
  ),
  represented AS (
    SELECT src.person_id, array_agg(DISTINCT src.country_id) AS country_ids
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
    SELECT mp.person_id, array_agg(DISTINCT team.country_id) AS country_ids
    FROM public."tbl_Match_Participants" AS mp
    JOIN listed_people ON listed_people.person_id = mp.person_id
    JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE mp.role::text = 'COACH'
      AND country.name IS NOT NULL
    GROUP BY mp.person_id
  ),
  people_base AS (
    SELECT
      (row_number() OVER (ORDER BY person.id) - 1)::int AS idx,
      person.id,
      person.first_name,
      person.last_name,
      person.nickname,
      person.birth_date,
      person.death_date,
      CASE
        WHEN person.birth_city_id IS NULL THEN person.birth_country_id
        ELSE COALESCE(birth_period.country_id, current_period.country_id, person.birth_country_id, city.current_country_id)
      END AS birth_country_id,
      CASE
        WHEN person.birth_city_id IS NULL THEN person.birth_country_id
        ELSE COALESCE(current_period.country_id, person.birth_country_id, city.current_country_id)
      END AS birth_country_current_id,
      COALESCE(
        represented.country_ids,
        CASE
          WHEN fallback_country.name IS NOT NULL THEN ARRAY[fallback_country.id]
          ELSE ARRAY[]::uuid[]
        END
      ) AS represented_ids,
      COALESCE(coached.country_ids, ARRAY[]::uuid[]) AS coached_ids,
      COALESCE(roles.bits, 0) AS roles_bits,
      (CASE WHEN coach_flags.has_coached_poland THEN 1 ELSE 0 END)
        | (CASE WHEN coach_flags.has_coached_against_poland THEN 2 ELSE 0 END) AS coach_bits
    FROM listed_people
    JOIN public."tbl_People" AS person ON person.id = listed_people.person_id
    LEFT JOIN coach_flags ON coach_flags.person_id = person.id
    LEFT JOIN public."tbl_Cities" AS city ON city.id = person.birth_city_id
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
    LEFT JOIN public."tbl_Countries" AS fallback_country ON fallback_country.id = person.birth_country_id
    LEFT JOIN represented ON represented.person_id = person.id
    LEFT JOIN coached ON coached.person_id = person.id
    LEFT JOIN roles ON roles.person_id = person.id
  ),
  country_dict AS (
    SELECT
      (row_number() OVER (ORDER BY country.id) - 1)::int AS idx,
      country.id,
      country.name,
      country.fifa_code::text AS fifa_code
    FROM public."tbl_Countries" AS country
    WHERE country.id IN (
      SELECT birth_country_id FROM people_base
      UNION SELECT birth_country_current_id FROM people_base
      UNION SELECT unnest(represented_ids) FROM people_base
      UNION SELECT unnest(coached_ids) FROM people_base
    )
  ),
  used_matches AS (
    SELECT match_id FROM coach_rows
    UNION
    SELECT match_id FROM referee_rows
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
    JOIN used_matches ON used_matches.match_id = match.id
    JOIN match_poland AS mpol ON mpol.match_id = match.id
    JOIN team_info AS home ON home.id = match.home_team_id
    JOIN team_info AS away ON away.id = match.away_team_id
    LEFT JOIN public."tbl_Competitions" AS competition ON competition.id = match.competition_id
    LEFT JOIN public."tbl_Match_Levels" AS level ON level.id = match.match_level_id
    LEFT JOIN public."tbl_Stadiums" AS stadium ON stadium.id = match.match_stadium_id
    LEFT JOIN public."tbl_Cities" AS venue_city ON venue_city.id = COALESCE(stadium.stadium_city_id, match.match_city_id)
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
    'countries', (
      SELECT COALESCE(jsonb_agg(jsonb_build_array(name, fifa_code) ORDER BY idx), '[]'::jsonb)
      FROM country_dict
    ),
    'matches', (
      SELECT COALESCE(jsonb_agg(to_jsonb(match_rows) - 'idx' ORDER BY match_rows.idx), '[]'::jsonb)
      FROM match_rows
    ),
    'people', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_array(
            p.id,
            p.first_name,
            p.last_name,
            p.nickname,
            p.birth_date,
            p.death_date,
            (SELECT idx FROM country_dict WHERE country_dict.id = p.birth_country_id),
            (SELECT idx FROM country_dict WHERE country_dict.id = p.birth_country_current_id),
            (SELECT COALESCE(jsonb_agg(cd.idx), '[]'::jsonb) FROM country_dict AS cd WHERE cd.id = ANY (p.represented_ids)),
            (SELECT COALESCE(jsonb_agg(cd.idx), '[]'::jsonb) FROM country_dict AS cd WHERE cd.id = ANY (p.coached_ids)),
            p.roles_bits,
            p.coach_bits
          )
          ORDER BY p.idx
        ),
        '[]'::jsonb
      )
      FROM people_base AS p
    ),
    'coachFacts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_array(
            p.idx,
            m.idx,
            CASE WHEN c.team_id = m.home_team_id THEN 1 WHEN c.team_id = m.away_team_id THEN 2 ELSE 0 END
          )
          ORDER BY p.idx, m.idx
        ),
        '[]'::jsonb
      )
      FROM coach_rows AS c
      JOIN people_base AS p ON p.id = c.person_id
      JOIN match_rows AS m ON m.id = c.match_id
    ),
    'refereeFacts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_array(p.idx, m.idx) ORDER BY p.idx, m.idx), '[]'::jsonb)
      FROM referee_rows AS r
      JOIN people_base AS p ON p.id = r.person_id
      JOIN match_rows AS m ON m.id = r.match_id
    )
  )
$$;

REVOKE ALL ON FUNCTION public.get_public_staff_payload() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_staff_payload() TO service_role;

COMMIT;
