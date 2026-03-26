-- 028_enable_rls_and_admin_editor_policies.sql
--
-- Goal:
-- 1) Enable and force RLS on all public application tables.
-- 2) Allow authenticated users with active ADMIN/EDITOR role to read/write domain data.
-- 3) Allow authenticated users to read only their own row in tbl_User_Roles.
--
-- Notes:
-- - This migration is idempotent (drops/recreates policies).
-- - Service role key bypasses RLS as usual in Supabase.

-- 1) Enable + force RLS on listed public tables
ALTER TABLE public."tbl_Cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Cities" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_City_Country_Periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_City_Country_Periods" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Club_History" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Club_History" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Clubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Clubs" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Competitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Competitions" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Countries" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Country_History" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Country_History" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Federations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Federations" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Match_Events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Match_Events" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Match_Participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Match_Participants" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Matches" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_People" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_People" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Person_Countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Person_Countries" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Person_Team_Periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Person_Team_Periods" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Stadiums" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Stadiums" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Successions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Successions" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_Teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Teams" FORCE ROW LEVEL SECURITY;

ALTER TABLE public."tbl_User_Roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_User_Roles" FORCE ROW LEVEL SECURITY;

-- 2) tbl_User_Roles policy: user can read only own role row
DROP POLICY IF EXISTS "tbl_User_Roles_select_own" ON public."tbl_User_Roles";
CREATE POLICY "tbl_User_Roles_select_own"
  ON public."tbl_User_Roles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = "auth_user_id");

-- 3) Common policy condition for ADMIN/EDITOR
--    Uses tbl_User_Roles restricted by the policy above to current user only.

-- tbl_Cities
DROP POLICY IF EXISTS "tbl_Cities_select_admin_editor" ON public."tbl_Cities";
DROP POLICY IF EXISTS "tbl_Cities_insert_admin_editor" ON public."tbl_Cities";
DROP POLICY IF EXISTS "tbl_Cities_update_admin_editor" ON public."tbl_Cities";
DROP POLICY IF EXISTS "tbl_Cities_delete_admin_editor" ON public."tbl_Cities";

CREATE POLICY "tbl_Cities_select_admin_editor" ON public."tbl_Cities" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Cities_insert_admin_editor" ON public."tbl_Cities" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Cities_update_admin_editor" ON public."tbl_Cities" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Cities_delete_admin_editor" ON public."tbl_Cities" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_City_Country_Periods
DROP POLICY IF EXISTS "tbl_City_Country_Periods_select_admin_editor" ON public."tbl_City_Country_Periods";
DROP POLICY IF EXISTS "tbl_City_Country_Periods_insert_admin_editor" ON public."tbl_City_Country_Periods";
DROP POLICY IF EXISTS "tbl_City_Country_Periods_update_admin_editor" ON public."tbl_City_Country_Periods";
DROP POLICY IF EXISTS "tbl_City_Country_Periods_delete_admin_editor" ON public."tbl_City_Country_Periods";

CREATE POLICY "tbl_City_Country_Periods_select_admin_editor" ON public."tbl_City_Country_Periods" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_City_Country_Periods_insert_admin_editor" ON public."tbl_City_Country_Periods" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_City_Country_Periods_update_admin_editor" ON public."tbl_City_Country_Periods" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_City_Country_Periods_delete_admin_editor" ON public."tbl_City_Country_Periods" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Club_History
DROP POLICY IF EXISTS "tbl_Club_History_select_admin_editor" ON public."tbl_Club_History";
DROP POLICY IF EXISTS "tbl_Club_History_insert_admin_editor" ON public."tbl_Club_History";
DROP POLICY IF EXISTS "tbl_Club_History_update_admin_editor" ON public."tbl_Club_History";
DROP POLICY IF EXISTS "tbl_Club_History_delete_admin_editor" ON public."tbl_Club_History";

