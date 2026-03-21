BEGIN;

-- Constants for the pseudo "Unknown Club" record
-- Club ID: 00000000-0000-0000-0000-000000000001
-- Team ID: 00000000-0000-0000-0000-000000000002

-- Insert pseudo club for "Unknown/Missing data"
INSERT INTO public."tbl_Clubs" (id, name, club_city_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Brak danych', NULL)
ON CONFLICT (name) DO NOTHING;

-- Insert corresponding team (for internal reference in tbl_Match_Participants.club_team_id)
INSERT INTO public."tbl_Teams" (id, club_id)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public."tbl_Match_Participants".club_team_id IS
'Current club team of the participant. NULL = player has no club (unattached). Use pseudo team 00000000-0000-0000-0000-000000000002 when club data is unknown/missing.';

COMMIT;
