BEGIN;

DO $$
DECLARE
  current_comment text;
BEGIN
  SELECT obj_description('public."tbl_Match_Events"'::regclass, 'pg_class')
    INTO current_comment;

  IF current_comment IS NOT NULL THEN
    EXECUTE format(
      'COMMENT ON TABLE public."tbl_Match_Events" IS %L',
      replace(
        current_comment,
        'SUBSTITUTION:         primary = zawodnik schodzący (wymagane),
                          secondary = zawodnik wchodzący (wymagane).',
        'SUBSTITUTION:         primary = zawodnik schodzący (wymagane),
                          secondary = zawodnik wchodzący (opcjonalne).
                          NULL oznacza zejście bez zmiennika, wymagające
                          potwierdzenia podczas zapisu w panelu admina.'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public."tbl_Match_Events".secondary_person_id IS
  'Dla SUBSTITUTION: zawodnik wchodzący; NULL oznacza zejście bez zmiennika. Dla pozostałych typów znaczenie określa komentarz tabeli.';

COMMIT;