CREATE POLICY "tbl_Club_History_select_admin_editor" ON public."tbl_Club_History" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Club_History_insert_admin_editor" ON public."tbl_Club_History" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Club_History_update_admin_editor" ON public."tbl_Club_History" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Club_History_delete_admin_editor" ON public."tbl_Club_History" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Clubs
DROP POLICY IF EXISTS "tbl_Clubs_select_admin_editor" ON public."tbl_Clubs";
DROP POLICY IF EXISTS "tbl_Clubs_insert_admin_editor" ON public."tbl_Clubs";
DROP POLICY IF EXISTS "tbl_Clubs_update_admin_editor" ON public."tbl_Clubs";
DROP POLICY IF EXISTS "tbl_Clubs_delete_admin_editor" ON public."tbl_Clubs";

CREATE POLICY "tbl_Clubs_select_admin_editor" ON public."tbl_Clubs" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Clubs_insert_admin_editor" ON public."tbl_Clubs" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Clubs_update_admin_editor" ON public."tbl_Clubs" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Clubs_delete_admin_editor" ON public."tbl_Clubs" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Competitions
DROP POLICY IF EXISTS "tbl_Competitions_select_admin_editor" ON public."tbl_Competitions";
DROP POLICY IF EXISTS "tbl_Competitions_insert_admin_editor" ON public."tbl_Competitions";
DROP POLICY IF EXISTS "tbl_Competitions_update_admin_editor" ON public."tbl_Competitions";
DROP POLICY IF EXISTS "tbl_Competitions_delete_admin_editor" ON public."tbl_Competitions";

CREATE POLICY "tbl_Competitions_select_admin_editor" ON public."tbl_Competitions" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Competitions_insert_admin_editor" ON public."tbl_Competitions" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Competitions_update_admin_editor" ON public."tbl_Competitions" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Competitions_delete_admin_editor" ON public."tbl_Competitions" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Countries
DROP POLICY IF EXISTS "tbl_Countries_select_admin_editor" ON public."tbl_Countries";
DROP POLICY IF EXISTS "tbl_Countries_insert_admin_editor" ON public."tbl_Countries";
DROP POLICY IF EXISTS "tbl_Countries_update_admin_editor" ON public."tbl_Countries";
DROP POLICY IF EXISTS "tbl_Countries_delete_admin_editor" ON public."tbl_Countries";

CREATE POLICY "tbl_Countries_select_admin_editor" ON public."tbl_Countries" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Countries_insert_admin_editor" ON public."tbl_Countries" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Countries_update_admin_editor" ON public."tbl_Countries" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Countries_delete_admin_editor" ON public."tbl_Countries" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Country_History
DROP POLICY IF EXISTS "tbl_Country_History_select_admin_editor" ON public."tbl_Country_History";
DROP POLICY IF EXISTS "tbl_Country_History_insert_admin_editor" ON public."tbl_Country_History";
DROP POLICY IF EXISTS "tbl_Country_History_update_admin_editor" ON public."tbl_Country_History";
DROP POLICY IF EXISTS "tbl_Country_History_delete_admin_editor" ON public."tbl_Country_History";

CREATE POLICY "tbl_Country_History_select_admin_editor" ON public."tbl_Country_History" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Country_History_insert_admin_editor" ON public."tbl_Country_History" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Country_History_update_admin_editor" ON public."tbl_Country_History" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Country_History_delete_admin_editor" ON public."tbl_Country_History" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Federations
DROP POLICY IF EXISTS "tbl_Federations_select_admin_editor" ON public."tbl_Federations";
DROP POLICY IF EXISTS "tbl_Federations_insert_admin_editor" ON public."tbl_Federations";
DROP POLICY IF EXISTS "tbl_Federations_update_admin_editor" ON public."tbl_Federations";
DROP POLICY IF EXISTS "tbl_Federations_delete_admin_editor" ON public."tbl_Federations";

