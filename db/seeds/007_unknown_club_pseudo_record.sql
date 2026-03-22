-- 007_unknown_club_pseudo_record.sql
--
-- Pseudo club "Brak klubu" for storing explicit no-club player status.
-- This is NOT real data but a placeholder to distinguish:
--   - NULL = Brak danych (club information is unknown/missing for this match date)
--   - Brak klubu = player explicitly has no club (e.g., retired, between clubs)

INSERT INTO public."tbl_Clubs" (id, name, club_city_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Brak klubu', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
	club_city_id = EXCLUDED.club_city_id;

-- Ensure there is a team row for the pseudo club.
-- Do not force a fixed team ID, because a row may already exist (auto-created by trigger)
-- and tbl_Teams.club_id is UNIQUE.
INSERT INTO public."tbl_Teams" (id, country_id, club_id)
SELECT gen_random_uuid(), NULL, '00000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
	SELECT 1
	FROM public."tbl_Teams"
	WHERE club_id = '00000000-0000-0000-0000-000000000001'
);
