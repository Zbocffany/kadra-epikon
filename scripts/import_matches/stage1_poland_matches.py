import argparse
import csv
import json
import os
import re
import sys
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace('+00:00', 'Z')


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
OUTPUT_DIR = BASE_DIR / 'output'
MAPPINGS_DIR = BASE_DIR / 'mappings'
ENV_FILE = REPO_ROOT / '.env.local'

RAW_OUTPUT = OUTPUT_DIR / 'raw_matches.json'
NORMALIZED_OUTPUT = OUTPUT_DIR / 'normalized_matches.csv'
REVIEW_OUTPUT = OUTPUT_DIR / 'review_needed.csv'
READY_OUTPUT = OUTPUT_DIR / 'ready_to_import.csv'
REPORT_OUTPUT = OUTPUT_DIR / 'import_report.json'

HEADERS = {
    'User-Agent': 'kadra-epikon-stage1-import/0.1 (+https://kadra-epikon.vercel.app)'
}

POLAND_RESULTS_PAGES = [
    'https://en.wikipedia.org/wiki/Poland_national_football_team_results_(2000%E2%80%932019)',
    'https://en.wikipedia.org/wiki/Poland_national_football_team_results_(2020%E2%80%93present)',
]

CITY_ALIASES: dict[str, str] = {
    'warsaw': 'Warszawa',
    'london': 'Londyn',
    'marseille': 'Marsylia',
    'kaunas': 'Kowno',
    'belgrade': 'Belgrad',
    'saint etienne': 'Saint-Etienne',
    'saint-etienne': 'Saint-Etienne',
    'wroclaw': 'Wrocław',
    'poznan': 'Poznań',
    'gdansk': 'Gdańsk',
    'lodz': 'Łódź',
    'krakow': 'Kraków',
    'bialystok': 'Białystok',
    'bydgoszcz': 'Bydgoszcz',
    'szczecin': 'Szczecin',
    'chorzow': 'Chorzów',
    'brussels': 'Bruksela',
    'vienna': 'Wiedeń',
    'prague': 'Praga',
    'moscow': 'Moskwa',
    'rome': 'Rzym',
    'milan': 'Mediolan',
    'munich': 'Monachium',
    'copenhagen': 'Kopenhaga',
    'lisbon': 'Lizbona',
    'athens': 'Ateny',
    'abu dhabi': 'Aby Zabi',
    'aksu': 'Aksu',
    'al rayyan': 'Ar-Rajjan',
    'almaty': 'Ałmaty',
    'andorra la vella': 'Andora',
    'antalya': 'Antalya',
    'astana': 'Astana',
    'baku': 'Baku',
    'belfast': 'Belfast',
    'bełchatów': 'Bełchatów',
    'bologna': 'Bolonia',
    'bratislava': 'Bratysława',
    'bucharest': 'Bukareszt',
    'budapest': 'Budapeszt',
    'busan': 'Pusan',
    'cape town': 'Kapsztad',
    'chicago': 'Chicago',
    'chișinău': 'Kiszyniów',
    'daejeon': 'Daejeon',
    'dublin': 'Dublin',
    'faro / loulé': 'Loule',
    'gelsenkirchen': 'Gelsenkirchen',
    'grodzisk wielkopolski': 'Grodzisk Wielkopolski',
    'guimarães': 'Guimaraes',
    'hanover': 'Hanower',
    'helsinki': 'Helsinki',
    'jeonju': 'Jeonju',
    'jerez de la frontera': 'Jerez de la Frontera',
    'jerusalem': 'Jerozolima',
    'johannesburg': 'Johannesburg',
    'kaiserslautern': 'Kaiserslautern',
    'kazan': 'Kazań',
    'kharkiv': 'Charków',
    'klagenfurt': 'Klagenfurt',
    'kufstein': 'Kufstein',
    'kyiv': 'Kijów',
    'larnaca': 'Larnaka',
    'limassol': 'Limassol',
    'lisbon': 'Lizbona',
    'ljubljana': 'Lublana',
    'loulé': 'Loule',
    'lubin': 'Lubin',
    'lviv': 'Lwów',
    'minsk': 'Mińsk',
    'montréal': 'Montreal',
    'murcia': 'Murcja',
    'málaga': 'Malaga',
    'nakhon ratchasima': 'Nakhon Ratchasima',
    'nice': 'Nicea',
    'odense': 'Odense',
    'osijek': 'Osijek',
    'oslo': 'Oslo',
    'ostrowiec świętokrzyski': 'Ostrowiec Świętokrzyski',
    'paphos': 'Pafos',
    'piraeus': 'Pireus',
    'podgorica': 'Podgorica',
    'reggio emilia': 'Reggio Emilia',
    'reutlingen': 'Reutlingen',
    'reykjavík': 'Rejkiawik',
    'riga': 'Ryga',
    'riyadh': 'Rijad',
    'saint petersburg': 'Petersburg',
    'saint-denis': 'Saint-Denis',
    'san fernando': 'San Fernando',
    'seoul': 'Seul',
    'serravalle': 'Serravalle',
    'seville': 'Sewilla',
    'skopje': 'Skopje',
    'tallinn': 'Tallinn',
    'tbilisi': 'Tbilisi',
    'tórshavn': 'Thorshavn',
    'vila real de santo antónio': 'Vila Real de Santo António',
    'volgograd': 'Wołgograd',
    'wiesbaden': 'Wiesbaden',
    'yerevan': 'Erewań',
}


