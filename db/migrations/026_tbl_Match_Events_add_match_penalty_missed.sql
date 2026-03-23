DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'match_event_type_enum'
  ) THEN
    BEGIN
      ALTER TYPE match_event_type_enum ADD VALUE IF NOT EXISTS 'MATCH_PENALTY_MISSED';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
