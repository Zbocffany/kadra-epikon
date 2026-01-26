-- 1) ENUM TYPES (muszą istnieć przed tabelami, które ich używają)

DO $$ BEGIN
  CREATE TYPE match_status_enum AS ENUM (
    'ZAPLANOWANY',
    'ZAKONCZONY',
    'PRZERWANY',
    'ANULOWANY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE result_type_enum AS ENUM (
    'REGULAMINOWY',
    'DOGRYWKA',
    'DOGRYWKA_KARNE'
    'KARNE',
    'ZLOTY_GOL',
    'WALKOWER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_event_type_enum AS ENUM (
    'GOAL',
    'OWN_GOAL',
    'PENALTY_GOAL',
    'YELLOW_CARD',
    'SECOND_YELLOW_CARD',
    'RED_CARD',
    'PENALTY_SHOOTOUT_SCORED',
    'PENALTY_SHOOTOUT_MISSED',
    'PENALTY_SHOOTOUT_SAVED',
    'MATCH_PENALTY_SAVED',
    'SUBSTITUTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "tbl_Countries" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "fifa_code" char(3),
  "iso_code" char(2)
);

CREATE TABLE "tbl_Matches" (
  "id" uuid PRIMARY KEY,
  "home_team_id" uuid NOT NULL,
  "away_team_id" uuid NOT NULL,
  "competition_id" uuid NOT NULL,
  "match_date" date NOT NULL,
  "match_time" time,
  "match_stadium_id" uuid,
  "match_status" match_status_enum NOT NULL,
  "result_type" result_type_enum,
  "match_city_id" uuid
);

CREATE TABLE "tbl_Cities" (
  "id" uuid PRIMARY KEY,
  "city_name" text
);

CREATE TABLE "tbl_People" (
  "id" uuid PRIMARY KEY,
  "last_name" text,
  "first_name" text,
  "nickname" text,
  "birth_date" date,
  "birth_city_id" uuid,
  "is_active" bool,
  "birth_country_id" uuid
);

CREATE TABLE "tbl_Stadiums" (
  "id" uuid PRIMARY KEY,
  "name" text,
  "stadium_city_id" uuid
);

CREATE TABLE "tbl_Competitions" (
  "id" uuid PRIMARY KEY,
  "name" text UNIQUE
);

CREATE TABLE "tbl_People_Roles" (
  "id" uuid PRIMARY KEY,
  "name" text UNIQUE
);

CREATE TABLE "tbl_Clubs" (
  "id" uuid PRIMARY KEY,
  "name" text UNIQUE,
  "club_city_id" uuid
);

CREATE TABLE "tbl_Successions" (
  "id" uuid PRIMARY KEY,
  "precountry_id" uuid UNIQUE,
  "postcountry_id" uuid
);

CREATE TABLE "tbl_Country_History" (
  "id" uuid PRIMARY KEY,
  "country_id" uuid NOT NULL,
  "event_date" date,
  "title" text,
  "description" text,
  "event_type" text,
  "event_order" int
);

CREATE TABLE "tbl_Club_History" (
  "id" uuid PRIMARY KEY,
  "club_id" uuid NOT NULL,
  "event_date" date,
  "title" text,
  "description" text,
  "event_type" text,
  "event_order" int
);

CREATE TABLE "tbl_City_Country_Periods" (
  "id" uuid PRIMARY KEY,
  "city_id" uuid NOT NULL,
  "country_id" uuid NOT NULL,
  "valid_from" date,
  "valid_to" date,
  "description" text
);

CREATE TABLE "tbl_Match_Participants" (
  "id" uuid PRIMARY KEY,
  "match_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "is_starting" bool,
  "club_team_id" uuid
);

CREATE TABLE "tbl_Teams" (
  "id" uuid PRIMARY KEY,
  "country_id" uuid UNIQUE,
  "club_id" uuid UNIQUE
);

