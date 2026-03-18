-- 004_admin_user_roles.sql
--
-- Prerequisite:
--   The user account must already exist in Supabase Auth (auth.users).
--
-- Replace 'admin@example.com' with real email used in Auth.

INSERT INTO public."tbl_User_Roles" (auth_user_id, role, is_active)
SELECT
  u.id,
  'ADMIN'::public.user_role_enum,
  true
FROM auth.users u
WHERE u.email = 'tomasz.wasko.80@gmail.com'
ON CONFLICT (auth_user_id)
DO UPDATE SET
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;
