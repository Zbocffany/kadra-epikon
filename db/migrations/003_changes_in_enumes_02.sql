BEGIN;

-- 1) Zmieniamy nazwę starego enumu
ALTER TYPE result_type_enum RENAME TO result_type_enum_old;

-- 2) Tworzymy nowy enum (z dodatkową wartością EXTRA&PENALTIES)
CREATE TYPE result_type_enum AS ENUM (
  'REGULAR_TIME',
  'EXTRA_TIME',
  'PENALTIES',
  'EXTRA&PENALTIES',
  'GOLDEN_GOAL',
  'WALKOVER'
);

-- 3) Przepinamy kolumnę na nowy enum z mapowaniem wartości
ALTER TABLE "tbl_Matches"
  ALTER COLUMN "result_type" TYPE result_type_enum
  USING (
    CASE "result_type"::text
      WHEN 'REGULAMINOWY' THEN 'REGULAR_TIME'
      WHEN 'DOGRYWKA'     THEN 'EXTRA_TIME'
      WHEN 'KARNE'        THEN 'PENALTIES'
      WHEN 'ZLOTY_GOL'    THEN 'GOLDEN_GOAL'
      WHEN 'WALKOWER'    THEN 'WALKOVER'
      ELSE NULL
    END
  )::result_type_enum;

-- 4) Usuwamy stary enum
DROP TYPE result_type_enum_old;

COMMIT;