CREATE TABLE "tbl_Person_Team_Periods" (
  "id" uuid PRIMARY KEY,
  "person_id" uuid NOT NULL,
  "club_team_id" uuid NOT NULL,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "description" text
);

CREATE TABLE "tbl_Match_Events" (
  "id" uuid PRIMARY KEY,
  "match_id" uuid NOT NULL,
  "team_id" uuid,
  "event_type" match_event_type_enum NOT NULL,
  "minute" int NOT NULL,
  "minute_extra" int,
  "primary_person_id" uuid,
  "secondary_person_id" uuid,
  "notes" text,
  "event_order" int
);

CREATE UNIQUE INDEX ON "tbl_Match_Participants" ("match_id", "team_id", "person_id", "role_id");

CREATE INDEX ON "tbl_Match_Events" ("match_id", "minute", "minute_extra", "event_order");

COMMENT ON TABLE "tbl_Matches" IS 'result_type (ENUM):

Sposób rozstrzygnięcia meczu.
Wartości:
- REGULAMINOWY (90 minut)
- DOGRYWKA
- KARNE
- ZLOTY_GOL
- WALKOWER

match_status (ENUM):

Stan administracyjny meczu.
Wartości:
- ZAPLANOWANY
- ZAKONCZONY
- PRZERWANY
- ANULOWANY

ZASADA LOKALIZACJI MECZU:

- match_stadium_id jest polem opcjonalnym.
- match_city_id jest wymagane TYLKO gdy match_stadium_id IS NULL.

Reguły interpretacji:
- Jeśli match_stadium_id IS NOT NULL → miasto i kraj meczu wynikają ze stadionu.
- Jeśli match_stadium_id IS NULL → match_city_id MUSI być ustawione.
- Niedozwolone: oba pola NULL.

Kraj meczu zawsze wynika z miasta + tbl_City_Country_Periods + match_date.


W Twojej logice:

jeśli match_status != ZAKONCZONY → result_type powinno być NULL

jeśli match_status = ZAKONCZONY → result_type powinno być ustawione
Do wymuszenia CHECK constraintem w PostgreSQL
';

COMMENT ON TABLE "tbl_People" IS 'Zasada miejsca urodzenia osoby:

- Jeśli birth_city_id IS NOT NULL → kraj urodzenia wynika z miasta
  (tbl_Cities + tbl_City_Country_Periods + birth_date).
- Jeśli birth_city_id IS NULL → birth_country_id MUSI być ustawione.
- Niedozwolone: oba pola NULL.
';

COMMENT ON TABLE "tbl_Match_Participants" IS 'Zasada danych:
club_team_id powinno wskazywać team, który ma club_id != NULL (czyli klub).

Zasada przynależności klubowej zawodnika w meczu:

- Jeśli club_team_id IS NOT NULL → jest to klub zawodnika na dzień meczu (snapshot dla tego meczu).
- Jeśli club_team_id IS NULL → klub zawodnika może być wyliczony na podstawie
  tbl_Person_Team_Periods + match_date (fallback do biogramu).
- Brak club_team_id nie jest błędem danych.

Zasada spójności:
club_team_id, jeśli ustawione, MUSI wskazywać team-klub (tbl_Teams.club_id != NULL).
';

COMMENT ON TABLE "tbl_Teams" IS 'Zasada spójności danych (do wymuszenia CHECK constraintem w PostgreSQL):

Dokładnie jedno z pól country_id lub club_id MUSI być ustawione.

- Jeśli country_id IS NOT NULL → rekord reprezentuje reprezentację narodową
- Jeśli club_id IS NOT NULL → rekord reprezentuje klub
- Niedozwolone:
  - oba pola NULL
  - oba pola jednocześnie wypełnione

Typ drużyny (reprezentacja / klub) wynika z tego, które pole jest wypełnione.
';

COMMENT ON TABLE "tbl_Person_Team_Periods" IS 'ZASADY DANYCH (daty mogą być nieznane):

