-- 048_attendance_and_captain.sql
--
-- Dwa nowe pola w danych meczowych:
--   * tbl_Matches.attendance          (INTEGER NULL) — liczba widzów
--   * tbl_Match_Participants.is_captain (BOOLEAN)   — flaga kapitana
--
-- Model kapitana (wybrany w formularzu):
--   - flaga is_captain w tbl_Match_Participants,
--   - kapitanem może być TYLKO zawodnik z sekcji pierwszego składu
--     (role = 'PLAYER' AND squad_role = 'STARTING'),
--   - max 1 kapitan na (match_id, team_id) — pilnowane częściowym UNIQUE INDEX.
--
-- Cache: triggery bump_public_cache_version dla tbl_Matches i
-- tbl_Match_Participants są już zdefiniowane w migracji 032, więc nie
-- dodajemy ich ponownie.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) attendance na tbl_Matches
-- ---------------------------------------------------------------------------

ALTER TABLE public."tbl_Matches"
  ADD COLUMN IF NOT EXISTS attendance INTEGER NULL;

ALTER TABLE public."tbl_Matches"
  DROP CONSTRAINT IF EXISTS "chk_tbl_Matches_attendance_non_negative";

ALTER TABLE public."tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_attendance_non_negative"
  CHECK (attendance IS NULL OR attendance >= 0);

COMMENT ON COLUMN public."tbl_Matches".attendance IS
  'Liczba widzów. NULL = brak danych. Bez górnego limitu.';

-- ---------------------------------------------------------------------------
-- 2) is_captain na tbl_Match_Participants
-- ---------------------------------------------------------------------------

ALTER TABLE public."tbl_Match_Participants"
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false;

-- Kapitan musi być zawodnikiem pierwszego składu.
ALTER TABLE public."tbl_Match_Participants"
  DROP CONSTRAINT IF EXISTS "chk_tbl_Match_Participants_captain_only_starting";

ALTER TABLE public."tbl_Match_Participants"
  ADD CONSTRAINT "chk_tbl_Match_Participants_captain_only_starting"
  CHECK (
    is_captain = false
    OR (role = 'PLAYER' AND squad_role = 'STARTING'::public.squad_role_enum)
  );

-- Max 1 kapitan na (match_id, team_id).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_captain_unique"
  ON public."tbl_Match_Participants" (match_id, team_id)
  WHERE is_captain = true;

COMMENT ON COLUMN public."tbl_Match_Participants".is_captain IS
  'Flaga kapitana drużyny w danym meczu. Może być true tylko dla '
  'PLAYER + squad_role=STARTING. Max 1 kapitan per (match_id, team_id).';

COMMIT;
