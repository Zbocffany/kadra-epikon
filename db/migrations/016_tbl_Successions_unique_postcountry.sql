-- 016_tbl_Successions_unique_postcountry.sql
--
-- Purpose:
--   Enforce that each country can be a football successor of at most one
--   predecessor. In football succession logic, a new entity either:
--     (a) continues exactly one predecessor (1-to-1 chain), or
--     (b) starts from scratch (no predecessor at all).
--
-- Example that this constraint PREVENTS:
--   Both RFN and NRD → Niemcy1990 as postcountry_id would be blocked,
--   because Niemcy1990 can only be a successor of one entity (RFN).
--
-- Example that remains ALLOWED:
--   Niemcy_pre1945 → RFN → Niemcy1990  (two separate rows, each postcountry unique)

ALTER TABLE public."tbl_Successions"
  ADD CONSTRAINT successions_postcountry_unique UNIQUE ("postcountry_id");