- Okres przynależności klubowej może mieć niepełne daty.
- valid_from wymagane / valid_to  opcjonalne i przechowywane tylko, jeśli są znane.
- valid_to, jeśli podane, jest WŁĄCZNIE (inclusive).

Zasady interpretacji:
- Okres z valid_to = NULL oznacza "do chwili obecnej" lub "brak znanej daty końcowej".
- Do podpowiadania klubu na dzień meczu:
  - jeśli istnieje okres z datami obejmujący match_date → użyj go,
  - w przeciwnym razie UI może zasugerować ostatni znany klub,
  - ostatecznym źródłem prawdy jest club_team_id w tbl_Match_Participants (snapshot meczu).

Zasady spójności:
- Okresy dla tej samej osoby nie powinny się nakładać (pilnujemy w danych).
- club_team_id musi wskazywać team-klub (tbl_Teams.club_id != NULL).
';

COMMENT ON TABLE "tbl_Match_Events" IS '  Zasady:
  - event_order służy do rozstrzygania kolejności, gdy zdarzenia mają ten sam czas.
  - Zdarzenia mogą mieć 0, 1 lub 2 osoby (primary/secondary zależnie od event_type).

  match_event_type_enum:

  Bramki:
  - GOAL
  - OWN_GOAL
  - PENALTY_GOAL

  Kartki:
  - YELLOW_CARD
  - SECOND_YELLOW_CARD
  - RED_CARD

  Karne pomeczowe (seria rzutów karnych):
  - PENALTY_SHOOTOUT_SCORED
  - PENALTY_SHOOTOUT_MISSED
  - PENALTY_SHOOTOUT_SAVED

  Inne:
  - MATCH_PENALTY_SAVED
  - SUBSTITUTION

  Zdarzenia neutralne:
  - Dla zdarzeń niezwiązanych z żadną drużyną (np. zmiana sędziego),
  pole team_id może być NULL.

  Konwencja:
- MATCH_PENALTY_SAVED: primary_person_id = wykonawca (wymagane),
  secondary_person_id = bramkarz (opcjonalnie, jeśli znany; w przeciwnym razie może być wyliczany z boiska).
';

ALTER TABLE "tbl_Match_Events" ADD FOREIGN KEY ("match_id") REFERENCES "tbl_Matches" ("id");

ALTER TABLE "tbl_Match_Events" ADD FOREIGN KEY ("team_id") REFERENCES "tbl_Teams" ("id");

ALTER TABLE "tbl_Match_Events" ADD FOREIGN KEY ("primary_person_id") REFERENCES "tbl_People" ("id");

ALTER TABLE "tbl_Match_Events" ADD FOREIGN KEY ("secondary_person_id") REFERENCES "tbl_People" ("id");

