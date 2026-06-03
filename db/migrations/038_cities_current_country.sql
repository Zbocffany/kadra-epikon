BEGIN;

-- =====================================================================
-- Etap: denormalizacja aktualnego kraju miasta do tbl_Cities.
--
-- Cel:
--   * Aktualny kraj miasta = pojedyncza kolumna w tbl_Cities (jedno JOINowane
--     źródło prawdy). Wcześniej kraj był wyciągany z tbl_City_Country_Periods,
--     a w tabeli okresów istniał wiersz NULL/NULL ("cały okres") wstawiany
--     przez tworzenie miasta. Ten wzorzec był mylący i wymagał ręcznego
--     czyszczenia w warstwie aplikacyjnej (purgeRedundantOpenAllPeriods).
--
--   * tbl_City_Country_Periods = TYLKO datowane zmiany przynależności
--     (co najmniej jedna z dat valid_from / valid_to musi być NOT NULL).
--
--   * Trigger sync utrzymuje tbl_Cities.current_country_id w spójności
--     z aktualnym (otwartym) okresem.
--
-- Po migracji: miasto bez historii zmian = 0 wierszy w periods + flaga
-- z tbl_Cities. Miasto ze zmianą (np. Lwów) = N wierszy z datami, otwarty
-- okres synchronizuje current_country_id.
-- =====================================================================

-- Wymagane dla EXCLUDE USING gist z UUID + daterange.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- 1. Nowa kolumna w tbl_Cities.
-- ---------------------------------------------------------------------
ALTER TABLE public."tbl_Cities"
  ADD COLUMN IF NOT EXISTS "current_country_id" uuid NULL
  REFERENCES public."tbl_Countries"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 2. Backfill: dla każdego miasta wybierz "current" okres
--    (otwarty valid_to IS NULL ma priorytet, potem najpóźniejszy valid_to,
--    potem najpóźniejszy valid_from) i wpisz country_id do tbl_Cities.
-- ---------------------------------------------------------------------
WITH ranked AS (
  SELECT
    p.city_id,
    p.country_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.city_id
      ORDER BY
        (p.valid_to IS NULL) DESC,
        p.valid_to DESC NULLS LAST,
        p.valid_from DESC NULLS LAST,
        p.id ASC
    ) AS rn
  FROM public."tbl_City_Country_Periods" p
)
UPDATE public."tbl_Cities" c
SET "current_country_id" = r.country_id
FROM ranked r
WHERE r.rn = 1
  AND c."id" = r.city_id
  AND c."current_country_id" IS DISTINCT FROM r.country_id;

-- ---------------------------------------------------------------------
-- 3. Czyszczenie: usuń wszystkie wiersze NULL/NULL "cały okres".
--    Aktualny kraj jest już zachowany w tbl_Cities (krok 2).
-- ---------------------------------------------------------------------
DELETE FROM public."tbl_City_Country_Periods"
WHERE valid_from IS NULL AND valid_to IS NULL;

-- ---------------------------------------------------------------------
-- 4. Constraints na tbl_City_Country_Periods.
-- ---------------------------------------------------------------------

-- CHECK: każdy wiersz musi mieć przynajmniej jedną datę graniczną.
ALTER TABLE public."tbl_City_Country_Periods"
  DROP CONSTRAINT IF EXISTS "tbl_City_Country_Periods_dates_chk";
ALTER TABLE public."tbl_City_Country_Periods"
  ADD CONSTRAINT "tbl_City_Country_Periods_dates_chk"
  CHECK ("valid_from" IS NOT NULL OR "valid_to" IS NOT NULL);

-- CHECK: jeśli obie daty są podane, valid_from <= valid_to.
ALTER TABLE public."tbl_City_Country_Periods"
  DROP CONSTRAINT IF EXISTS "tbl_City_Country_Periods_order_chk";
ALTER TABLE public."tbl_City_Country_Periods"
  ADD CONSTRAINT "tbl_City_Country_Periods_order_chk"
  CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_from" <= "valid_to");

-- UNIQUE PARTIAL: co najwyżej jeden otwarty okres (valid_to IS NULL) na miasto.
DROP INDEX IF EXISTS "uniq_city_country_periods_open";
CREATE UNIQUE INDEX "uniq_city_country_periods_open"
  ON public."tbl_City_Country_Periods" ("city_id")
  WHERE "valid_to" IS NULL;

