BEGIN;

-- Uzupełnia komentarz tbl_Match_Events o konwencję primary/secondary dla wszystkich typów zdarzeń.
-- Dodano: MATCH_PENALTY_MISSED (nowy typ), pełna tabela konwencji osób dla bramek i kartek.

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
  - MATCH_PENALTY_MISSED
  - SUBSTITUTION

  Zdarzenia neutralne:
  - Dla zdarzeń niezwiązanych z żadną drużyną (np. zmiana sędziego),
  pole team_id może być NULL.

  Konwencja primary_person_id / secondary_person_id:

  Bramki:
  - GOAL:         primary = strzelec (wymagane),
                  secondary = asystent (opcjonalnie).
  - OWN_GOAL:     primary = strzelec samobójczej bramki (wymagane),
                  secondary = NULL (nie dotyczy).
                  Uwaga: primary_person_id pochodzi z drużyny PRZECIWNEJ
                  niż team_id zdarzenia (team_id = drużyna, której doliczamy gola).
  - PENALTY_GOAL: primary = wykonawca karnego (wymagane),
                  secondary = NULL (nie dotyczy).

  Kartki:
  - YELLOW_CARD:        primary = ukarany zawodnik (wymagane), secondary = NULL.
  - SECOND_YELLOW_CARD: primary = ukarany zawodnik (wymagane), secondary = NULL.
  - RED_CARD:           primary = ukarany zawodnik (wymagane), secondary = NULL.

  Karne pomeczowe:
  - PENALTY_SHOOTOUT_SCORED: primary = wykonawca (wymagane), secondary = NULL.
  - PENALTY_SHOOTOUT_MISSED: primary = wykonawca (wymagane), secondary = NULL.
  - PENALTY_SHOOTOUT_SAVED:  primary = wykonawca (wymagane), secondary = NULL.

  Inne:
  - MATCH_PENALTY_SAVED:  primary = wykonawca karnego (wymagane),
                          secondary = bramkarz broniący (opcjonalnie; jeśli nieznany,
                          może być wyliczany ze składu).
  - MATCH_PENALTY_MISSED: primary = wykonawca karnego (wymagane), secondary = NULL.
  - SUBSTITUTION:         primary = zawodnik schodzący (wymagane),
                          secondary = zawodnik wchodzący (wymagane).
';

COMMIT;