CREATE POLICY "tbl_Federations_select_admin_editor" ON public."tbl_Federations" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Federations_insert_admin_editor" ON public."tbl_Federations" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Federations_update_admin_editor" ON public."tbl_Federations" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Federations_delete_admin_editor" ON public."tbl_Federations" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Match_Events
DROP POLICY IF EXISTS "tbl_Match_Events_select_admin_editor" ON public."tbl_Match_Events";
DROP POLICY IF EXISTS "tbl_Match_Events_insert_admin_editor" ON public."tbl_Match_Events";
DROP POLICY IF EXISTS "tbl_Match_Events_update_admin_editor" ON public."tbl_Match_Events";
DROP POLICY IF EXISTS "tbl_Match_Events_delete_admin_editor" ON public."tbl_Match_Events";

CREATE POLICY "tbl_Match_Events_select_admin_editor" ON public."tbl_Match_Events" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Events_insert_admin_editor" ON public."tbl_Match_Events" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Events_update_admin_editor" ON public."tbl_Match_Events" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Events_delete_admin_editor" ON public."tbl_Match_Events" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Match_Participants
DROP POLICY IF EXISTS "tbl_Match_Participants_select_admin_editor" ON public."tbl_Match_Participants";
DROP POLICY IF EXISTS "tbl_Match_Participants_insert_admin_editor" ON public."tbl_Match_Participants";
DROP POLICY IF EXISTS "tbl_Match_Participants_update_admin_editor" ON public."tbl_Match_Participants";
DROP POLICY IF EXISTS "tbl_Match_Participants_delete_admin_editor" ON public."tbl_Match_Participants";

CREATE POLICY "tbl_Match_Participants_select_admin_editor" ON public."tbl_Match_Participants" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Participants_insert_admin_editor" ON public."tbl_Match_Participants" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Participants_update_admin_editor" ON public."tbl_Match_Participants" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Match_Participants_delete_admin_editor" ON public."tbl_Match_Participants" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Matches
DROP POLICY IF EXISTS "tbl_Matches_select_admin_editor" ON public."tbl_Matches";
DROP POLICY IF EXISTS "tbl_Matches_insert_admin_editor" ON public."tbl_Matches";
DROP POLICY IF EXISTS "tbl_Matches_update_admin_editor" ON public."tbl_Matches";
DROP POLICY IF EXISTS "tbl_Matches_delete_admin_editor" ON public."tbl_Matches";

CREATE POLICY "tbl_Matches_select_admin_editor" ON public."tbl_Matches" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Matches_insert_admin_editor" ON public."tbl_Matches" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Matches_update_admin_editor" ON public."tbl_Matches" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Matches_delete_admin_editor" ON public."tbl_Matches" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_People
DROP POLICY IF EXISTS "tbl_People_select_admin_editor" ON public."tbl_People";
DROP POLICY IF EXISTS "tbl_People_insert_admin_editor" ON public."tbl_People";
DROP POLICY IF EXISTS "tbl_People_update_admin_editor" ON public."tbl_People";
DROP POLICY IF EXISTS "tbl_People_delete_admin_editor" ON public."tbl_People";

CREATE POLICY "tbl_People_select_admin_editor" ON public."tbl_People" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_People_insert_admin_editor" ON public."tbl_People" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_People_update_admin_editor" ON public."tbl_People" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_People_delete_admin_editor" ON public."tbl_People" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Person_Countries
DROP POLICY IF EXISTS "tbl_Person_Countries_select_admin_editor" ON public."tbl_Person_Countries";
DROP POLICY IF EXISTS "tbl_Person_Countries_insert_admin_editor" ON public."tbl_Person_Countries";
DROP POLICY IF EXISTS "tbl_Person_Countries_update_admin_editor" ON public."tbl_Person_Countries";
DROP POLICY IF EXISTS "tbl_Person_Countries_delete_admin_editor" ON public."tbl_Person_Countries";

