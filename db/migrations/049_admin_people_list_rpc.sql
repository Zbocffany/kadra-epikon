-- Lista osób w panelu admina (/admin/people) liczona w jednym zapytaniu
-- zamiast kilkuset zapytań porcjowanych w TS (getAdminPeople).
-- Indeksy wykorzystywane przez to zapytanie istnieją już w 035/036/038:
--   tbl_Match_Participants (role, person_id), (person_id), (match_id)
--   tbl_Person_Countries (person_id), tbl_City_Country_Periods (city_id)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_people_list()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  birth_date date,
  death_date date,
  birth_city_name text,
  birth_country_name text,
  represented_countries jsonb,
  coached_country_names text[],
  player_match_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH
  -- Jawne wpisy z tbl_Person_Countries + reprezentacje, w których osoba zagrała.
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
      UNION
      SELECT mp.person_id, team.country_id
      FROM public."tbl_Match_Participants" AS mp
      JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
      WHERE mp.role = 'PLAYER'
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
    JOIN public."tbl_Teams" AS team ON team.id = mp.team_id
    JOIN public."tbl_Countries" AS country ON country.id = team.country_id
    WHERE mp.role = 'COACH'
      AND country.name IS NOT NULL
    GROUP BY mp.person_id
  ),
  player_matches AS (
    SELECT mp.person_id, count(DISTINCT mp.match_id) AS match_count
    FROM public."tbl_Match_Participants" AS mp
    JOIN public."tbl_Matches" AS match ON match.id = mp.match_id
    WHERE mp.role = 'PLAYER'
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
    GROUP BY mp.person_id
  )
  SELECT
    person.id,
    person.first_name::text,
    person.last_name::text,
    person.nickname::text,
    person.birth_date::date,
    person.death_date::date,
    city.city_name::text,
    birth_country.name::text,
    COALESCE(
      represented.countries,
      CASE
        WHEN fallback_country.name IS NOT NULL THEN jsonb_build_array(
          jsonb_build_object('name', fallback_country.name, 'fifa_code', fallback_country.fifa_code::text)
        )
        ELSE '[]'::jsonb
      END
    ),
    COALESCE(coached.names, ARRAY[]::text[]),
    COALESCE(player_matches.match_count, 0)
  FROM public."tbl_People" AS person
  LEFT JOIN public."tbl_Cities" AS city ON city.id = person.birth_city_id
  -- Ta sama kolejność co resolveCityCountry(): okres z dnia urodzenia,
  -- potem okres otwarty, potem najpóźniejszy zamknięty.
  LEFT JOIN LATERAL (
    SELECT period.country_id
    FROM public."tbl_City_Country_Periods" AS period
    WHERE period.city_id = person.birth_city_id
    ORDER BY
      (
        person.birth_date IS NOT NULL
        AND person.birth_date >= COALESCE(period.valid_from, '-infinity'::date)
        AND person.birth_date <= COALESCE(period.valid_to, 'infinity'::date)
      ) DESC,
      (period.valid_to IS NULL) DESC,
      period.valid_to DESC NULLS LAST,
      period.valid_from DESC NULLS LAST
    LIMIT 1
  ) AS birth_period ON person.birth_city_id IS NOT NULL
  LEFT JOIN public."tbl_Countries" AS birth_country
    ON birth_country.id = CASE
      WHEN person.birth_city_id IS NULL THEN person.birth_country_id
      ELSE COALESCE(birth_period.country_id, person.birth_country_id, city.current_country_id)
    END
  LEFT JOIN public."tbl_Countries" AS fallback_country ON fallback_country.id = person.birth_country_id
  LEFT JOIN represented ON represented.person_id = person.id
  LEFT JOIN coached ON coached.person_id = person.id
  LEFT JOIN player_matches ON player_matches.person_id = person.id
$$;

REVOKE ALL ON FUNCTION public.get_admin_people_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_people_list() TO service_role;

COMMIT;