@dataclass
class RawMatchRecord:
    source_page_url: str
    source_page_title: str
    source_year: int
    source_order: int
    match_date_raw: str
    competition_raw: str
    competition_href: str
    home_team_raw: str
    away_team_raw: str
    score_raw: str
    venue_raw: str


class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str):
        self.base_url = url.rstrip('/') + '/rest/v1'
        self.headers = {
            'apikey': service_role_key,
            'Authorization': f'Bearer {service_role_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            'Range': '0-9999',
        }

    def select(self, table: str, select: str = '*', filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
        params = {'select': select}
        if filters:
            params.update(filters)

        response = requests.get(
            f'{self.base_url}/{quote(table)}',
            params=params,
            headers=self.headers,
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else []

    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        response = requests.post(
            f'{self.base_url}/{quote(table)}',
            headers=self.headers,
            json=rows,
            timeout=60,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else []


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_json(path: Path) -> Any:
    with path.open('r', encoding='utf-8') as file:
        return json.load(file)


def save_json(path: Path, payload: Any) -> None:
    with path.open('w', encoding='utf-8') as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def save_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        with path.open('w', encoding='utf-8', newline='') as file:
            file.write('')
        return

    fieldnames: list[str] = []
    for row in rows:
        for key in row.keys():
            if key not in fieldnames:
                fieldnames.append(key)

    with path.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def normalize_whitespace(value: str) -> str:
    return re.sub(r'\s+', ' ', value.replace('\xa0', ' ')).strip()


def clean_text(value: str) -> str:
    text = normalize_whitespace(value)
    text = re.sub(r'\[[^\]]+\]', '', text)
    text = normalize_whitespace(text)
    return text


def slug_from_url(url: str) -> str:
    return url.rstrip('/').split('/')[-1]


def fetch_html(url: str) -> BeautifulSoup:
    response = requests.get(url, headers=HEADERS, timeout=60)
    response.raise_for_status()
    return BeautifulSoup(response.text, 'lxml')


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding='utf-8').splitlines():
        entry = line.strip()
        if not entry or entry.startswith('#') or '=' not in entry:
            continue

        key, value = entry.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def extract_first_text(node: Tag, selectors: list[str]) -> str:
    for selector in selectors:
        match = node.select_one(selector)
        if match:
            return clean_text(match.get_text(' ', strip=True))
    return ''


def extract_first_href(node: Tag, selectors: list[str]) -> str:
    for selector in selectors:
        match = node.select_one(selector)
        if match and match.has_attr('href'):
            href = match['href']
            if isinstance(href, str):
                return href
    return ''


def table_classes(table: Tag) -> set[str]:
    return {str(class_name) for class_name in (table.get('class') or [])}


def is_match_table(table: Tag) -> bool:
    classes = table_classes(table)
    if 'vevent' in classes:
        return True
    return any('football-box' in class_name or 'footballbox' in class_name for class_name in classes)


def extract_heading_year(node: Tag) -> int | None:
    heading_text = clean_text(node.get_text(' ', strip=True))
    if re.fullmatch(r'\d{4}', heading_text):
        return int(heading_text)
    return None


def find_match_year(table: Tag) -> int | None:
    def is_heading_tag(tag: Tag) -> bool:
        if tag.name in {'h2', 'h3', 'h4', 'h5'}:
            return True
        return tag.name == 'div' and 'mw-heading' in table_classes(tag)

    heading = table.find_previous(is_heading_tag)
    while isinstance(heading, Tag):
        heading_node = heading
        if heading.name == 'div':
            heading_node = heading.find(['h2', 'h3', 'h4', 'h5']) or heading

        year = extract_heading_year(heading_node)
        if year is not None:
            return year

        heading = heading.find_previous(is_heading_tag)
    return None


def parse_footballbox(box: Tag, page_url: str, page_title: str, year: int, order: int) -> RawMatchRecord | None:
    rows = box.find_all('tr', recursive=False)
    if not rows:
        rows = box.select('tbody > tr')
    if not rows:
        return None

    cells = rows[0].find_all('td', recursive=False)
    if len(cells) < 5:
        return None

    meta_cell, home_cell, score_cell, away_cell, venue_cell = cells[:5]

    home_team = clean_text(home_cell.get_text(' ', strip=True))
    away_team = clean_text(away_cell.get_text(' ', strip=True))
    score_raw = clean_text(score_cell.get_text(' ', strip=True))
    match_date_raw = extract_first_text(meta_cell, ['span[style*="white-space:nowrap"]'])
    competition_raw = extract_first_text(meta_cell, ['small a', 'small'])
    competition_href = extract_first_href(meta_cell, ['small a'])
    venue_raw = clean_text(venue_cell.get_text(' ', strip=True))

    if not competition_raw:
        meta_text = clean_text(meta_cell.get_text(' ', strip=True))
        meta_text = meta_text.replace(match_date_raw, '', 1).strip() if match_date_raw else meta_text
        competition_raw = meta_text

    if not home_team or not away_team or not match_date_raw:
        return None

    return RawMatchRecord(
        source_page_url=page_url,
        source_page_title=page_title,
        source_year=year,
        source_order=order,
        match_date_raw=match_date_raw,
        competition_raw=competition_raw,
        competition_href=competition_href,
        home_team_raw=home_team,
        away_team_raw=away_team,
        score_raw=score_raw,
        venue_raw=venue_raw,
    )


def parse_results_page(url: str, from_year: int) -> list[dict[str, Any]]:
    soup = fetch_html(url)
    content = soup.select_one('.mw-parser-output')
    if not content:
        return []

    title = clean_text(soup.select_one('#firstHeading').get_text(' ', strip=True)) if soup.select_one('#firstHeading') else slug_from_url(url)
    matches: list[dict[str, Any]] = []
    order = 0

    for table in content.select('table'):
        if not is_match_table(table):
            continue

        year = find_match_year(table)
        if year is None:
            continue
        if year < from_year:
            continue

        order += 1
        parsed = parse_footballbox(table, url, title, year, order)
        if parsed:
            matches.append(parsed.__dict__)

    return matches


def fetch_raw_matches(from_year: int) -> list[dict[str, Any]]:
    ensure_output_dir()
    all_matches: list[dict[str, Any]] = []
    for url in POLAND_RESULTS_PAGES:
        all_matches.extend(parse_results_page(url, from_year))

    save_json(RAW_OUTPUT, all_matches)
    return all_matches


def strip_diacritics(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value)
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch))


