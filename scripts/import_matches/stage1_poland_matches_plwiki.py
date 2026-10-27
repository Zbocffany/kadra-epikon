"""Stage 1 (PL Wikipedia): import official Poland matches 1921–2000 into tbl_Matches.

Source: pl.wikipedia "Lista meczów reprezentacji Polski w piłce nożnej mężczyzn (1921–2000)".
Rules:
- rows whose Lp. starts with "N" (unofficial per PZPN) are skipped,
- no new cities/teams/competitions are created; unresolved rows go to review,
- scores are NOT written: tbl_Matches goal columns are derived from tbl_Match_Events by trigger.

Usage:
  python scripts/import_matches/stage1_poland_matches_plwiki.py --from-year 1991 --to-year 2000            # dry run
  python scripts/import_matches/stage1_poland_matches_plwiki.py --from-year 1991 --to-year 2000 --apply    # insert
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
OUTPUT_DIR = BASE_DIR / 'output'
ENV_FILE = REPO_ROOT / '.env.local'

SOURCE_URL = 'https://pl.wikipedia.org/wiki/Lista_mecz%C3%B3w_reprezentacji_Polski_w_pi%C5%82ce_no%C5%BCnej_m%C4%99%C5%BCczyzn_(1921%E2%80%932000)'
HEADERS = {'User-Agent': 'kadra-epikon-stage1-plwiki-import/0.1 (+https://kadra-epikon.vercel.app)'}
PAGE_SIZE = 1000

# Wikipedia team label -> tbl_Countries.name (only where they differ).
TEAM_ALIASES: dict[str, str] = {}

# Wikipedia city label -> tbl_Cities.city_name (only where they differ).
CITY_ALIASES: dict[str, str] = {
    'Pietarsaari': 'Jakobstad',
    'Derynia': 'Derinia',
}

COMPETITION_CODES: dict[str, tuple[str, str | None]] = {
    'eMŚ': ('Mistrzostwa Świata', 'Eliminacje'),
    'eME': ('Mistrzostwa Europy', 'Eliminacje'),
    'MŚ': ('Mistrzostwa Świata', None),
    'ME': ('Mistrzostwa Europy', None),
}
NON_COMPETITION_CODES = {'NF', 'OF'}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        match = re.match(r'^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$', line)
        if not match:
            continue
        value = match.group(2)
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = value[1:-1]
        os.environ.setdefault(match.group(1), value)


def canonicalize(value: str) -> str:
    text = unicodedata.normalize('NFKD', value or '')
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace('ł', 'l').replace('Ł', 'L').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', text)).strip()


def cell_text(cell: Tag) -> str:
    for sup in cell.find_all('sup'):
        sup.decompose()
    return re.sub(r'\s+', ' ', cell.get_text(' ', strip=True)).strip()


class SupabaseRest:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip('/') + '/rest/v1'
        self.headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

    def select_all(self, table: str, select: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        start = 0
        while True:
            response = requests.get(
                f'{self.base}/{quote(table)}',
                params={'select': select, 'order': 'id'},
                headers={**self.headers, 'Range-Unit': 'items', 'Range': f'{start}-{start + PAGE_SIZE - 1}'},
                timeout=60,
            )
            response.raise_for_status()
            batch = response.json()
            rows.extend(batch)
            if len(batch) < PAGE_SIZE:
                return rows
            start += PAGE_SIZE

    def insert(self, table: str, rows: list[dict[str, Any]]) -> None:
        response = requests.post(
            f'{self.base}/{quote(table)}',
            headers={**self.headers, 'Prefer': 'return=minimal'},
            json=rows,
            timeout=60,
        )
        if response.status_code >= 400:
            raise RuntimeError(f'Insert {table} failed: {response.status_code} {response.text}')


def fetch_rows(from_year: int, to_year: int) -> list[dict[str, Any]]:
    html = requests.get(SOURCE_URL, headers=HEADERS, timeout=60).text
    soup = BeautifulSoup(html, 'lxml')
    out: list[dict[str, Any]] = []

    for table in soup.select('table.wikitable'):
        year: int | None = None
        for tr in table.find_all('tr'):
            cells = tr.find_all(['td', 'th'])
            if len(cells) == 1:
                match = re.search(r'\b(19\d{2}|20\d{2})\b', cell_text(cells[0]))
                if match:
                    year = int(match.group(1))
                continue
            if len(cells) < 7 or year is None or not (from_year <= year <= to_year):
                continue

            texts = [cell_text(c) for c in cells]
            lp = texts[0]
            if lp == 'Lp.':
                continue
            out.append({
                'lp': lp,
                'year': year,
                'date_raw': texts[1],
                'place_raw': texts[2],
                'home_raw': texts[3],
                'away_raw': texts[5],
                'score_raw': texts[6],
                'notes_raw': texts[7] if len(texts) > 7 else '',
            })
    return out


def parse_place(place_raw: str) -> tuple[str, str | None, bool]:
    neutral = place_raw.startswith('*')
    text = place_raw.lstrip('*').strip()
    country = None
    match = re.match(r'^(.*?)\s*\(([^)]+)\)\s*$', text)
    if match:
        text, country = match.group(1).strip(), match.group(2).strip()
    return text, country, neutral


def parse_competition(notes_raw: str) -> tuple[str, str | None, list[str]]:
    tokens = [token.strip() for token in notes_raw.split(',')]
    codes = []
    for token in tokens:
        if token in COMPETITION_CODES or token in NON_COMPETITION_CODES:
            codes.append(token)
        else:
            break
    for code in codes:
        if code in COMPETITION_CODES:
            name, level = COMPETITION_CODES[code]
            return name, level, codes
    return 'Towarzyski', None, codes


def parse_result_type(score_raw: str, notes_raw: str) -> str:
    # Penalty info sometimes sits in the notes column instead of the score (e.g. "k. 5:4").
    lowered = f'{score_raw} {notes_raw}'.lower()
    has_pens = bool(re.search(r'\bk\.', lowered))
    has_et = 'pd' in lowered or 'dogr' in lowered
    if 'walk' in lowered or 'v.o' in lowered or 'vo' == lowered.strip():
        return 'WALKOVER'
    if has_et and has_pens:
        return 'EXTRA_TIME_AND_PENALTIES'
    if has_pens:
        return 'PENALTIES'
    if has_et:
        return 'EXTRA_TIME'
    return 'REGULAR_TIME'


def build_snapshot(client: SupabaseRest) -> dict[str, Any]:
    countries = client.select_all('tbl_Countries', 'id,name')
    teams = client.select_all('tbl_Teams', 'id,country_id,club_id')
    cities = client.select_all('tbl_Cities', 'id,city_name,current_country_id')
    competitions = client.select_all('tbl_Competitions', 'id,name')
    levels = client.select_all('tbl_Match_Levels', 'id,name')
    matches = client.select_all('tbl_Matches', 'id,match_date,home_team_id,away_team_id')

    country_by_canon = {canonicalize(c['name']): c for c in countries if c.get('name')}
    team_by_country = {t['country_id']: t for t in teams if t.get('club_id') is None and t.get('country_id')}
    cities_by_canon: dict[str, list[dict[str, Any]]] = {}
    for city in cities:
        if city.get('city_name'):
            cities_by_canon.setdefault(canonicalize(city['city_name']), []).append(city)

    return {
        'country_by_canon': country_by_canon,
        'team_by_country': team_by_country,
        'cities_by_canon': cities_by_canon,
        'competition_by_name': {c['name']: c['id'] for c in competitions},
        'level_by_name': {l['name']: l['id'] for l in levels},
        'existing': {(m['match_date'], m['home_team_id'], m['away_team_id']): m['id'] for m in matches},
        'counts': {'countries': len(countries), 'cities': len(cities), 'matches': len(matches)},
    }


def resolve_team(raw: str, snap: dict[str, Any]) -> tuple[str | None, str | None]:
    name = TEAM_ALIASES.get(raw, raw)
    country = snap['country_by_canon'].get(canonicalize(name))
    if not country:
        return None, None
    team = snap['team_by_country'].get(country['id'])
    return (team['id'] if team else None), country['id']


def resolve_city(city_raw: str, expected_country_id: str | None, snap: dict[str, Any]) -> tuple[str | None, str]:
    candidates = snap['cities_by_canon'].get(canonicalize(CITY_ALIASES.get(city_raw, city_raw)), [])
    if not candidates:
        return None, 'BRAK_W_BAZIE'
    if len(candidates) == 1:
        return candidates[0]['id'], 'OK'
    same_country = [c for c in candidates if expected_country_id and c.get('current_country_id') == expected_country_id]
    if len(same_country) == 1:
        return same_country[0]['id'], 'OK'
    return None, f'NIEJEDNOZNACZNE({len(candidates)})'


def normalize(rows: list[dict[str, Any]], snap: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    ready, review, skipped = [], [], []
    for row in rows:
        if row['lp'].upper().startswith('N'):
            skipped.append(row)
            continue

        notes: list[str] = []
        date_match = re.match(r'^(\d{1,2})\.(\d{1,2})$', row['date_raw'])
        match_date = f"{row['year']}-{int(date_match.group(2)):02d}-{int(date_match.group(1)):02d}" if date_match else None
        if not match_date:
            notes.append(f"Data: {row['date_raw']}")

        home_id, home_country = resolve_team(row['home_raw'], snap)
        away_id, away_country = resolve_team(row['away_raw'], snap)
        if not home_id:
            notes.append(f"Drużyna: {row['home_raw']}")
        if not away_id:
            notes.append(f"Drużyna: {row['away_raw']}")

        comp_name, level_name, codes = parse_competition(row['notes_raw'])
        competition_id = snap['competition_by_name'].get(comp_name)
        level_id = snap['level_by_name'].get(level_name) if level_name else None
        if not competition_id:
            notes.append(f'Rozgrywki: {comp_name}')
        if level_name and not level_id:
            notes.append(f'Poziom: {level_name}')

        city_raw, venue_country_raw, neutral = parse_place(row['place_raw'])
        expected_country = None
        if venue_country_raw:
            venue_country = snap['country_by_canon'].get(canonicalize(venue_country_raw))
            expected_country = venue_country['id'] if venue_country else None
        elif not neutral:
            expected_country = home_country
        city_id, city_status = resolve_city(city_raw, expected_country, snap)

        result_type = parse_result_type(row['score_raw'], row['notes_raw'])
        if city_status != 'OK' and result_type != 'WALKOVER':
            notes.append(f'Miasto {city_status}: {city_raw}')

        duplicate_id = snap['existing'].get((match_date, home_id, away_id)) if match_date else None
        if duplicate_id:
            notes.append(f'Duplikat istniejącego meczu {duplicate_id}')

        record = {
            **row,
            'match_date': match_date,
            'home_team_id': home_id,
            'away_team_id': away_id,
            'competition': comp_name,
            'match_level': level_name,
            'codes': ' '.join(codes),
            'competition_id': competition_id,
            'match_level_id': level_id,
            'city_raw': city_raw,
            'neutral': neutral,
            'match_city_id': city_id,
            'result_type': result_type,
            'review_notes': '; '.join(notes),
        }
        (review if notes else ready).append(record)
    return ready, review, skipped


def to_payload(record: dict[str, Any]) -> dict[str, Any]:
    return {
        'id': str(uuid.uuid4()),
        'home_team_id': record['home_team_id'],
        'away_team_id': record['away_team_id'],
        'competition_id': record['competition_id'],
        'match_level_id': record['match_level_id'],
        'match_date': record['match_date'],
        'match_city_id': record['match_city_id'],
        'match_status': 'FINISHED',
        'result_type': record['result_type'],
        'editorial_status': 'PARTIAL',
    }


def save_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text('', encoding='utf-8')
        return
    with path.open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--from-year', type=int, required=True)
    parser.add_argument('--to-year', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()

    load_env_file(ENV_FILE)
    client = SupabaseRest(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    snap = build_snapshot(client)
    rows = fetch_rows(args.from_year, args.to_year)
    ready, review, skipped = normalize(rows, snap)

    OUTPUT_DIR.mkdir(exist_ok=True)
    tag = f'plwiki_{args.from_year}_{args.to_year}'
    save_csv(OUTPUT_DIR / f'{tag}_ready.csv', ready)
    save_csv(OUTPUT_DIR / f'{tag}_review.csv', review)
    save_csv(OUTPUT_DIR / f'{tag}_skipped_unofficial.csv', skipped)

    print(f"Baza: {snap['counts']}")
    print(f'Wierszy w zakresie: {len(rows)} | oficjalnych: {len(ready) + len(review)} | pominięte N: {len(skipped)}')
    print(f'Gotowe: {len(ready)} | Do przejrzenia: {len(review)}')

    if args.apply:
        if review:
            print('Przerwano: są wiersze do przejrzenia — najpierw je rozstrzygnij.')
            return 1
        client.insert('tbl_Matches', [to_payload(r) for r in ready])
        print(f'Wstawiono: {len(ready)}')
    else:
        print('[DRY RUN] Brak zapisu.')

    report = {'ready': len(ready), 'review': len(review), 'skipped_unofficial': len(skipped), 'applied': args.apply}
    (OUTPUT_DIR / f'{tag}_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
