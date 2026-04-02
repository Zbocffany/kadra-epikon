#!/usr/bin/env python3
"""
Import players from enriched Flashscore lineup XLSX into tbl_People.

For each player row:
  - Derives first_name / last_name from full_name
  - Looks up birth_city_id from tbl_Cities using birth_place_custom
  - Skips rows where birth_place_custom is empty (not yet filled)
  - Skips rows where person already exists (first_name + last_name + birth_date)
  - Inserts new people with birth_city_id; birth_country_id is left NULL
    (country is derived from city via tbl_City_Country_Periods per DB design)

Usage:
  python stage3_import_people.py [--input-xlsx PATH] [--dry-run]
"""

import argparse
import os
import re
import sys
import unicodedata
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import openpyxl
import requests

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
ENV_FILE = REPO_ROOT / '.env.local'

DEFAULT_INPUT_XLSX = (
    BASE_DIR / 'output' / 'flashscore_lineups_6uCu1S0k_non_poland_players_enriched_v2.xlsx'
)


# ---------------------------------------------------------------------------
# Env loading
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Supabase REST client
# ---------------------------------------------------------------------------

class SupabaseRestClient:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.base_url = url.rstrip('/') + '/rest/v1'
        self.headers = {
            'apikey': service_role_key,
            'Authorization': f'Bearer {service_role_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            'Range': '0-9999',
        }

    def select(self, table: str, select: str = '*', filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
        params: dict[str, str] = {'select': select}
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


def get_supabase_client() -> SupabaseRestClient:
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    return SupabaseRestClient(url, key)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_diacritics(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value)
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch))


def canonicalize(value: str) -> str:
    text = strip_diacritics(value or '').lower()
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def to_iso_date(value: Any) -> str | None:
    """Convert openpyxl date/datetime/string to YYYY-MM-DD string."""
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.strftime('%Y-%m-%d')
    text = str(value).strip()
    if not text:
        return None
    # Already ISO format
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', text):
        return text
    return text


def split_name(full_name: str, first_name_hint: str) -> tuple[str, str]:
    """Return (first_name, last_name) from full_name, using hint for split point."""
    full = full_name.strip()
    hint = first_name_hint.strip()
    if hint and full.startswith(hint + ' '):
        return hint, full[len(hint) + 1:].strip()
    if ' ' in full:
        parts = full.split(' ', 1)
        return parts[0], parts[1]
    return full, ''


# ---------------------------------------------------------------------------
# XLSX reader
# ---------------------------------------------------------------------------

def read_xlsx(path: Path) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(c) if c is not None else '' for c in next(rows_iter)]
    rows = [dict(zip(headers, row)) for row in rows_iter]
    wb.close()
    return rows


# ---------------------------------------------------------------------------
# Main import logic
# ---------------------------------------------------------------------------

def run(input_xlsx: Path, dry_run: bool) -> None:
    print(f'Wczytuję: {input_xlsx}')
    rows = read_xlsx(input_xlsx)
    print(f'  Wierszy w pliku: {len(rows)}')

    client = get_supabase_client()

    # --- Load cities ---
    cities = client.select('tbl_Cities', 'id,city_name')
    city_id_by_canonical: dict[str, str] = {}
    for city in cities:
        name = str(city.get('city_name') or '').strip()
        cid = city.get('id')
        if name and cid:
            city_id_by_canonical[canonicalize(name)] = str(cid)
    print(f'  Miast w bazie: {len(cities)}')

    # --- Load existing people ---
    existing_people = client.select('tbl_People', 'id,first_name,last_name,birth_date')
    existing_keys: set[tuple[str, str, str]] = set()
    for person in existing_people:
        key = (
            canonicalize(str(person.get('first_name') or '')),
            canonicalize(str(person.get('last_name') or '')),
            str(person.get('birth_date') or ''),
        )
        existing_keys.add(key)
    print(f'  Osób w bazie: {len(existing_people)}')

    to_insert: list[dict[str, Any]] = []
    skipped_no_custom: list[str] = []
    skipped_exists: list[str] = []
    city_not_found: list[str] = []

    for row in rows:
        full_name = str(row.get('full_name') or '').strip()
        first_name_hint = str(row.get('first_name') or '').strip()
        birth_date = to_iso_date(row.get('birth_date'))
        birth_place_custom = str(row.get('birth_place_custom') or '').strip()

        if not birth_place_custom:
            skipped_no_custom.append(full_name or '(brak)')
            continue

        first_name, last_name = split_name(full_name, first_name_hint)

        # City lookup
        city_id = city_id_by_canonical.get(canonicalize(birth_place_custom))
        if not city_id:
            city_not_found.append(f'{full_name} → "{birth_place_custom}"')
            continue

        # Dedupe check
        key = (canonicalize(first_name), canonicalize(last_name), str(birth_date or ''))
        if key in existing_keys:
            skipped_exists.append(full_name)
            continue

        to_insert.append({
            'id': str(uuid.uuid4()),
            'first_name': first_name,
            'last_name': last_name,
            'birth_date': birth_date,
            'birth_city_id': city_id,
            'birth_country_id': None,
            'is_active': True,
        })

    # --- Report ---
    if skipped_no_custom:
        print(f'\n  Pominięto (brak birth_place_custom): {len(skipped_no_custom)}')
        for name in skipped_no_custom:
            print(f'    - {name}')

    if city_not_found:
        print(f'\n  Miasto NIE ZNALEZIONE w bazie: {len(city_not_found)}')
        for entry in city_not_found:
            print(f'    ! {entry}')
        print('  → Dodaj te miasta do bazy przed ponownym uruchomieniem.')

    if skipped_exists:
        print(f'\n  Już istnieje w bazie (pominięto): {len(skipped_exists)}')
        for name in skipped_exists:
            print(f'    = {name}')

    print(f'\n  Do wstawienia: {len(to_insert)}')
    for p in to_insert:
        print(f"    + {p['first_name']} {p['last_name']} | {p['birth_date']} | city_id={p['birth_city_id']}")

    if not to_insert:
        print('\nNic do wstawienia.')
        return

    if dry_run:
        print('\n[DRY RUN] Brak insercji. Uruchom bez --dry-run aby zapisać.')
        return

    print('\nWstawianie do tbl_People...')
    inserted = client.insert('tbl_People', to_insert)
    print(f'  ✓ Wstawiono {len(inserted)} osób.')


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    load_env_file(ENV_FILE)

    parser = argparse.ArgumentParser(description='Import zawodników z XLSX do tbl_People')
    parser.add_argument(
        '--input-xlsx',
        type=Path,
        default=DEFAULT_INPUT_XLSX,
        help=f'Plik wejściowy (domyślnie: {DEFAULT_INPUT_XLSX.name})',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Tylko podgląd — nie wstawia do bazy',
    )
    args = parser.parse_args()

    try:
        run(args.input_xlsx, args.dry_run)
    except Exception as exc:
        print(f'BŁĄD: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
