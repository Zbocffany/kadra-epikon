-- 0XX_replace_people_roles_with_enum.sql

-- 1) Create enum for roles (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'people_role_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.people_role_enum AS ENUM ('PLAYER', 'COACH', 'REFEREE');
  END IF;
END $$;

-- 2) Add new enum column on participants (NOT NULL safe because table is empty)
ALTER TABLE public."tbl_Match_Participants"
  ADD COLUMN role public.people_role_enum NOT NULL;

-- 3) Drop FK constraint that references tbl_People_Roles
ALTER TABLE public."tbl_Match_Participants"
  DROP CONSTRAINT IF EXISTS "tbl_Match_Participants_role_id_fkey";

-- 4) Drop old unique index (depends on role_id)
DROP INDEX IF EXISTS public."tbl_Match_Participants_match_id_team_id_person_id_role_id_idx";

-- 5) Drop old role_id column
ALTER TABLE public."tbl_Match_Participants"
  DROP COLUMN role_id;

-- 6) Create new unique index using enum role
CREATE UNIQUE INDEX IF NOT EXISTS "tbl_Match_Participants_match_id_team_id_person_id_role_idx"
ON public."tbl_Match_Participants" USING btree (match_id, team_id, person_id, role);

-- 7) Enforce: player_position only for role='PLAYER'
ALTER TABLE public."tbl_Match_Participants"
  ADD CONSTRAINT "chk_tbl_Match_Participants_player_position_only_for_player"
  CHECK (
    role = 'PLAYER'::public.people_role_enum
    OR player_position IS NULL
  );

-- 8) Drop roles table (now unused and empty)
DROP TABLE IF EXISTS public."tbl_People_Roles";
