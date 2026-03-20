BEGIN;

-- Uzupełnia komentarz tbl_Match_Events o konwencję dla zdarzenia SUBSTITUTION.
-- Decyzja podjęta 2026-03-20: primary = schodzący, secondary = wchodzący.

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

  Konwencja primary_person_id / secondary_person_id:
  - MATCH_PENALTY_SAVED: primary_person_id = wykonawca (wymagane),
    secondary_person_id = bramkarz (opcjonalnie, jeśli znany; w przeciwnym razie
    może być wyliczany z boiska).
  - SUBSTITUTION: primary_person_id = zawodnik schodzący (wymagane),
    secondary_person_id = zawodnik wchodzący (wymagane).
';

COMMIT;
