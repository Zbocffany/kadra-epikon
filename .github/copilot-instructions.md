# Konwencje projektu kadra-epikon

Te zasady obowiązują przy każdej zmianie w warstwie danych i akcjach admina.
Naruszenie powoduje, że publiczne widoki "starzeją się" i wymagają ręcznego F5.

## 1) Każda publiczna funkcja danych w `lib/db/*` musi:

- Pobrać klucz przez `getPublicCacheKey('public-<domena>', ...optionalParts)`
  z `lib/db/publicCache.ts`.
- Być opakowana w `unstable_cache(fn, key, { revalidate: 3600, tags: [...] })`.
- Mieć tag bazowy `public-<domena>` (np. `public-people`, `public-matches`,
  `public-clubs`) i opcjonalne tagi szczegółowe `public-<domena>:<id>`.

Wzorzec referencyjny: funkcja `getPublicPeople()` w `lib/db/people.ts`.

## 2) Każda admin action po mutacji musi:

- Wywołać `revalidateTag('public-<domena>', 'max')` — w Next 16 drugi
  argument (`CacheLife` profile) jest WYMAGANY przez sygnaturę typu.
  Standardowy profil dla danych admina = `'max'`.
- Wywołać `revalidatePath(...)` dla swoich admin URL i powiązanych publicznych URL.
- Wywołać `invalidatePublicCacheVersion()` z `lib/db/publicCache.ts` —
  eliminuje 1s okno staleness w pamięci procesu (lokalny cache wersji).

## 3) Każda nowa tabela domenowa = trigger `bump_public_cache_version`
   w tej samej migracji, co `CREATE TABLE`. Wzorzec:

```sql
DROP TRIGGER IF EXISTS "trg_public_cache_version_<table>" ON "tbl_<Table>";
CREATE TRIGGER "trg_public_cache_version_<table>"
AFTER INSERT OR UPDATE OR DELETE ON "tbl_<Table>"
FOR EACH STATEMENT
EXECUTE FUNCTION public.bump_public_cache_version();
```

## 4) Indeksy tworzone razem z funkcjami zapytań

Każda kolumna używana w `where`/`join`/`order by` na zapytaniu publicznym
dostaje indeks w tej samej migracji co nowa funkcja danych.
Konwencja nazw: `idx_<table>_<col1>_<col2>`.

## 5) Filtry frontendowe = query string (URL)

Nowe filtry wystawiać jako parametry query (`?coachMode=rivals&competition=...`).
Zysk: cache działa per kombinacja, Wstecz/Naprzód działa, mobilka dostaje to samo API.

## 6) `dynamic = 'force-dynamic'` tylko w adminie

Publiczne strony używają zwykłego SSR z cache po stronie `lib/db/*`.

## Checklista przy dodawaniu nowej publicznej funkcji danych

- [ ] Funkcja w `lib/db/<domena>.ts` opakowana w `unstable_cache` +
      `getPublicCacheKey` + tag.
- [ ] Indeksy na kolumnach używanych w nowym zapytaniu (migracja w `db/migrations/`).
- [ ] Jeśli funkcja czyta z nowej tabeli → trigger `bump_public_cache_version`.
- [ ] Filtry frontendowe = query string.
- [ ] Powiązane admin actions wywołują `revalidateTag` + `revalidatePath` +
      `invalidatePublicCacheVersion()`.

## Roadmapa optymalizacji (orientacyjnie, zaktualizować po każdym etapie)

- Etap 0 + 1: cache invalidation pełny + bazowe indeksy — DONE w migracji 034 i 035.
- Etap 2: pomocnicze kolumny w `tbl_Matches` aktualizowane triggerem.
- Etap 3: RPC w bazie zamiast klejenia zapytań w TS, filtry w URL.
- Etap 4: tabele agregacyjne — dopiero po zamrożeniu modelu i filtrów.
- Etap 5: granularny cache (wersje per domena) — gdy ruch realnie wzrośnie.
