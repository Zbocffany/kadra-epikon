# Procedura: import osob z linku meczu Flashscore (bez importu skladu meczu)

To jest docelowy workflow operacyjny na teraz:

1. Uzytkownik wkleja link do meczu Flashscore.
2. Asystent zwraca Excel z zawodnikami spoza Polski do uzupelnienia polskich nazw miast urodzenia.
3. Uzytkownik uzupelnia kolumne `birth_place_custom` i zapisuje plik.
4. Asystent robi reszte: import osob + uzupelnienie krajow.

Zakres tej procedury:

- TAK: `tbl_People` + `birth_country_id` + `tbl_Person_Countries`.
- NIE: `tbl_Match_Participants` (import skladu meczu robimy pozniej osobna procedura).

## Wymagania

- Ustawione env:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Python 3.12 (w tym repo uzywany interpreter:
  `C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe`)
- Pakiety z `scripts/import_matches/requirements.txt` oraz:
  - `openpyxl`
  - `beautifulsoup4`
  - `lxml`

## Krok 0: Wejscie od uzytkownika

Uzytkownik podaje link do meczu Flashscore.

Przyklad:
`https://www.flashscore.com/match/6uCu1S0k/`

Klucz do dalszych krokow to `event_id` (tu: `6uCu1S0k`).

## Krok 1: Pobranie skladow z FSDS (surowe + CSV)

Uruchom:

```powershell
cd C:\Vasco\Life\Kadra\kadra-epikon\scripts\import_matches
& "C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe" stage2_flashscore_lineups.py --event-id <EVENT_ID>
```

Powstaja pliki w `scripts/import_matches/output/`:

- `flashscore_lineups_<EVENT_ID>_raw.json`
- `flashscore_lineups_<EVENT_ID>_all_players.csv`
- `flashscore_lineups_<EVENT_ID>_non_poland_players.csv`
- `flashscore_lineups_<EVENT_ID>_summary.json`

## Krok 2: Wzbogacenie danych osob i wygenerowanie Excela

Uruchom:

```powershell
& "C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe" stage2_enrich_non_poland_players.py ^
  --input-csv output\flashscore_lineups_<EVENT_ID>_non_poland_players.csv ^
  --output-csv output\flashscore_lineups_<EVENT_ID>_non_poland_players_enriched.csv ^
  --output-xlsx output\flashscore_lineups_<EVENT_ID>_non_poland_players_enriched.xlsx
```

Wynikowy Excel ma kolumny m.in.:

- `full_name`
- `first_name`
- `birth_date`
- `birth_place`
- `birth_place_custom` (do uzupelnienia recznie)

To ten plik wysylamy uzytkownikowi do uzupelnienia.

## Krok 3: Uzytkownik uzupelnia `birth_place_custom`

Zasada:

- Wpisuje polska nazwe miasta z bazy (lub docelowa nazwe, ktora ma byc w bazie).
- Kazdy zawodnik powinien miec uzupelnione `birth_place_custom`.

Jesli jakiegos miasta nie ma jeszcze w `tbl_Cities`, najpierw trzeba je dodac (i podpiac do kraju w `tbl_City_Country_Periods`).

## Krok 4: Import osob do `tbl_People`

Uruchom import:

```powershell
& "C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe" stage3_import_people.py --input-xlsx output\flashscore_lineups_<EVENT_ID>_non_poland_players_enriched.xlsx
```

Co robi skrypt `stage3_import_people.py`:

- mapuje `full_name` -> `first_name`, `last_name`,
- bierze `birth_date`,
- mapuje `birth_place_custom` -> `birth_city_id` (po `tbl_Cities`),
- inseruje brakujace osoby do `tbl_People`,
- nie duplikuje juz istniejacych (deduplikacja po imie, nazwisku, dacie ur.).

Uwaga: ten krok sam nie uzupelnia jeszcze `birth_country_id` ani `tbl_Person_Countries`.

## Krok 5: Finalizacja metadanych osob (kraj urodzenia + reprezentowany kraj)

Uruchom finalizacje:

```powershell
& "C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe" stage3_finalize_people_metadata.py ^
  --input-xlsx output\flashscore_lineups_<EVENT_ID>_non_poland_players_enriched.xlsx ^
  --represented-country-name Finlandia
```

Co robi skrypt `stage3_finalize_people_metadata.py`:

1. Uzupelnia `tbl_People.birth_country_id` na podstawie:
   - `birth_city_id`
   - `birth_date`
   - `tbl_City_Country_Periods` (okres obowiazywania kraju dla miasta).
2. Dodaje wpisy do `tbl_Person_Countries` (`person_id`, `country_id`) dla kraju reprezentowanego w danym meczu.

Dzieki temu w formularzu osoby pole "Reprezentowane kraje" jest uzupelnione.

## Krok 6: Kontrola po imporcie

Sprawdz idempotencje:

```powershell
& "C:\Users\tomas\AppData\Local\Programs\Python\Python312\python.exe" stage3_finalize_people_metadata.py --input-xlsx output\flashscore_lineups_<EVENT_ID>_non_poland_players_enriched.xlsx --represented-country-name Finlandia --dry-run
```

Oczekiwany wynik po poprawnym imporcie:

- `birth_country_id do aktualizacji: 0`
- `Linki tbl_Person_Countries do dodania: 0`

## Szybki checklista operacyjna

1. Dostaje link do meczu -> wyciagam `EVENT_ID`.
2. Uruchamiam `stage2_flashscore_lineups.py`.
3. Uruchamiam `stage2_enrich_non_poland_players.py` i oddaje Excel.
4. Uzytkownik uzupelnia `birth_place_custom`.
5. Uruchamiam `stage3_import_people.py`.
6. Uruchamiam `stage3_finalize_people_metadata.py`.
7. Potwierdzam dry-runem, ze nic juz nie zostalo.

## Co dalej (poza ta procedura)

Osobna, przyszla procedura:

- import skladu meczu do `tbl_Match_Participants`.

Nie jest czescia tego dokumentu.
