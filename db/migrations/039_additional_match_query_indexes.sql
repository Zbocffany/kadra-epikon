BEGIN;

-- Etap 1 (uzupełnienie): brakujące indeksy zidentyfikowane w audycie
-- na 2025-01. Uzupełniają migrację 035 o kolumny używane w widokach
-- publicznych i statystykach analitycznych.

-- Ranking meczów: filtr po statusie i sortowanie po dacie DESC.
-- Wspiera getPublicMatchesList / getPublicUpcomingMatches / listy admin.
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_match_date_match_status"
  ON public."tbl_Matches" (match_date DESC, match_status);

-- Agregacje po typie zdarzenia (gole/asysty/kartki) używane w statystykach
-- gracza i topach strzelców. Bez tego indeksu Postgres skanuje całą tabelę.
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_event_type"
  ON public."tbl_Match_Events" (event_type);

-- Filtr per drużyna (goal-scorer stats per klub). Zdarzenia bez team_id
-- (np. zdarzenia bez przypisania drużyny) są rzadkie — partial index.
CREATE INDEX IF NOT EXISTS "idx_tbl_Match_Events_team_id"
  ON public."tbl_Match_Events" (team_id)
  WHERE team_id IS NOT NULL;

COMMIT;
