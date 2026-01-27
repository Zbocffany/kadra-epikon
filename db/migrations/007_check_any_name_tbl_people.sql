ALTER TABLE public."tbl_People"
ADD CONSTRAINT chk_tbl_People_has_any_name
CHECK (
  (first_name IS NOT NULL AND btrim(first_name) <> '')
  OR (last_name  IS NOT NULL AND btrim(last_name) <> '')
  OR (nickname   IS NOT NULL AND btrim(nickname) <> '')
);
