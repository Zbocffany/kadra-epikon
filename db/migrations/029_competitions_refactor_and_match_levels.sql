-- 029_competitions_refactor_and_match_levels.sql
--
-- Goal:
-- 1) Keep only target competition names in tbl_Competitions:
--    - Liga Narodow
--    - Nieoficjalny
--    - Mistrzostwa Swiata
--    - Mistrzostwa Europy
--    - Towarzyski
-- 2) Add table with competition/match levels (phases).
-- 3) Add nullable FK column in tbl_Matches for level.
-- 4) Migrate existing match links from legacy competition names safely (no data loss).

-- 1) New table: levels / phases of competition
CREATE TABLE IF NOT EXISTS public."tbl_Match_Levels" (
  "id" uuid PRIMARY KEY,
  "name" text UNIQUE
);

INSERT INTO public."tbl_Match_Levels" (id, name)
VALUES
  (gen_random_uuid(), 'Eliminacje'),
  (gen_random_uuid(), 'Baraż'),
  (gen_random_uuid(), 'Faza grupowa'),
  (gen_random_uuid(), '2. faza grupowa'),
  (gen_random_uuid(), '1/16 finału'),
  (gen_random_uuid(), '1/8 finału'),
  (gen_random_uuid(), 'Ćwierćfinał'),
  (gen_random_uuid(), 'Półfinał'),
  (gen_random_uuid(), 'Finał')
ON CONFLICT (name) DO NOTHING;

-- 2) Add nullable FK column to matches
ALTER TABLE public."tbl_Matches"
  ADD COLUMN IF NOT EXISTS "match_level_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tbl_Matches_match_level_id'
      AND conrelid = 'public."tbl_Matches"'::regclass
  ) THEN
    ALTER TABLE public."tbl_Matches"
      ADD CONSTRAINT "fk_tbl_Matches_match_level_id"
      FOREIGN KEY ("match_level_id") REFERENCES public."tbl_Match_Levels" ("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_tbl_Matches_match_level_id"
  ON public."tbl_Matches" ("match_level_id");

-- 3) Ensure canonical competition names exist
INSERT INTO public."tbl_Competitions" (id, name)
VALUES
  (gen_random_uuid(), 'Liga Narodów'),
  (gen_random_uuid(), 'Nieoficjalny'),
  (gen_random_uuid(), 'Mistrzostwa Świata'),
  (gen_random_uuid(), 'Mistrzostwa Europy'),
  (gen_random_uuid(), 'Towarzyski')
ON CONFLICT (name) DO NOTHING;

-- 4) Migrate matches from legacy competition names to canonical competitions + levels
-- Legacy mapping:
-- - LN -> Liga Narodów
-- - MŚ -> Mistrzostwa Świata
-- - ME -> Mistrzostwa Europy
-- - El. MŚ -> Mistrzostwa Świata + Eliminacje
-- - Baraż MŚ -> Mistrzostwa Świata + Baraż
-- - El. ME -> Mistrzostwa Europy + Eliminacje
-- - Baraż ME -> Mistrzostwa Europy + Baraż
UPDATE public."tbl_Matches" m
SET
  "competition_id" = target_comp.id,
  "match_level_id" = target_level.id
FROM public."tbl_Competitions" old_comp
JOIN public."tbl_Competitions" target_comp
  ON target_comp.name = CASE old_comp.name
    WHEN 'LN' THEN 'Liga Narodów'
    WHEN 'MŚ' THEN 'Mistrzostwa Świata'
    WHEN 'ME' THEN 'Mistrzostwa Europy'
    WHEN 'El. MŚ' THEN 'Mistrzostwa Świata'
    WHEN 'Baraż MŚ' THEN 'Mistrzostwa Świata'
    WHEN 'El. ME' THEN 'Mistrzostwa Europy'
    WHEN 'Baraż ME' THEN 'Mistrzostwa Europy'
    ELSE old_comp.name
  END
LEFT JOIN public."tbl_Match_Levels" target_level
  ON target_level.name = CASE old_comp.name
    WHEN 'El. MŚ' THEN 'Eliminacje'
    WHEN 'Baraż MŚ' THEN 'Baraż'
    WHEN 'El. ME' THEN 'Eliminacje'
    WHEN 'Baraż ME' THEN 'Baraż'
    ELSE NULL
  END
WHERE m."competition_id" = old_comp.id
  AND old_comp.name IN ('LN', 'MŚ', 'ME', 'El. MŚ', 'Baraż MŚ', 'El. ME', 'Baraż ME');

-- 5) Remove obsolete competition rows (safe after remap)
DELETE FROM public."tbl_Competitions" c
WHERE c.name IN ('LN', 'MŚ', 'ME', 'El. MŚ', 'Baraż MŚ', 'El. ME', 'Baraż ME')
  AND NOT EXISTS (
    SELECT 1
    FROM public."tbl_Matches" m
    WHERE m."competition_id" = c.id
  );

-- 6) Optional safety: detect leftover non-target competitions still referenced by matches
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."tbl_Matches" m
    JOIN public."tbl_Competitions" c ON c.id = m."competition_id"
    WHERE c.name NOT IN (
      'Liga Narodów',
      'Nieoficjalny',
      'Mistrzostwa Świata',
      'Mistrzostwa Europy',
      'Towarzyski'
    )
  ) THEN
    RAISE EXCEPTION 'Migration 029: Found matches referencing non-target competitions. Complete manual remap first.';
  END IF;
END $$;

-- 7) RLS for new table (align with migration 028 approach)
ALTER TABLE public."tbl_Match_Levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tbl_Match_Levels" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tbl_Match_Levels_select_admin_editor" ON public."tbl_Match_Levels";
DROP POLICY IF EXISTS "tbl_Match_Levels_insert_admin_editor" ON public."tbl_Match_Levels";
DROP POLICY IF EXISTS "tbl_Match_Levels_update_admin_editor" ON public."tbl_Match_Levels";
DROP POLICY IF EXISTS "tbl_Match_Levels_delete_admin_editor" ON public."tbl_Match_Levels";

CREATE POLICY "tbl_Match_Levels_select_admin_editor" ON public."tbl_Match_Levels" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."tbl_User_Roles" ur
    WHERE ur."auth_user_id" = auth.uid()
      AND ur."is_active" = true
      AND ur."role" IN ('ADMIN', 'EDITOR')
  )
);

CREATE POLICY "tbl_Match_Levels_insert_admin_editor" ON public."tbl_Match_Levels" FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."tbl_User_Roles" ur
    WHERE ur."auth_user_id" = auth.uid()
      AND ur."is_active" = true
      AND ur."role" IN ('ADMIN', 'EDITOR')
  )
);

CREATE POLICY "tbl_Match_Levels_update_admin_editor" ON public."tbl_Match_Levels" FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."tbl_User_Roles" ur
    WHERE ur."auth_user_id" = auth.uid()
      AND ur."is_active" = true
      AND ur."role" IN ('ADMIN', 'EDITOR')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public."tbl_User_Roles" ur
    WHERE ur."auth_user_id" = auth.uid()
      AND ur."is_active" = true
      AND ur."role" IN ('ADMIN', 'EDITOR')
  )
);

CREATE POLICY "tbl_Match_Levels_delete_admin_editor" ON public."tbl_Match_Levels" FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."tbl_User_Roles" ur
    WHERE ur."auth_user_id" = auth.uid()
      AND ur."is_active" = true
      AND ur."role" IN ('ADMIN', 'EDITOR')
  )
);
