BEGIN;

-- 1) Zmień nazwę starego typu (tego z &), żeby zwolnić nazwę result_type_enum
ALTER TYPE result_type_enum RENAME TO result_type_enum_bad;

-- 2) Nowy typ (v2) przejmie docelową nazwę
ALTER TYPE result_type_enum_v2 RENAME TO result_type_enum;

-- 3) Usuń stary typ (powinno zadziałać, jeśli nigdzie nie jest używany)
DROP TYPE result_type_enum_bad;

COMMIT;
