BEGIN;

-- Uzupełnienie triggerów bump_public_cache_version dla pozostałych tabel,
-- które wpływają na publiczne widoki (lib/db/countries.ts, lib/db/matches.ts,
-- lib/db/people.ts: filtry coach/competitions/levels). Bez tego mutacje na
-- tych tabelach nie zwiększają wersji cache i publiczna strona pokazuje
-- przeterminowane dane do końca okna `revalidate`.

DROP TRIGGER IF EXISTS "trg_public_cache_version_competitions" ON "tbl_Competitions";
CREATE TRIGGER "trg_public_cache_version_competitions"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Competitions"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_match_levels" ON "tbl_Match_Levels";
CREATE TRIGGER "trg_public_cache_version_match_levels"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Match_Levels"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_successions" ON "tbl_Successions";
CREATE TRIGGER "trg_public_cache_version_successions"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Successions"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_country_history" ON "tbl_Country_History";
CREATE TRIGGER "trg_public_cache_version_country_history"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Country_History"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

COMMIT;
