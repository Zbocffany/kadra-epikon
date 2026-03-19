-- 017_tbl_Country_History_event_type_enum.sql
--
-- Purpose:
--   Create an enum for country history event types and convert the
--   existing text column to use it.
--
-- Event types (football-scoped):
--   FOUNDED      - country/team entity established
--   DISSOLVED    - country/team entity ceased to exist
--   NAME_CHANGED - official name changed (e.g. West Germany → Germany)
--   INDEPENDENCE - gained independence (relevant for new team history start)
--   UNIFICATION  - merged with another country/entity
--   PARTITION    - split into separate entities
--   FIFA_JOIN    - joined FIFA
--   UEFA_JOIN    - joined UEFA
--   FIFA_LEAVE   - left or expelled from FIFA
--   UEFA_LEAVE   - left or expelled from UEFA
--   OTHER        - any other notable football-relevant event

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'country_history_event_type_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.country_history_event_type_enum AS ENUM (
      'FOUNDED',
      'DISSOLVED',
      'NAME_CHANGED',
      'INDEPENDENCE',
      'UNIFICATION',
      'PARTITION',
      'FIFA_JOIN',
      'UEFA_JOIN',
      'FIFA_LEAVE',
      'UEFA_LEAVE',
      'OTHER'
    );
  END IF;
END $$;

ALTER TABLE public."tbl_Country_History"
  ALTER COLUMN event_type TYPE public.country_history_event_type_enum
  USING (
    CASE
      WHEN event_type IS NULL THEN NULL
      ELSE upper(btrim(event_type))::public.country_history_event_type_enum
    END
  );
