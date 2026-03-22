BEGIN;

CREATE TABLE IF NOT EXISTS public."tbl_Person_Countries" (
  person_id uuid NOT NULL,
  country_id uuid NOT NULL,
  PRIMARY KEY (person_id, country_id)
);

ALTER TABLE public."tbl_Person_Countries"
  DROP CONSTRAINT IF EXISTS fk_tbl_Person_Countries_person;

ALTER TABLE public."tbl_Person_Countries"
  ADD CONSTRAINT fk_tbl_Person_Countries_person
  FOREIGN KEY (person_id)
  REFERENCES public."tbl_People"(id)
  ON DELETE CASCADE;

ALTER TABLE public."tbl_Person_Countries"
  DROP CONSTRAINT IF EXISTS fk_tbl_Person_Countries_country;

ALTER TABLE public."tbl_Person_Countries"
  ADD CONSTRAINT fk_tbl_Person_Countries_country
  FOREIGN KEY (country_id)
  REFERENCES public."tbl_Countries"(id);

CREATE INDEX IF NOT EXISTS idx_tbl_Person_Countries_country
  ON public."tbl_Person_Countries" (country_id);

COMMENT ON TABLE public."tbl_Person_Countries" IS
'Reprezentowane kraje osoby (wariant bez dat).\n\nJeśli osoba nie ma żadnego rekordu w tej tabeli, w aplikacji obowiązuje fallback:\nreprezentowany kraj = kraj urodzenia (birth_country_id).';

COMMIT;