-- EXCLUDE: brak zachodzących okresów dla tego samego miasta.
-- Konwencja [) — valid_to traktowany jako wykluczający TYLKO na potrzeby
-- constraintu. Dzięki temu dwa okresy mogą dotknąć się tym samym dniem
-- (P1.valid_to = P2.valid_from), co jest typowe w datach historycznych
-- zmian państwowości (np. 1945-01-01). Realny overlap >1 dzień nadal
-- blokowany. Semantyka aplikacyjna (valid_to inclusive jako "ostatni
-- dzień obowiązywania") pozostaje bez zmian.
ALTER TABLE public."tbl_City_Country_Periods"
  DROP CONSTRAINT IF EXISTS "tbl_City_Country_Periods_no_overlap";
ALTER TABLE public."tbl_City_Country_Periods"
  ADD CONSTRAINT "tbl_City_Country_Periods_no_overlap"
  EXCLUDE USING gist (
    "city_id" WITH =,
    daterange(
      COALESCE("valid_from", '-infinity'::date),
      COALESCE("valid_to", 'infinity'::date),
      '[)'
    ) WITH &&
  );

-- ---------------------------------------------------------------------
-- 5. Indeksy wspierające zapytania (zgodnie z konwencją projektu).
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_tbl_City_Country_Periods_city_id"
  ON public."tbl_City_Country_Periods" ("city_id");

CREATE INDEX IF NOT EXISTS "idx_tbl_City_Country_Periods_country_id"
  ON public."tbl_City_Country_Periods" ("country_id");

CREATE INDEX IF NOT EXISTS "idx_tbl_Cities_current_country_id"
  ON public."tbl_Cities" ("current_country_id")
  WHERE "current_country_id" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 6. Trigger: synchronizuj tbl_Cities.current_country_id z otwartym okresem.
--
-- Reguły:
--   * INSERT okresu z valid_to IS NULL  -> ustaw current_country_id miasta.
--   * UPDATE okresu (zmiana country_id lub zamknięcie otwartego okresu /
--     otwarcie zamkniętego) -> przelicz current_country_id na podstawie
--     aktualnego stanu periodów dla tego miasta.
--   * DELETE okresu otwartego -> przelicz (może spaść na inny okres lub
--     wyzerować, jeśli nie ma już żadnego otwartego).
--
-- Nie nadpisujemy current_country_id "ślepo" na NULL — zostaje ostatnia
-- znana wartość, jeśli usunięto wszystkie okresy (miasto nadal ma flagę).
-- Nadpisujemy tylko, gdy znaleziono nowy otwarty okres.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_city_current_country()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_city_id uuid;
  v_new_country uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_city_id := NEW.city_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_city_id := NEW.city_id;
    -- Jeśli zmieniono city_id, zsynchronizuj również poprzednie miasto.
    IF OLD.city_id IS DISTINCT FROM NEW.city_id THEN
      SELECT p.country_id INTO v_new_country
      FROM public."tbl_City_Country_Periods" p
      WHERE p.city_id = OLD.city_id AND p.valid_to IS NULL
      LIMIT 1;

      IF v_new_country IS NOT NULL THEN
        UPDATE public."tbl_Cities"
        SET current_country_id = v_new_country
        WHERE id = OLD.city_id
          AND current_country_id IS DISTINCT FROM v_new_country;
      END IF;
    END IF;
  ELSE -- DELETE
    v_city_id := OLD.city_id;
  END IF;

  SELECT p.country_id INTO v_new_country
  FROM public."tbl_City_Country_Periods" p
  WHERE p.city_id = v_city_id AND p.valid_to IS NULL
  LIMIT 1;

  IF v_new_country IS NOT NULL THEN
    UPDATE public."tbl_Cities"
    SET current_country_id = v_new_country
    WHERE id = v_city_id
      AND current_country_id IS DISTINCT FROM v_new_country;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_sync_city_current_country" ON public."tbl_City_Country_Periods";
CREATE TRIGGER "trg_sync_city_current_country"
AFTER INSERT OR UPDATE OR DELETE ON public."tbl_City_Country_Periods"
FOR EACH ROW
EXECUTE FUNCTION public.sync_city_current_country();

COMMIT;