CREATE POLICY "tbl_Person_Countries_select_admin_editor" ON public."tbl_Person_Countries" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Countries_insert_admin_editor" ON public."tbl_Person_Countries" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Countries_update_admin_editor" ON public."tbl_Person_Countries" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Countries_delete_admin_editor" ON public."tbl_Person_Countries" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Person_Team_Periods
DROP POLICY IF EXISTS "tbl_Person_Team_Periods_select_admin_editor" ON public."tbl_Person_Team_Periods";
DROP POLICY IF EXISTS "tbl_Person_Team_Periods_insert_admin_editor" ON public."tbl_Person_Team_Periods";
DROP POLICY IF EXISTS "tbl_Person_Team_Periods_update_admin_editor" ON public."tbl_Person_Team_Periods";
DROP POLICY IF EXISTS "tbl_Person_Team_Periods_delete_admin_editor" ON public."tbl_Person_Team_Periods";

CREATE POLICY "tbl_Person_Team_Periods_select_admin_editor" ON public."tbl_Person_Team_Periods" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Team_Periods_insert_admin_editor" ON public."tbl_Person_Team_Periods" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Team_Periods_update_admin_editor" ON public."tbl_Person_Team_Periods" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Person_Team_Periods_delete_admin_editor" ON public."tbl_Person_Team_Periods" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Stadiums
DROP POLICY IF EXISTS "tbl_Stadiums_select_admin_editor" ON public."tbl_Stadiums";
DROP POLICY IF EXISTS "tbl_Stadiums_insert_admin_editor" ON public."tbl_Stadiums";
DROP POLICY IF EXISTS "tbl_Stadiums_update_admin_editor" ON public."tbl_Stadiums";
DROP POLICY IF EXISTS "tbl_Stadiums_delete_admin_editor" ON public."tbl_Stadiums";

CREATE POLICY "tbl_Stadiums_select_admin_editor" ON public."tbl_Stadiums" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Stadiums_insert_admin_editor" ON public."tbl_Stadiums" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Stadiums_update_admin_editor" ON public."tbl_Stadiums" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Stadiums_delete_admin_editor" ON public."tbl_Stadiums" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Successions
DROP POLICY IF EXISTS "tbl_Successions_select_admin_editor" ON public."tbl_Successions";
DROP POLICY IF EXISTS "tbl_Successions_insert_admin_editor" ON public."tbl_Successions";
DROP POLICY IF EXISTS "tbl_Successions_update_admin_editor" ON public."tbl_Successions";
DROP POLICY IF EXISTS "tbl_Successions_delete_admin_editor" ON public."tbl_Successions";

CREATE POLICY "tbl_Successions_select_admin_editor" ON public."tbl_Successions" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Successions_insert_admin_editor" ON public."tbl_Successions" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Successions_update_admin_editor" ON public."tbl_Successions" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Successions_delete_admin_editor" ON public."tbl_Successions" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));

-- tbl_Teams
DROP POLICY IF EXISTS "tbl_Teams_select_admin_editor" ON public."tbl_Teams";
DROP POLICY IF EXISTS "tbl_Teams_insert_admin_editor" ON public."tbl_Teams";
DROP POLICY IF EXISTS "tbl_Teams_update_admin_editor" ON public."tbl_Teams";
DROP POLICY IF EXISTS "tbl_Teams_delete_admin_editor" ON public."tbl_Teams";

CREATE POLICY "tbl_Teams_select_admin_editor" ON public."tbl_Teams" FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Teams_insert_admin_editor" ON public."tbl_Teams" FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Teams_update_admin_editor" ON public."tbl_Teams" FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')))
WITH CHECK (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
CREATE POLICY "tbl_Teams_delete_admin_editor" ON public."tbl_Teams" FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public."tbl_User_Roles" ur WHERE ur."auth_user_id" = auth.uid() AND ur."is_active" = true AND ur."role" IN ('ADMIN', 'EDITOR')));
