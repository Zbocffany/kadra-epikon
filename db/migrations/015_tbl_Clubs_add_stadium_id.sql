-- 015_tbl_Clubs_add_stadium_id.sql
--
-- Purpose:
--   Add a direct FK from tbl_Clubs to tbl_Stadiums so each club can have
--   a designated stadium (home ground).
--
-- Notes:
--   - Nullable: existing clubs simply have no stadium assigned yet.
--   - SET NULL on delete: removing a stadium clears the club reference.

ALTER TABLE public."tbl_Clubs"
  ADD COLUMN IF NOT EXISTS "stadium_id" uuid
    REFERENCES public."tbl_Stadiums"("id") ON DELETE SET NULL;