def canonicalize(value: str) -> str:
    text = strip_diacritics(value or '').lower()
    text = text.replace('&', ' and ')
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return normalize_whitespace(text)


CITY_ALIASES_CANONICAL: dict[str, str] = {
    # Resolve aliases with canonical keys so inputs with/without diacritics map identically.
    canonicalize(key): value for key, value in CITY_ALIASES.items()
}


def load_country_aliases() -> dict[str, str]:
    payload = load_json(MAPPINGS_DIR / 'country_aliases.json')
    if not isinstance(payload, dict):
        raise ValueError('country_aliases.json must contain an object')
    return {str(key): str(value) for key, value in payload.items()}


def parse_match_date(date_raw: str, source_year: int) -> str | None:
    text = clean_text(date_raw)
    candidates = [
        f'{text} {source_year}' if not re.search(r'\b\d{4}\b', text) else text,
        text,
    ]
    formats = ['%d %B %Y', '%d %b %Y']

    for candidate in candidates:
        for fmt in formats:
            try:
                return datetime.strptime(candidate, fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
    return None


def parse_score(score_raw: str) -> tuple[int | None, int | None]:
    match = re.search(r'(\d+)\s*[–-]\s*(\d+)', score_raw)
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def infer_match_status(score_raw: str) -> str:
    lowered = score_raw.lower()
    if ' v ' in f' {lowered} ' or lowered.strip() in {'v', 'vs', 'tbd', ''}:
        return 'SCHEDULED'
    if 'cancel' in lowered:
        return 'CANCELLED'
    if 'aband' in lowered:
        return 'ABANDONED'
    return 'FINISHED'


def infer_result_type(score_raw: str, match_status: str) -> str | None:
    if match_status != 'FINISHED':
        return None

    lowered = score_raw.lower()
    if 'w/o' in lowered:
        return 'WALKOVER'
    if 'a.e.t.' in lowered and ('pen.' in lowered or 'pens' in lowered):
        return 'EXTRA_TIME_AND_PENALTIES'
    if 'pen.' in lowered or 'pens' in lowered:
        return 'PENALTIES'
    if 'a.e.t.' in lowered:
        return 'EXTRA_TIME'
    if 'golden goal' in lowered:
        return 'GOLDEN_GOAL'
    return 'REGULAR_TIME'


def split_venue(venue_raw: str) -> tuple[str | None, str | None, str | None]:
    text = clean_text(venue_raw)
    if not text:
        return None, None, None
    parts = [clean_text(part) for part in text.split(',') if clean_text(part)]
    stadium = parts[0] if parts else None
    city = parts[1] if len(parts) > 1 else None
    country = parts[2] if len(parts) > 2 else None
    return stadium, city, country


def infer_match_level(competition_text: str) -> str | None:
    lowered = competition_text.lower()
    if 'play-off' in lowered or 'play offs' in lowered or 'playoffs' in lowered:
        return 'Baraż'
    if 'qualif' in lowered:
        return 'Eliminacje'
    if 'group' in lowered:
        return 'Faza grupowa'
    if 'round of 16' in lowered:
        return '1/8 finału'
    if 'quarter-final' in lowered or 'quarterfinal' in lowered:
        return 'Ćwierćfinał'
    if 'semi-final' in lowered or 'semifinal' in lowered:
        return 'Półfinał'
    if re.search(r'\bfinal\b', lowered) and 'semi' not in lowered and 'quarter' not in lowered:
        return 'Finał'
    return None


def map_competition(competition_raw: str, competition_href: str) -> tuple[str | None, str | None, list[str]]:
    haystack = canonicalize(f'{competition_raw} {competition_href}')
    review_notes: list[str] = []

    if 'friendly' in haystack or 'exhibition game' in haystack:
        return 'Towarzyski', None, review_notes
    if any(token in haystack for token in {
        'cyprus tournament',
        'king s cup',
        'trofej marjana tournament',
        'valeriy lobanovskyi memorial tournament',
    }):
        return 'Towarzyski', None, review_notes
    if 'nations league' in haystack:
        return 'Liga Narodów', infer_match_level(competition_raw), review_notes
    if 'world cup qualification' in haystack and 'play off' in haystack:
        return 'Mistrzostwa Świata', 'Baraż', review_notes
    if 'world cup qualification' in haystack or 'fifa world cup qualification' in haystack:
        return 'Mistrzostwa Świata', 'Eliminacje', review_notes
    if 'fifa world cup' in haystack or re.search(r'\bworld cup\b', haystack):
        return 'Mistrzostwa Świata', infer_match_level(competition_raw), review_notes
    if 'euro' in haystack and 'qualif' in haystack and 'play off' in haystack:
        return 'Mistrzostwa Europy', 'Baraż', review_notes
    if 'euro' in haystack and 'qualif' in haystack:
        return 'Mistrzostwa Europy', 'Eliminacje', review_notes
    if 'uefa euro' in haystack or re.search(r'\beuro\b', haystack):
        return 'Mistrzostwa Europy', infer_match_level(competition_raw), review_notes
    if 'unofficial' in haystack:
        return 'Nieoficjalny', None, review_notes

    review_notes.append(f'Nieznane rozgrywki: {competition_raw}')
    return None, None, review_notes


def build_db_snapshot(client: SupabaseRestClient) -> dict[str, Any]:
    countries = client.select('tbl_Countries', 'id,name,fifa_code')
    teams = client.select('tbl_Teams', 'id,country_id,club_id')
    competitions = client.select('tbl_Competitions', 'id,name')
    match_levels = client.select('tbl_Match_Levels', 'id,name')
    cities = client.select('tbl_Cities', 'id,city_name')
    existing_matches = client.select('tbl_Matches', 'id,match_date,home_team_id,away_team_id,competition_id')

    country_by_id = {row['id']: row for row in countries if row.get('id')}
    country_team_by_name: dict[str, dict[str, Any]] = {}
    for team in teams:
        if team.get('club_id') is not None:
            continue
        country_id = team.get('country_id')
        country = country_by_id.get(country_id)
        if not country:
            continue
        country_name = str(country.get('name') or '').strip()
        if country_name:
            country_team_by_name[country_name] = team

    city_id_by_name: dict[str, str] = {}
    for city in cities:
        city_name = str(city.get('city_name') or '').strip()
        city_id = city.get('id')
        if city_name and city_id:
            city_id_by_name.setdefault(canonicalize(city_name), city_id)

    country_name_canonical_set = {
        canonicalize(str(country.get('name') or ''))
        for country in countries
        if str(country.get('name') or '').strip()
    }

    return {
        'countries': countries,
        'country_team_by_name': country_team_by_name,
        'city_id_by_name': city_id_by_name,
        'country_name_canonical_set': country_name_canonical_set,
        'competitions_by_name': {str(row['name']): row for row in competitions if row.get('name')},
        'match_levels_by_name': {str(row['name']): row for row in match_levels if row.get('name')},
        'existing_matches': existing_matches,
    }


def resolve_team(raw_name: str, aliases: dict[str, str], snapshot: dict[str, Any]) -> tuple[str | None, str | None, list[str]]:
    review_notes: list[str] = []
    alias_target = aliases.get(raw_name)
    if alias_target and alias_target in snapshot['country_team_by_name']:
        return snapshot['country_team_by_name'][alias_target]['id'], alias_target, review_notes

    normalized_lookup = {canonicalize(name): name for name in snapshot['country_team_by_name'].keys()}
    canonical_raw = canonicalize(raw_name)
    matched_name = normalized_lookup.get(canonical_raw)
    if matched_name:
        return snapshot['country_team_by_name'][matched_name]['id'], matched_name, review_notes

    if alias_target:
        review_notes.append(f'Brak teamu dla aliasu: {alias_target}')
    else:
        review_notes.append(f'Brak aliasu/teamu dla: {raw_name}')
    return None, None, review_notes


def resolve_competition(name: str | None, level_name: str | None, snapshot: dict[str, Any]) -> tuple[str | None, str | None, list[str]]:
    review_notes: list[str] = []
    competition_id = None
    match_level_id = None

    if name:
        competition = snapshot['competitions_by_name'].get(name)
        if competition:
            competition_id = competition['id']
        else:
            review_notes.append(f'Brak competition_id dla: {name}')
    else:
        review_notes.append('Brak zmapowanych rozgrywek')

    if level_name:
        level = snapshot['match_levels_by_name'].get(level_name)
        if level:
            match_level_id = level['id']
        else:
            review_notes.append(f'Brak match_level_id dla: {level_name}')

    return competition_id, match_level_id, review_notes


def resolve_venue(stadium_raw: str | None, city_raw: str | None, snapshot: dict[str, Any]) -> tuple[str | None, str | None, list[str]]:
    review_notes: list[str] = []
    city_id: str | None = None
    country_set = snapshot['country_name_canonical_set']

    candidates: list[str] = []

    # Wikipedia often stores venue as either: "City, Country" or "Stadium, City, Country".
    if city_raw and canonicalize(city_raw) not in country_set:
        candidates.append(city_raw)
    if stadium_raw:
        candidates.append(stadium_raw)

    for candidate in candidates:
        canonical_candidate = canonicalize(candidate)
        city_id = snapshot['city_id_by_name'].get(canonical_candidate)
        if city_id:
            break

        alias_target = CITY_ALIASES_CANONICAL.get(canonical_candidate)
        if alias_target:
            city_id = snapshot['city_id_by_name'].get(canonicalize(alias_target))
            if city_id:
                break

    if not city_id:
        review_notes.append(f'Brak match_city_id dla venue: {stadium_raw or "?"}, {city_raw or "?"}')

    return None, city_id, review_notes


def dedupe_status(match_date: str | None, home_team_id: str | None, away_team_id: str | None, competition_id: str | None, snapshot: dict[str, Any]) -> tuple[str, str | None]:
    if not match_date or not home_team_id or not away_team_id or not competition_id:
        return 'UNKNOWN', None

    for existing in snapshot['existing_matches']:
        if (
            existing.get('match_date') == match_date
            and existing.get('home_team_id') == home_team_id
            and existing.get('away_team_id') == away_team_id
            and existing.get('competition_id') == competition_id
        ):
            return 'EXACT_DUPLICATE', existing.get('id')

    return 'NEW', None


def editorial_status_for(match_status: str) -> str:
    return 'DRAFT' if match_status == 'SCHEDULED' else 'PARTIAL'


def normalize_records(raw_matches: list[dict[str, Any]], snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    aliases = load_country_aliases()
    normalized_rows: list[dict[str, Any]] = []
    ready_rows: list[dict[str, Any]] = []
    review_rows: list[dict[str, Any]] = []

    for raw in raw_matches:
        review_notes: list[str] = []
        match_date = parse_match_date(str(raw.get('match_date_raw') or ''), int(raw.get('source_year') or 0))
        if not match_date:
            review_notes.append(f"Nie mozna sparsowac daty: {raw.get('match_date_raw')}")

        home_team_id, home_team_name, home_notes = resolve_team(str(raw.get('home_team_raw') or ''), aliases, snapshot)
        away_team_id, away_team_name, away_notes = resolve_team(str(raw.get('away_team_raw') or ''), aliases, snapshot)
        review_notes.extend(home_notes)
        review_notes.extend(away_notes)

        competition_name, match_level_name, comp_notes = map_competition(
            str(raw.get('competition_raw') or ''),
            str(raw.get('competition_href') or ''),
        )
        review_notes.extend(comp_notes)

        competition_id, match_level_id, competition_lookup_notes = resolve_competition(competition_name, match_level_name, snapshot)
        review_notes.extend(competition_lookup_notes)

        score_raw = str(raw.get('score_raw') or '')
        home_score, away_score = parse_score(score_raw)
        match_status = infer_match_status(score_raw)
        result_type = infer_result_type(score_raw, match_status)

        stadium_raw, city_raw, venue_country_raw = split_venue(str(raw.get('venue_raw') or ''))
        match_stadium_id, match_city_id, venue_notes = resolve_venue(stadium_raw, city_raw, snapshot)
        review_notes.extend(venue_notes)
        duplicate_status, duplicate_match_id = dedupe_status(match_date, home_team_id, away_team_id, competition_id, snapshot)
        if duplicate_status == 'EXACT_DUPLICATE':
            review_notes.append(f'Exact duplicate existing_match_id={duplicate_match_id}')

        row = {
            'source_page_url': raw.get('source_page_url'),
            'source_page_title': raw.get('source_page_title'),
            'source_year': raw.get('source_year'),
            'source_order': raw.get('source_order'),
            'match_date': match_date,
            'match_time': None,
            'home_team_raw': raw.get('home_team_raw'),
            'away_team_raw': raw.get('away_team_raw'),
            'home_team_name_normalized': home_team_name,
            'away_team_name_normalized': away_team_name,
            'home_team_id': home_team_id,
            'away_team_id': away_team_id,
            'competition_raw': raw.get('competition_raw'),
            'competition_name_normalized': competition_name,
            'competition_id': competition_id,
            'match_level_name_normalized': match_level_name,
            'match_level_id': match_level_id,
            'score_raw': score_raw,
            'home_score': home_score,
            'away_score': away_score,
            'match_status': match_status,
            'result_type': result_type,
            'stadium_raw': stadium_raw,
            'city_raw': city_raw,
            'venue_country_raw': venue_country_raw,
            'match_stadium_id': match_stadium_id,
            'match_city_id': match_city_id,
            'editorial_status': editorial_status_for(match_status),
            'duplicate_status': duplicate_status,
            'duplicate_match_id': duplicate_match_id,
            'review_status': 'READY',
            'review_notes': '; '.join(note for note in review_notes if note),
        }

        critical_missing = [
            not row['match_date'],
            not row['home_team_id'],
            not row['away_team_id'],
            not row['competition_id'],
            not row['match_stadium_id'] and not row['match_city_id'],
            duplicate_status != 'NEW',
        ]
        if any(critical_missing):
            row['review_status'] = 'REVIEW'
            review_rows.append(row)
        else:
            ready_rows.append(row)

        normalized_rows.append(row)

    return normalized_rows, ready_rows, review_rows


def load_raw_matches() -> list[dict[str, Any]]:
    if not RAW_OUTPUT.exists():
        raise FileNotFoundError(f'Brak pliku raw: {RAW_OUTPUT}')
    payload = load_json(RAW_OUTPUT)
    if not isinstance(payload, list):
        raise ValueError('raw_matches.json must contain a list')
    return payload


def load_ready_rows() -> list[dict[str, Any]]:
    if not READY_OUTPUT.exists():
        raise FileNotFoundError(f'Brak pliku ready: {READY_OUTPUT}')

    with READY_OUTPUT.open('r', encoding='utf-8', newline='') as file:
        return list(csv.DictReader(file))


def get_supabase_client() -> SupabaseRestClient:
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    return SupabaseRestClient(url, key)


def write_report(report: dict[str, Any]) -> None:
    ensure_output_dir()
    save_json(REPORT_OUTPUT, report)


def run_fetch(args: argparse.Namespace) -> None:
    matches = fetch_raw_matches(args.from_year)
    print(f'Fetched raw matches: {len(matches)} -> {RAW_OUTPUT}')


def run_normalize(_: argparse.Namespace) -> None:
    client = get_supabase_client()
    snapshot = build_db_snapshot(client)
    raw_matches = load_raw_matches()
    normalized_rows, ready_rows, review_rows = normalize_records(raw_matches, snapshot)

    save_csv(NORMALIZED_OUTPUT, normalized_rows)
    save_csv(READY_OUTPUT, ready_rows)
    save_csv(REVIEW_OUTPUT, review_rows)

    report = {
        'normalized_total': len(normalized_rows),
        'ready_total': len(ready_rows),
        'review_total': len(review_rows),
        'generated_at': utc_now_iso(),
    }
    write_report(report)

    print(f'Normalized: {len(normalized_rows)}')
    print(f'Ready to import: {len(ready_rows)}')
    print(f'Review needed: {len(review_rows)}')


def build_insert_payload(row: dict[str, Any]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'id': str(uuid.uuid4()),
        'home_team_id': row['home_team_id'],
        'away_team_id': row['away_team_id'],
        'competition_id': row['competition_id'],
        'match_level_id': row.get('match_level_id') or None,
        'match_date': row['match_date'],
        'match_time': row['match_time'] or None,
        'match_stadium_id': row.get('match_stadium_id') or None,
        'match_city_id': row.get('match_city_id') or None,
        'match_status': row['match_status'],
        'result_type': row['result_type'] or None,
        'editorial_status': row['editorial_status'],
    }
    return payload


def run_import(args: argparse.Namespace) -> None:
    client = get_supabase_client()
    snapshot = build_db_snapshot(client)
    rows = load_ready_rows()
    payloads: list[dict[str, Any]] = []
    skipped_duplicates = 0

    for row in rows:
        duplicate_status, _ = dedupe_status(
            row.get('match_date') or None,
            row.get('home_team_id') or None,
            row.get('away_team_id') or None,
            row.get('competition_id') or None,
            snapshot,
        )
        if duplicate_status != 'NEW':
            skipped_duplicates += 1
            continue
        payloads.append(build_insert_payload(row))

    report = {
        'ready_rows': len(rows),
        'to_insert': len(payloads),
        'skipped_duplicates': skipped_duplicates,
        'applied': bool(args.apply),
        'generated_at': utc_now_iso(),
    }

    if args.apply and payloads:
        client.insert('tbl_Matches', payloads)

    write_report(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def run_all(args: argparse.Namespace) -> None:
    raw_matches = fetch_raw_matches(args.from_year)
    print(f'Fetched raw matches: {len(raw_matches)}')

    client = get_supabase_client()
    snapshot = build_db_snapshot(client)
    normalized_rows, ready_rows, review_rows = normalize_records(raw_matches, snapshot)

    save_csv(NORMALIZED_OUTPUT, normalized_rows)
    save_csv(READY_OUTPUT, ready_rows)
    save_csv(REVIEW_OUTPUT, review_rows)

    print(f'Ready to import: {len(ready_rows)}')
    print(f'Review needed: {len(review_rows)}')

    import_args = argparse.Namespace(apply=args.apply)
    run_import(import_args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Stage 1 importer for Poland national team matches')
    subparsers = parser.add_subparsers(dest='command', required=True)

    fetch_parser = subparsers.add_parser('fetch', help='Fetch raw matches from Wikipedia')
    fetch_parser.add_argument('--from-year', type=int, default=2000)
    fetch_parser.set_defaults(func=run_fetch)

    normalize_parser = subparsers.add_parser('normalize', help='Normalize raw matches into review/ready CSVs')
    normalize_parser.set_defaults(func=run_normalize)

    import_parser = subparsers.add_parser('import', help='Import ready matches into Supabase')
    import_parser.add_argument('--apply', action='store_true', help='Actually insert rows into tbl_Matches')
    import_parser.set_defaults(func=run_import)

    run_parser = subparsers.add_parser('run', help='Fetch, normalize, and optionally import')
    run_parser.add_argument('--from-year', type=int, default=2000)
    run_parser.add_argument('--apply', action='store_true', help='Actually insert rows into tbl_Matches')
    run_parser.add_argument('--dry-run', action='store_true', help='Alias for not passing --apply')
    run_parser.set_defaults(func=run_all)

    return parser


def main() -> int:
    ensure_output_dir()
    load_env_file(ENV_FILE)
    parser = build_parser()
    args = parser.parse_args()

    if getattr(args, 'dry_run', False):
        args.apply = False

    try:
        args.func(args)
        return 0
    except requests.HTTPError as error:
        print(f'HTTP error: {error}', file=sys.stderr)
        response = getattr(error, 'response', None)
        if response is not None:
            print(response.text, file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001
        print(f'Error: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())