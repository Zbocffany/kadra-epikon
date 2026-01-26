-- 1) Zwolnij nazwę enumu (zmień nazwę starego typu)
ALTER TYPE match_status_enum RENAME TO match_status_enum_old;

-- 2) Utwórz nowy enum pod właściwą nazwą
CREATE TYPE match_status_enum AS ENUM (
  'SCHEDULED',
  'FINISHED',
  'ABANDONED',
  'CANCELLED'
);

-- 3) Zdejmij CHECK, który używa starej wartości 'ZAKONCZONY'
ALTER TABLE "tbl_Matches" DROP CONSTRAINT IF EXISTS "chk_tbl_Matches_result_type_when_finished";

-- 4) Przepnij kolumnę na nowy enum z mapowaniem wartości
ALTER TABLE "tbl_Matches"
  ALTER COLUMN "match_status" TYPE match_status_enum
  USING (
    CASE "match_status"::text
      WHEN 'ZAPLANOWANY' THEN 'SCHEDULED'
      WHEN 'ZAKONCZONY'  THEN 'FINISHED'
      WHEN 'PRZERWANY'   THEN 'ABANDONED'
      WHEN 'ANULOWANY'   THEN 'CANCELLED'
      ELSE NULL
    END
  )::match_status_enum;

-- 5) Załóż CHECK ponownie, ale już na nowych wartościach
ALTER TABLE "tbl_Matches"
  ADD CONSTRAINT "chk_tbl_Matches_result_type_when_finished"
  CHECK (
    (match_status = 'FINISHED' AND result_type IS NOT NULL)
    OR
    (match_status <> 'FINISHED' AND result_type IS NULL)
  );

-- 6) Usuń stary enum (jeśli już nikt go nie używa)
DROP TYPE match_status_enum_old;

COMMIT;