ALTER TABLE "tbl_People" ADD FOREIGN KEY ("birth_country_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_Matches" ADD FOREIGN KEY ("match_city_id") REFERENCES "tbl_Cities" ("id");

ALTER TABLE "tbl_Person_Team_Periods" ADD FOREIGN KEY ("person_id") REFERENCES "tbl_People" ("id");

ALTER TABLE "tbl_Person_Team_Periods" ADD FOREIGN KEY ("club_team_id") REFERENCES "tbl_Teams" ("id");

ALTER TABLE "tbl_Match_Participants" ADD FOREIGN KEY ("club_team_id") REFERENCES "tbl_Teams" ("id");

ALTER TABLE "tbl_Teams" ADD FOREIGN KEY ("country_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_Teams" ADD FOREIGN KEY ("club_id") REFERENCES "tbl_Clubs" ("id");

ALTER TABLE "tbl_City_Country_Periods" ADD FOREIGN KEY ("city_id") REFERENCES "tbl_Cities" ("id");

ALTER TABLE "tbl_City_Country_Periods" ADD FOREIGN KEY ("country_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_Club_History" ADD FOREIGN KEY ("club_id") REFERENCES "tbl_Clubs" ("id");

ALTER TABLE "tbl_Country_History" ADD FOREIGN KEY ("country_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_People" ADD FOREIGN KEY ("birth_city_id") REFERENCES "tbl_Cities" ("id");

ALTER TABLE "tbl_Stadiums" ADD FOREIGN KEY ("stadium_city_id") REFERENCES "tbl_Cities" ("id");

ALTER TABLE "tbl_Clubs" ADD FOREIGN KEY ("club_city_id") REFERENCES "tbl_Cities" ("id");

ALTER TABLE "tbl_Matches" ADD FOREIGN KEY ("away_team_id") REFERENCES "tbl_Teams" ("id");

ALTER TABLE "tbl_Matches" ADD FOREIGN KEY ("home_team_id") REFERENCES "tbl_Teams" ("id");

ALTER TABLE "tbl_Matches" ADD FOREIGN KEY ("competition_id") REFERENCES "tbl_Competitions" ("id");

ALTER TABLE "tbl_Matches" ADD FOREIGN KEY ("match_stadium_id") REFERENCES "tbl_Stadiums" ("id");

ALTER TABLE "tbl_Successions" ADD FOREIGN KEY ("postcountry_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_Successions" ADD FOREIGN KEY ("precountry_id") REFERENCES "tbl_Countries" ("id");

ALTER TABLE "tbl_Match_Participants" ADD FOREIGN KEY ("role_id") REFERENCES "tbl_People_Roles" ("id");

ALTER TABLE "tbl_Match_Participants" ADD FOREIGN KEY ("match_id") REFERENCES "tbl_Matches" ("id");

ALTER TABLE "tbl_Match_Participants" ADD FOREIGN KEY ("person_id") REFERENCES "tbl_People" ("id");

ALTER TABLE "tbl_Match_Participants" ADD FOREIGN KEY ("team_id") REFERENCES "tbl_Teams" ("id");

-- 2) CHECK CONSTRAINTS (minimalny zestaw z Twoich zasad)

-- Teams: dokładnie jedno z country_id / club_id
ALTER TABLE "tbl_Teams"
  ADD CONSTRAINT "chk_tbl_Teams_country_xor_club"
  CHECK (
    (country_id IS NOT NULL AND club_id IS NULL)
    OR
    (country_id IS NULL AND club_id IS NOT NULL)
  );

-- Matches: musi być stadion albo miasto (co najmniej jedno)
ALTER TABLE "tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_stadium_or_city"
  CHECK (
    match_stadium_id IS NOT NULL
    OR
    match_city_id IS NOT NULL
  );

-- Matches: zależność status <-> result_type
ALTER TABLE "tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_result_type_when_finished"
  CHECK (
    (match_status = 'ZAKONCZONY' AND result_type IS NOT NULL)
    OR
    (match_status <> 'ZAKONCZONY' AND result_type IS NULL)
  );

-- People: musi być miasto urodzenia albo kraj urodzenia (co najmniej jedno)
ALTER TABLE "tbl_People"
  ADD CONSTRAINT "chk_tbl_People_birth_city_or_country"
  CHECK (
    birth_city_id IS NOT NULL
    OR
    birth_country_id IS NOT NULL
  );

-- Person_Team_Periods: valid_to >= valid_from (jeśli valid_to jest podane)
ALTER TABLE "tbl_Person_Team_Periods"
  ADD CONSTRAINT "chk_tbl_Person_Team_Periods_valid_range"
  CHECK (
    valid_to IS NULL OR valid_to >= valid_from
  );

-- (opcjonalnie, ale sensowne) Match_Events: zakres minut
ALTER TABLE "tbl_Match_Events"
  ADD CONSTRAINT "chk_tbl_Match_Events_minute_range"
  CHECK (
    minute >= 0 AND minute <= 130
  );

ALTER TABLE "tbl_Match_Events"
  ADD CONSTRAINT "chk_tbl_Match_Events_minute_extra_range"
  CHECK (
    minute_extra IS NULL OR (minute_extra >= 0 AND minute_extra <= 30)
  );