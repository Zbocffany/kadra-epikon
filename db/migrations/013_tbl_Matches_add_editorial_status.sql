-- 013_tbl_Matches_add_editorial_status.sql
--
-- GOAL: Add editorial workflow status to tbl_Matches.
--
-- DESIGN NOTES:
--   Sporting status  → match_status (existing): ZAPLANOWANY / ZAKONCZONY / PRZERWANY / ANULOWANY
--   Editorial status → editorial_status (new):  DRAFT / PARTIAL / COMPLETE / VERIFIED
--
--   These two dimensions are independent.  A match can be ZAKONCZONY (sports) while
--   still being DRAFT (editorial), e.g. the result is known but events are not yet entered.
--
--   Score is NOT stored on tbl_Matches; it is always derived by aggregating tbl_Match_Events.
--
-- EDITORIAL STATUS SEMANTICS:
--   DRAFT    – Record created; no or minimal editorial work done.
--              A match may (and often does) exist at this stage without any tbl_Match_Events.
--   PARTIAL  – Editorial work in progress.  Some events or participants entered but incomplete.
--   COMPLETE – The responsible editor considers all known data entered and ready for review.
--   VERIFIED – A senior editor / data steward has reviewed and approved the record.
--              Constraint: only reachable when match_status != 'ZAPLANOWANY'
--              (cannot fully verify a planned/future match's sporting data).
--
-- BUSINESS RULE ENFORCED BY CHECK CONSTRAINT:
--   editorial_status = 'VERIFIED'  →  match_status IN ('ZAKONCZONY','PRZERWANY','ANULOWANY')


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Create enum type
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'editorial_status_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.editorial_status_enum AS ENUM (
      'DRAFT',
      'PARTIAL',
      'COMPLETE',
      'VERIFIED'
    );
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Add column (nullable first so existing rows are valid during migration)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public."tbl_Matches"
  ADD COLUMN IF NOT EXISTS editorial_status public.editorial_status_enum NULL;

ALTER TABLE public."tbl_Matches"
  ADD COLUMN IF NOT EXISTS editorial_notes text NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Backfill all existing rows to DRAFT before enforcing NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public."tbl_Matches"
SET editorial_status = 'DRAFT'::public.editorial_status_enum
WHERE editorial_status IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Enforce NOT NULL now that all rows have a value
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public."tbl_Matches"
  ALTER COLUMN editorial_status SET NOT NULL;

ALTER TABLE public."tbl_Matches"
  ALTER COLUMN editorial_status SET DEFAULT 'DRAFT'::public.editorial_status_enum;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Business rule: VERIFIED requires a concluded match_status
--    (ZAPLANOWANY matches cannot be fully verified editorially)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_tbl_Matches_verified_requires_concluded_status'
  ) THEN
    ALTER TABLE public."tbl_Matches"
      ADD CONSTRAINT "chk_tbl_Matches_verified_requires_concluded_status"
      CHECK (
        editorial_status <> 'VERIFIED'::public.editorial_status_enum
        OR match_status IN (
          'ZAKONCZONY'::match_status_enum,
          'PRZERWANY'::match_status_enum,
          'ANULOWANY'::match_status_enum
        )
      );
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Update table comment to document the new column
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public."tbl_Matches".editorial_status IS
'Editorial workflow status — distinct from sporting match_status.

Values (editorial_status_enum):
  DRAFT    – Record exists, no or minimal editorial work done.
             A match at this stage may have no tbl_Match_Events rows.
  PARTIAL  – Editorial work in progress; some data entered but incomplete.
  COMPLETE – Editor considers all known data entered; ready for review.
  VERIFIED – Senior editor has reviewed and approved the record.

Constraint: VERIFIED is only allowed when match_status is
ZAKONCZONY, PRZERWANY, or ANULOWANY (not ZAPLANOWANY).

Score is never stored here; derive it by aggregating tbl_Match_Events.';

COMMENT ON COLUMN public."tbl_Matches".editorial_notes IS
'Free-text notes for editors, e.g. missing sources, data quality flags,
or instructions for the verifier.  Nullable.';
