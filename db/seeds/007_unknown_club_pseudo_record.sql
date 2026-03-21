-- 007_unknown_club_pseudo_record.sql
--
-- Prerequisite: Must run after migration 025_add_unknown_club_pseudo_record.sql
--
-- Ensures the "Unknown Club" pseudo record exists for when player club data is missing.
-- This is NOT real data but a placeholder to distinguish:
--   - NULL = player has no club (e.g., retired, between clubs)
--   - Brak danych = club information is unknown/missing for this match date

INSERT INTO public."tbl_Clubs" (id, name, club_city_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Brak danych', NULL)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public."tbl_Teams" (id, club_id)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
