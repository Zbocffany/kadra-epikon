# Stage 1: Import listy meczow Polski

Szybki playbook procesu (wersja operacyjna):

- `scripts/import_matches/PROCEDURA_IMPORTU_MECZOW_POLSKI_BEZ_STADIONOW.md`
- `scripts/import_matches/PROCEDURA_IMPORTU_OSOB_Z_LINKU_MECZU_FLASHSCORE.md`

Ten katalog zawiera pierwszy etap importu danych meczowych:

- pobranie surowej listy meczow Polski z Wikipedii,
- normalizacje do formatu zgodnego z `tbl_Matches`,
- wydzielenie rekordow do review,
- opcjonalny import do Supabase bez eventow i bez skladow.

## Zakres etapu 1

Importer zapisuje tylko szkielet meczu:

- data meczu,
- godzina, jesli jest dostepna,
- gospodarz i gosc,
- rozgrywki,
- poziom rozgrywek, jesli da sie ustalic,
- status meczu,
- result type,
- surowe dane lokalizacyjne,
- opcjonalnie `match_city_id` / `match_stadium_id`, jesli uda sie je zmapowac w przyszlosci.

Nie tworzy:

- `tbl_Match_Events`,
- `tbl_Match_Participants`,
- ludzi,
- nowych encji przy niepewnym mapowaniu.

## Wymagane env

Skrypt korzysta z tych samych zmiennych co aplikacja serwerowa:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Najprosciej uruchamiac go w srodowisku, w ktorym masz juz skonfigurowane `.env.local`.

## Instalacja zaleznosci

Rekomendowane w osobnym virtualenv:

```powershell
cd C:\Vasco\Life\Kadra\kadra-epikon
python -m venv .venv
.venv\Scripts\activate
pip install -r scripts\import_matches\requirements.txt
```

## Typowy przebieg

Dry run dla XXI wieku:

```powershell
python scripts\import_matches\stage1_poland_matches.py run --from-year 2000 --dry-run
```

Sam fetch:

```powershell
python scripts\import_matches\stage1_poland_matches.py fetch --from-year 2000
```

Sama normalizacja:

```powershell
python scripts\import_matches\stage1_poland_matches.py normalize
```

Import do bazy na podstawie wygenerowanego `ready_to_import.csv`:

```powershell
python scripts\import_matches\stage1_poland_matches.py import --apply
```

## Pliki wyjsciowe

Wszystkie artefakty trafiaja do `scripts/import_matches/output/`:

- `raw_matches.json`
- `normalized_matches.csv`
- `review_needed.csv`
- `ready_to_import.csv`
- `import_report.json`

## Statusy po imporcie

- mecze zakonczone: `editorial_status = PARTIAL`
- mecze zaplanowane: `editorial_status = DRAFT`

To celowe: eventy i sklady beda uzupelniane w kolejnych etapach.

## Etap 2: sklady Flashscore (non-Poland)

Do ekstrakcji skladow (XI, rezerwowi, zmiany) z FSDS:

```powershell
python scripts\import_matches\stage2_flashscore_lineups.py --event-id 6uCu1S0k
```

Parametry opcjonalne:

- `--project-id` (domyslnie `3`)
- `--query-hash` (domyslnie `dlie2`)
- `--endpoint` (domyslnie `https://3.ds.lsapp.eu/pq_graphql`)

Artefakty trafiaja do `scripts/import_matches/output/`:

- `flashscore_lineups_<event_id>_raw.json`
- `flashscore_lineups_<event_id>_all_players.csv`
- `flashscore_lineups_<event_id>_non_poland_players.csv`
- `flashscore_lineups_<event_id>_summary.json`

## Ograniczenia wersji 1

- parser jest przygotowany pod strony wynikow Polski na Wikipedii z `Football_box_collapsible`,
- lokalizacja jest pobierana jako dane surowe, ale nie jest jeszcze automatycznie mapowana do encji,
- niepewne druzyny, rozgrywki i duplikaty trafiaja do review zamiast do automatycznego importu.