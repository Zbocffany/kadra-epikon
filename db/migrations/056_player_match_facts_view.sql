-- Krok 1 refaktoru /players: widok faktów zawodnik × mecz (mecze Polski).
-- Jedno źródło prawdy dla występów, ławki, goli, asyst, kartek i minut.
-- Reguły odwzorowują getPlayerFilterMatchesByPersonId (lib/db/people.ts):
--   * bez walkowerów, bez CALLED_UP, tylko mecze z udziałem Polski;
--   * występ = podstawowy skład albo wejście z ławki; ławka = brak występu;
--   * gol = GOAL/PENALTY_GOAL (primary), asysta = secondary przy GOAL/PENALTY_GOAL,
--     żółta = YELLOW_CARD, czerwona = RED_CARD/SECOND_YELLOW_CARD;
--   * minuty w czasie regulaminowym (90 lub 120 przy dogrywce), bez doliczonego czasu.
-- Indeksy: tbl_Match_Events (match_id, event_type) z 035, tbl_Match_Participants (role, person_id) z 035.

BEGIN;

CREATE OR REPLACE VIEW public.v_player_match_facts
WITH (security_invoker = true)
AS
WITH poland_country AS (
  SELECT id FROM public."tbl_Countries" WHERE name ILIKE 'Polska' LIMIT 1
),
base AS (
  SELECT
    mp.person_id,
    mp.match_id,
    mp.team_id,
    mp.is_starting,
    match.result_type::text AS result_type,
    CASE
      WHEN home.country_id = (SELECT id FROM poland_country) THEN match.home_team_id
      WHEN away.country_id = (SELECT id FROM poland_country) THEN match.away_team_id
    END AS poland_team_id
  FROM public."tbl_Match_Participants" AS mp
  JOIN public."tbl_Matches" AS match ON match.id = mp.match_id
  JOIN public."tbl_Teams" AS home ON home.id = match.home_team_id
  JOIN public."tbl_Teams" AS away ON away.id = match.away_team_id
  WHERE mp.role::text = 'PLAYER'
    AND mp.squad_role::text IS DISTINCT FROM 'CALLED_UP'
    AND match.result_type::text IS DISTINCT FROM 'WALKOVER'
),
enriched AS (
  SELECT
    base.*,
    sub_on.minute AS sub_on_minute,
    sub_off.minute AS sub_off_minute,
    sub_off.minute_extra AS sub_off_extra,
    (base.is_starting IS TRUE OR sub_on.minute IS NOT NULL) AS played,
    CASE WHEN base.result_type IN ('EXTRA_TIME', 'EXTRA_TIME_AND_PENALTIES', 'GOLDEN_GOAL') THEN 120 ELSE 90 END AS regular_end,
    COALESCE(ev.goals, 0) AS goal_count,
    COALESCE(ev.assists, 0) AS assist_count,
    COALESCE(ev.yellows, 0) AS yellow_card_count,
    COALESCE(ev.reds, 0) AS red_card_count
  FROM base
  -- Przy kilku wpisach bierzemy ostatni (najwyższe id), tak jak dotychczasowa mapa w TS.
  LEFT JOIN LATERAL (
    SELECT event.minute
    FROM public."tbl_Match_Events" AS event
    WHERE event.match_id = base.match_id
      AND event.event_type::text = 'SUBSTITUTION'
      AND event.secondary_person_id = base.person_id
    ORDER BY event.id DESC
    LIMIT 1
  ) AS sub_on ON base.is_starting IS NOT TRUE
  LEFT JOIN LATERAL (
    SELECT event.minute, COALESCE(event.minute_extra, 0) AS minute_extra
    FROM public."tbl_Match_Events" AS event
    WHERE event.match_id = base.match_id
      AND event.event_type::text = 'SUBSTITUTION'
      AND event.primary_person_id = base.person_id
    ORDER BY event.id DESC
    LIMIT 1
  ) AS sub_off ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE event.event_type::text IN ('GOAL', 'PENALTY_GOAL') AND event.primary_person_id = base.person_id) AS goals,
      count(*) FILTER (WHERE event.event_type::text IN ('GOAL', 'PENALTY_GOAL') AND event.secondary_person_id = base.person_id) AS assists,
      count(*) FILTER (WHERE event.event_type::text = 'YELLOW_CARD' AND event.primary_person_id = base.person_id) AS yellows,
      count(*) FILTER (WHERE event.event_type::text IN ('RED_CARD', 'SECOND_YELLOW_CARD') AND event.primary_person_id = base.person_id) AS reds
    FROM public."tbl_Match_Events" AS event
    WHERE event.match_id = base.match_id
      AND (event.primary_person_id = base.person_id OR event.secondary_person_id = base.person_id)
  ) AS ev ON true
  WHERE base.poland_team_id IS NOT NULL
)
SELECT
  person_id,
  match_id,
  team_id,
  poland_team_id,
  (team_id IS NOT NULL AND team_id = poland_team_id) AS is_poland_player,
  is_starting,
  played,
  NOT played AS bench,
  goal_count::int AS goal_count,
  assist_count::int AS assist_count,
  yellow_card_count::int AS yellow_card_count,
  red_card_count::int AS red_card_count,
  CASE
    WHEN NOT played THEN 0
    ELSE GREATEST(
      0,
      LEAST(
        GREATEST(
          0,
          CASE
            WHEN sub_off_minute IS NULL THEN regular_end
            WHEN sub_off_extra > 0 THEN sub_off_minute
            ELSE sub_off_minute - 1
          END
        ),
        regular_end
      )
      - CASE
          WHEN is_starting IS TRUE THEN 0
          WHEN sub_on_minute > 0 THEN sub_on_minute - 1
          ELSE sub_on_minute
        END
    )
  END::int AS minute_count
FROM enriched;

REVOKE ALL ON public.v_player_match_facts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_player_match_facts TO service_role;

COMMIT;
