-- Poprawka 049:
-- 1) liczba występów = mecze w podstawowym składzie lub wejście z ławki
--    (wcześniej liczone były też BENCH bez wejścia i CALLED_UP);
-- 2) wynik jako jeden jsonb, żeby PostgREST nie wykonywał funkcji raz na każde 1000 wierszy.

BEGIN;

DROP FUNCTION IF EXISTS public.get_admin_people_list();

CREATE FUNCTION public.get_admin_people_list()
RETURNS jsonb
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
  sub_ins AS (
    SELECT DISTINCT event.match_id, event.secondary_person_id AS person_id
    FROM public."tbl_Match_Events" AS event
    WHERE event.event_type = 'SUBSTITUTION'
      AND event.secondary_person_id IS NOT NULL
  ),
  appearances AS (
    SELECT mp.person_id, count(DISTINCT mp.match_id) AS appearance_count
    FROM public."tbl_Match_Participants" AS mp
    JOIN public."tbl_Matches" AS match ON match.id = mp.match_id
    LEFT JOIN sub_ins
      ON sub_ins.match_id = mp.match_id
     AND sub_ins.person_id = mp.person_id
    WHERE mp.role = 'PLAYER'
      AND match.result_type IS DISTINCT FROM 'WALKOVER'
      AND (mp.is_starting OR sub_ins.person_id IS NOT NULL)
    GROUP BY mp.person_id
  ),
  list AS (
    SELECT
      person.id,
      person.first_name,
      person.last_name,
      person.nickname,
      person.birth_date,
      person.death_date,
      city.city_name AS birth_city_name,
      birth_country.name AS birth_country_name,
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
      COALESCE(appearances.appearance_count, 0) AS appearance_count
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
    LEFT JOIN appearances ON appearances.person_id = person.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(list)), '[]'::jsonb)
  FROM list
$$;

REVOKE ALL ON FUNCTION public.get_admin_people_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_people_list() TO service_role;

COMMIT;
