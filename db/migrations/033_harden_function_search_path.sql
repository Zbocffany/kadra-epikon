-- Hardening: ustaw stabilny search_path dla funkcji triggerów,
-- żeby uniknąć warningów Supabase Security Advisor (Function Search Path Mutable).
-- Nie zmienia logiki — tylko dodaje SET search_path.

BEGIN;

ALTER FUNCTION public.bump_public_cache_version() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_tbl_countries_create_team() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_tbl_clubs_create_team() SET search_path = public, pg_temp;

COMMIT;
