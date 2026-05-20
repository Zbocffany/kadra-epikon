BEGIN;

-- Etap: indeksy dla publicznej karty miasta i listy miast.
-- Patrz: getPublicCityProfile() i getPublicCityList() w lib/db/citiesPublic.ts.
-- Konwencja: idx_<table>_<col1>[_<col2>].

-- tbl_People: osoby urodzone w mieście (where birth_city_id = ?)
CREATE INDEX IF NOT EXISTS "idx_tbl_People_birth_city_id"
  ON public."tbl_People" (birth_city_id)
  WHERE birth_city_id IS NOT NULL;

-- tbl_Clubs: kluby z danego miasta (where club_city_id = ?)
CREATE INDEX IF NOT EXISTS "idx_tbl_Clubs_club_city_id"
  ON public."tbl_Clubs" (club_city_id)
  WHERE club_city_id IS NOT NULL;

-- tbl_Club_History: data założenia klubu (where event_type = 'FOUNDED' and club_id in (...))
-- Wąski indeks częściowy – tylko zdarzenia FOUNDED z datą.
CREATE INDEX IF NOT EXISTS "idx_tbl_Club_History_founded_club_id"
  ON public."tbl_Club_History" (club_id, event_date)
  WHERE event_type = 'FOUNDED' AND event_date IS NOT NULL;

COMMIT;
