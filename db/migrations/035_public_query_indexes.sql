BEGIN;

-- Etap 1: bazowe indeksy dla hot-path zapytań publicznych w lib/db/people.ts,
-- lib/db/matches.ts, lib/db/clubs.ts. Wszystkie IF NOT EXISTS, idempotentne.
-- Konwencja: idx_<table>_<col1>_<col2>.

-- tbl_Match_Participants: filtry po (role, person_id), per-person, per-match
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_role_person_id"
  ON public."tbl_Match_Participants" (role, person_id);
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_person_id"
  ON public."tbl_Match_Participants" (person_id);
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Participants_match_id"
  ON public."tbl_Match_Participants" (match_id);

-- tbl_Match_Events: per-person filtry (gole, asysty, kartki, zmiany)
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_primary_person_id"
  ON public."tbl_Match_Events" (primary_person_id)
  WHERE primary_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_secondary_person_id"
  ON public."tbl_Match_Events" (secondary_person_id)
  WHERE secondary_person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_match_id_event_type"
  ON public."tbl_Match_Events" (match_id, event_type);

-- tbl_Matches: sortowanie po dacie, joiny po competition/team
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_match_date"
  ON public."tbl_Matches" (match_date DESC);
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_competition_id"
  ON public."tbl_Matches" (competition_id);
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_home_team_id"
  ON public."tbl_Matches" (home_team_id);
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_away_team_id"
  ON public."tbl_Matches" (away_team_id);

-- tbl_Person_Team_Periods: lookup per osoba (linia czasu klubowa)
CREATE INDEX IF NOT EXISTS "idx_tbl_Person_Team_Periods_person_id"
  ON public."tbl_Person_Team_Periods" (person_id);

-- tbl_Person_Countries: lookup per osoba
CREATE INDEX IF NOT EXISTS "idx_tbl_Person_Countries_person_id"
  ON public."tbl_Person_Countries" (person_id);

COMMIT;
