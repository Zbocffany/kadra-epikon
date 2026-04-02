# Procedura: Import meczow Polski bez nazw stadionow

Cel: szybki i powtarzalny import meczow reprezentacji Polski, gdy nie mapujemy stadionow, a lokalizacja opiera sie o miasto.

## Kiedy stosowac

- Import danych historycznych z Wikipedii.
- Priorytet: mecz + druzyny + data + rozgrywki + miasto.
- Brak pelnych danych stadionowych lub brak potrzeby ich mapowania na tym etapie.

## Wejscie

1. Zakres lat (`--from-year`).
2. Aktualne aliasy krajow: `scripts/import_matches/mappings/country_aliases.json`.
3. Dostep do Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

## Przebieg operacyjny

1. Scraping i normalizacja:

```powershell
python scripts/import_matches/stage1_poland_matches.py run --from-year <ROK_OD> --dry-run
```

2. Analiza review:
- Rozdziel review na:
  - duplikaty (informacyjne, nie blokuja importu),
  - przypadki wymagajace interwencji (np. brak miasta, brak aliasu druzyny).

3. Interwencja reczna w bazie:
- Dodanie brakujacych miast i powiazan miasto-kraj.
- Dodanie brakujacych bytow panstw/druzyn i sukcesji (jesli dotyczy historycznych nazw).

4. Finalny import:

```powershell
python scripts/import_matches/stage1_poland_matches.py run --from-year <ROK_OD> --apply
```

5. Walidacja koncowa:
- Sprawdz `scripts/import_matches/output/import_report.json`.
- Potwierdz, ze actionable review (bez duplikatow) = 0.

## Kryterium zakonczenia etapu

- Wszystkie rekordy gotowe do importu zostaly wstawione.
- Brak pozycji blokujacych w review (po odfiltrowaniu duplikatow).
- Duplikaty moga pozostac w review jako informacja techniczna.

## Uwaga praktyczna

- W tym etapie nie wymagamy `match_stadium_id`; wystarcza poprawny `match_city_id`.
- W przypadku nazw historycznych (np. byty panstwowe) kluczowe sa poprawne sukcesje i aliasy krajow/druzyn.

## Skrypty uzyte w pierwszym imporcie

Skrypty docelowe (zostawione w repo):

- `scripts/import_matches/stage1_poland_matches.py`
  - glowny pipeline: fetch + normalize + import,
  - generuje `raw_matches.json`, `normalized_matches.csv`, `review_needed.csv`, `ready_to_import.csv`, `import_report.json`.
- `scripts/import_matches/mappings/country_aliases.json`
  - aliasy nazw panstw/druzyn zrodelowych -> nazwy encji w bazie.
- `scripts/import_matches/generate_missing_cities_sql_with_countries_v3.py`
  - generator SQL do dodania brakujacych miast i powiazan miasto-kraj.
- `scripts/import_matches/country_mapping_en_to_pl.py`
  - mapowanie angielskich nazw panstw (z venue) na nazwy polskie w DB.

Skrypty pomocnicze typu one-off z pierwszej iteracji (usuniete po cleanupie):

- `build_city_country_mapping.py`
- `build_city_country_sql.py`
- `extract_mappings.py`
- `generate_missing_cities_sql_with_countries.py`
- `generate_missing_cities_sql_with_countries_v2.py`

Status: byly tylko etapami przejsciowymi podczas debugowania i zostaly zastapione przez `generate_missing_cities_sql_with_countries_v3.py` oraz glowny pipeline.

## Problemy z pierwszego uruchomienia i rozwiazania

1. Problem: brak Pythona w PATH.
Rozwiazanie: uruchamianie przez jawna sciezke do interpretera (`C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe`).

2. Problem: brakujace zaleznosci (`requests`, `pandas`, `openpyxl`, `beautifulsoup4`, `lxml`).
Rozwiazanie: instalacja pakietow i utrwalenie zestawu w `scripts/import_matches/requirements.txt`.

3. Problem: rozjazd nazw kolumn/plikow wejscia (np. `city_name` vs `target_city_name`).
Rozwiazanie: aktualizacja generatora SQL pod realny format arkusza.

4. Problem: rozjazd nazw panstw EN -> PL (np. `Republic of Ireland`).
Rozwiazanie: uzupelnienie mapowan w aliasach i mapie EN->PL.

5. Problem: bledy SQL przez niezgodnosc schematu (`tbl_cities` vs `tbl_Cities`, `name` vs `city_name`).
Rozwiazanie: pelne cytowanie identyfikatorow i dopasowanie do rzeczywistych kolumn.

6. Problem: UUID traktowane jak liczby lub niejawnie.
Rozwiazanie: konsekwentne uzycie UUID (`gen_random_uuid()`, jawne casty `::uuid`).

7. Problem: uszkodzone polskie znaki w SQL/CSV.
Rozwiazanie: wymuszenie zapisu UTF-8.

8. Problem: aliasy miast z diakrytykami spoza PL (Reykjavik, Chisinau, Guimaraes) nie trafialy w mapowanie.
Rozwiazanie: kanonikalizacja Unicode (NFKD) i lookup po kluczu kanonicznym.

9. Problem: review zdominowane przez duplikaty, zaslaniajace realne braki.
Rozwiazanie: rozdzial review na duplikaty i actionable oraz finalna walidacja po filtrze.

10. Problem: historyczna nazwa druzyny (`Serbia i Czarnogora`) bez kompletnego lancucha sukcesji.
Rozwiazanie: dopiecie bytow/sukcesji w bazie + aliasow, nastepnie rerun importu.
