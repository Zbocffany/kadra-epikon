-- 014_tbl_User_Roles.sql

-- 1) Create enum type for application roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role_enum AS ENUM (
      'ADMIN',
      'EDITOR'
    );
  END IF;
END $$;

-- 2) Create table for role assignment (Auth identity -> app role)
CREATE TABLE IF NOT EXISTS public."tbl_User_Roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auth_user_id" uuid NOT NULL,
  "role" public.user_role_enum NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- 3) Enforce one active role profile per auth user for now
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_tbl_User_Roles_auth_user_id'
  ) THEN
    ALTER TABLE public."tbl_User_Roles"
      ADD CONSTRAINT "uq_tbl_User_Roles_auth_user_id"
      UNIQUE ("auth_user_id");
  END IF;
END $$;

-- 4) Foreign key to Supabase Auth users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tbl_User_Roles_auth_user_id'
  ) THEN
    ALTER TABLE public."tbl_User_Roles"
      ADD CONSTRAINT "fk_tbl_User_Roles_auth_user_id"
      FOREIGN KEY ("auth_user_id")
      REFERENCES auth.users (id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Helper index for admin checks
CREATE INDEX IF NOT EXISTS "idx_tbl_User_Roles_auth_active"
  ON public."tbl_User_Roles" ("auth_user_id", "is_active");

COMMENT ON TABLE public."tbl_User_Roles" IS
'Application authorization table. Maps Supabase Auth users to app roles.';

COMMENT ON COLUMN public."tbl_User_Roles"."auth_user_id" IS
'User id from auth.users (Supabase Auth).';
