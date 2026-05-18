BEGIN;

-- Etap: indeksy dla nowego zapytania o lokalizację meczu (stadion / miasto / kraj)
-- używanego przez filtr "Lokalizacja" we wstążce kart Trenerzy i Sędziowie.
-- Patrz: getMatchVenuesByMatchId() w lib/db/people.ts.
-- Konwencja: idx_<table>_<col1>.

-- tbl_Matches: per-match join po stadionie / mieście
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_match_stadium_id"
  ON public."tbl_Matches" (match_stadium_id)
  WHERE match_stadium_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_match_city_id"
  ON public."tbl_Matches" (match_city_id)
  WHERE match_city_id IS NOT NULL;

-- tbl_Stadiums: stadion → miasto (resolve city z stadionu)
CREATE INDEX IF NOT EXISTS "idx_tbl_Stadiums_stadium_city_id"
  ON public."tbl_Stadiums" (stadium_city_id)
  WHERE stadium_city_id IS NOT NULL;

-- tbl_City_Country_Periods: miasto → kraj w danym przedziale czasu
CREATE INDEX IF NOT EXISTS "idx_tbl_City_Country_Periods_city_id"
  ON public."tbl_City_Country_Periods" (city_id);

COMMIT;
