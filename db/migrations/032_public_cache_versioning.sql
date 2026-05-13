BEGIN;

CREATE TABLE IF NOT EXISTS "tbl_Public_Cache_Version" (
  "cache_key" text PRIMARY KEY,
  "version" bigint NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "tbl_Public_Cache_Version" ("cache_key", "version")
VALUES ('global', 1)
ON CONFLICT ("cache_key") DO NOTHING;

CREATE OR REPLACE FUNCTION public.bump_public_cache_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO "tbl_Public_Cache_Version" ("cache_key", "version", "updated_at")
  VALUES ('global', 1, now())
  ON CONFLICT ("cache_key") DO UPDATE
    SET "version" = "tbl_Public_Cache_Version"."version" + 1,
        "updated_at" = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_public_cache_version_clubs" ON "tbl_Clubs";
CREATE TRIGGER "trg_public_cache_version_clubs"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Clubs"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_teams" ON "tbl_Teams";
CREATE TRIGGER "trg_public_cache_version_teams"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Teams"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_people" ON "tbl_People";
CREATE TRIGGER "trg_public_cache_version_people"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_People"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_person_countries" ON "tbl_Person_Countries";
CREATE TRIGGER "trg_public_cache_version_person_countries"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Person_Countries"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_person_team_periods" ON "tbl_Person_Team_Periods";
CREATE TRIGGER "trg_public_cache_version_person_team_periods"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Person_Team_Periods"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_cities" ON "tbl_Cities";
CREATE TRIGGER "trg_public_cache_version_cities"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Cities"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_city_country_periods" ON "tbl_City_Country_Periods";
CREATE TRIGGER "trg_public_cache_version_city_country_periods"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_City_Country_Periods"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_countries" ON "tbl_Countries";
CREATE TRIGGER "trg_public_cache_version_countries"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Countries"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_stadiums" ON "tbl_Stadiums";
CREATE TRIGGER "trg_public_cache_version_stadiums"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Stadiums"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_matches" ON "tbl_Matches";
CREATE TRIGGER "trg_public_cache_version_matches"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Matches"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_match_participants" ON "tbl_Match_Participants";
CREATE TRIGGER "trg_public_cache_version_match_participants"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Match_Participants"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_match_events" ON "tbl_Match_Events";
CREATE TRIGGER "trg_public_cache_version_match_events"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Match_Events"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_club_history" ON "tbl_Club_History";
CREATE TRIGGER "trg_public_cache_version_club_history"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Club_History"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

DROP TRIGGER IF EXISTS "trg_public_cache_version_federations" ON "tbl_Federations";
CREATE TRIGGER "trg_public_cache_version_federations"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_Federations"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();

COMMIT;