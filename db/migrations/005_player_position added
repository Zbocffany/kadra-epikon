-- 00X_add_player_position_to_match_participants.sql

-- 1) Create enum (safe if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'player_position_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.player_position_enum AS ENUM (
      'GOALKEEPER',
      'DEFENDER',
      'MIDFIELDER',
      'ATTACKER'
    );
  END IF;
END $$;

-- 2) Add column to Match Participants (quoted identifier!)
ALTER TABLE public."tbl_Match_Participants"
ADD COLUMN IF NOT EXISTS player_position public.player_position_enum;
