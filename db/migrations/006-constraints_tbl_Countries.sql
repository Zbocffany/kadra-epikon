-- 0XX_add_constraints_countries.sql

ALTER TABLE public."tbl_Countries"
  ADD CONSTRAINT "tbl_Countries_iso_code_unique" UNIQUE (iso_code);

ALTER TABLE public."tbl_Countries"
  ADD CONSTRAINT "tbl_Countries_fifa_code_unique" UNIQUE (fifa_code);

ALTER TABLE public."tbl_Countries"
  ADD CONSTRAINT "tbl_Countries_iso_code_format_check"
  CHECK (
    iso_code IS NULL OR
    (char_length(iso_code) = 2 AND iso_code = upper(iso_code))
  );

ALTER TABLE public."tbl_Countries"
  ADD CONSTRAINT "tbl_Countries_fifa_code_format_check"
  CHECK (
    fifa_code IS NULL OR
    (char_length(fifa_code) = 3 AND fifa_code = upper(fifa_code))
  );
