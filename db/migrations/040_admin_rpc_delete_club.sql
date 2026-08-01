-- RPC do transakcyjnego usuwania klubu.
--
-- Motywacja: obecna akcja `deleteClub` (app/admin/clubs/actions.ts) wykonuje
-- 6 osobnych zapytań przez supabase-js:
--   1) sprawdzenie liczby meczów (race: mecz może być dodany między krokiem 1 a 4)
--   2) nullify tbl_Match_Participants.club_team_id
--   3) nullify tbl_Match_Events.team_id
--   4) DELETE tbl_Person_Team_Periods
--   5) DELETE tbl_Teams
--   6) DELETE tbl_Club_History
--   7) DELETE tbl_Clubs
-- Crash między krokami 2 a 7 zostawia bazę w niespójnym stanie.
--
-- Ta funkcja pakuje całość w jedną transakcję: albo cały cascade się udaje,
-- albo cofa się w całości. Blokada meczów-w-użyciu też jest wewnątrz transakcji,
-- eliminując race z jednoczesnym dodaniem meczu.
--
-- Zwraca: (deleted, match_count, club_name)
--   deleted = false → klub ma powiązane mecze, nic nie usunięto, match_count > 0
--   deleted = true → klub usunięty, match_count = 0
--   club_name → nazwa klubu (do komunikatu w UI); NULL jeśli klub nie istniał

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_club(p_club_id uuid)
RETURNS TABLE(deleted boolean, match_count integer, club_name text)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_id uuid;
  v_match_count integer;
  v_club_name text;
BEGIN
  SELECT name INTO v_club_name
  FROM "tbl_Clubs"
  WHERE id = p_club_id;

  -- Klub nie istnieje: zwróć bez zmian (idempotentne).
  IF v_club_name IS NULL THEN
    deleted := false;
    match_count := 0;
    club_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT id INTO v_team_id
  FROM "tbl_Teams"
  WHERE club_id = p_club_id;

  IF v_team_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_match_count
    FROM "tbl_Matches"
    WHERE home_team_id = v_team_id OR away_team_id = v_team_id;

    IF v_match_count > 0 THEN
      deleted := false;
      match_count := v_match_count;
      club_name := v_club_name;
      RETURN NEXT;
      RETURN;
    END IF;

    -- 1) Nullify club_team_id w participantach (nullable FK).
    UPDATE "tbl_Match_Participants"
      SET club_team_id = NULL
      WHERE club_team_id = v_team_id;

    -- 2) Nullify team_id w zdarzeniach (nullable FK).
    UPDATE "tbl_Match_Events"
      SET team_id = NULL
      WHERE team_id = v_team_id;

    -- 3) Usuń okresy person↔team dla tej drużyny klubowej.
    DELETE FROM "tbl_Person_Team_Periods"
      WHERE club_team_id = v_team_id;

    -- 4) Usuń drużynę klubową.
    DELETE FROM "tbl_Teams" WHERE id = v_team_id;
  END IF;

  -- 5) Usuń historię klubu (club_id NOT NULL → przed usunięciem klubu).
  DELETE FROM "tbl_Club_History" WHERE club_id = p_club_id;

  -- 6) Usuń klub.
  DELETE FROM "tbl_Clubs" WHERE id = p_club_id;

  deleted := true;
  match_count := 0;
  club_name := v_club_name;
  RETURN NEXT;
END;
$$;

-- RLS: funkcja jest wywoływana wyłącznie przez service-role client
-- (patrz createServiceRoleClient w lib/supabase/server.ts), więc nie robimy
-- GRANT dla anon/authenticated. Domyślne uprawnienia SECURITY INVOKER.

COMMIT;
