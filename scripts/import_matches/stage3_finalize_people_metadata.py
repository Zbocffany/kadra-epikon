#!/usr/bin/env python3
"""
Finalize imported people metadata:
1) Fill tbl_People.birth_country_id using birth_city_id + tbl_City_Country_Periods and birth_date.
2) Fill tbl_Person_Countries for represented country inferred from match team (here: Finland).

Default input is the enriched non-Poland lineup XLSX used in stage3 import.
"""

import argparse
import os
import re
import sys
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote

import openpyxl
import requests

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent.parent
ENV_FILE = REPO_ROOT / '.env.local'
DEFAULT_INPUT_XLSX = BASE_DIR / 'output' / 'flashscore_lineups_6uCu1S0k_non_poland_players_enriched_v2.xlsx'


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

    def update(self, table: str, row: dict[str, Any], filters: dict[str, str]) -> list[dict[str, Any]]:
        response = requests.patch(
            f'{self.base_url}/{quote(table)}',
            params=filters,
            headers=self.headers,
            json=row,
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


def strip_diacritics(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value)
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch))


def canonicalize(value: str) -> str:
    text = strip_diacritics(value or '').lower()
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def to_iso_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.strftime('%Y-%m-%d')
    text = str(value).strip()
    if not text:
        return None
    return text if re.fullmatch(r'\d{4}-\d{2}-\d{2}', text) else text


def split_name(full_name: str, first_name_hint: str) -> tuple[str, str]:
    full = full_name.strip()
    hint = first_name_hint.strip()
    if hint and full.startswith(hint + ' '):
        return hint, full[len(hint) + 1:].strip()
    if ' ' in full:
        first, last = full.split(' ', 1)
        return first, last
    return full, ''


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return None


def in_period(target: date | None, valid_from: date | None, valid_to: date | None) -> bool:
    if target is None:
        return False
    if valid_from and target < valid_from:
        return False
    if valid_to and target > valid_to:
        return False
    return True


def read_xlsx(path: Path) -> list[dict[str, Any]]:
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(c) if c is not None else '' for c in next(rows_iter)]
    rows = [dict(zip(headers, row)) for row in rows_iter]
    wb.close()
    return rows


def resolve_people_keys(rows: list[dict[str, Any]]) -> list[tuple[str, str, str]]:
    keys: list[tuple[str, str, str]] = []
    for row in rows:
        full_name = str(row.get('full_name') or '').strip()
        first_hint = str(row.get('first_name') or '').strip()
        birth_date = to_iso_date(row.get('birth_date'))
        first_name, last_name = split_name(full_name, first_hint)
        if not first_name or not last_name or not birth_date:
            continue
        keys.append((canonicalize(first_name), canonicalize(last_name), birth_date))
    return list(dict.fromkeys(keys))


def find_country_for_birth(city_id: str, birth_date_iso: str | None, periods_by_city: dict[str, list[dict[str, str | None]]]) -> str | None:
    periods = periods_by_city.get(city_id, [])
    birth_dt = parse_iso_date(birth_date_iso)

    for period in periods:
        if in_period(birth_dt, parse_iso_date(period['valid_from']), parse_iso_date(period['valid_to'])):
            return period['country_id']

    # Fallback if exact date match not possible: current/ever single mapping.
    if len(periods) == 1:
        return periods[0]['country_id']
    return None


def run(input_xlsx: Path, represented_country_name: str, dry_run: bool) -> None:
    print(f'Wczytuję: {input_xlsx}')
    rows = read_xlsx(input_xlsx)
    print(f'  Wierszy: {len(rows)}')

    client = get_supabase_client()

    # Resolve represented country id (Finlandia)
    countries = client.select('tbl_Countries', 'id,name')
    country_id = None
    for c in countries:
        name = str(c.get('name') or '').strip()
        if canonicalize(name) == canonicalize(represented_country_name):
            country_id = str(c['id'])
            break
    if not country_id:
        raise RuntimeError(f'Nie znaleziono kraju: {represented_country_name}')
    print(f'  Reprezentowany kraj: {represented_country_name} ({country_id})')

    # Load people and target only those from input xlsx.
    target_keys = set(resolve_people_keys(rows))
    people = client.select('tbl_People', 'id,first_name,last_name,birth_date,birth_city_id,birth_country_id')
    target_people: list[dict[str, Any]] = []
    for p in people:
        key = (
            canonicalize(str(p.get('first_name') or '')),
            canonicalize(str(p.get('last_name') or '')),
            str(p.get('birth_date') or ''),
        )
        if key in target_keys:
            target_people.append(p)
    print(f'  Rozpoznane osoby do finalizacji: {len(target_people)}')

    if not target_people:
        print('Brak dopasowanych osób. Kończę.')
        return

    # Build map city -> country periods.
    periods = client.select('tbl_City_Country_Periods', 'city_id,country_id,valid_from,valid_to')
    periods_by_city: dict[str, list[dict[str, str | None]]] = {}
    for row in periods:
        city_id = str(row.get('city_id') or '')
        country = str(row.get('country_id') or '')
        if not city_id or not country:
            continue
        periods_by_city.setdefault(city_id, []).append(
            {
                'country_id': country,
                'valid_from': str(row.get('valid_from') or '') or None,
                'valid_to': str(row.get('valid_to') or '') or None,
            }
        )

    # Existing represented-country links.
    person_ids = [str(p['id']) for p in target_people if p.get('id')]
    existing_links = client.select(
        'tbl_Person_Countries',
        'person_id,country_id',
        {'person_id': f'in.({','.join(person_ids)})'},
    ) if person_ids else []
    existing_link_set = {(str(r.get('person_id')), str(r.get('country_id'))) for r in existing_links}

    # Plan updates and inserts.
    birth_country_updates: list[tuple[str, str]] = []
    unresolved_birth_country: list[str] = []
    person_country_inserts: list[dict[str, str]] = []

    for p in target_people:
        person_id = str(p['id'])
        full = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip()

        birth_city_id = str(p.get('birth_city_id') or '')
        birth_date_iso = str(p.get('birth_date') or '')
        current_birth_country_id = str(p.get('birth_country_id') or '')

        if birth_city_id:
            resolved_country_id = find_country_for_birth(birth_city_id, birth_date_iso, periods_by_city)
            if resolved_country_id:
                if current_birth_country_id != resolved_country_id:
                    birth_country_updates.append((person_id, resolved_country_id))
            else:
                unresolved_birth_country.append(full)

        if (person_id, country_id) not in existing_link_set:
            person_country_inserts.append({'person_id': person_id, 'country_id': country_id})

    print(f'  birth_country_id do aktualizacji: {len(birth_country_updates)}')
    print(f'  Linki tbl_Person_Countries do dodania: {len(person_country_inserts)}')
    if unresolved_birth_country:
        print(f'  Nierozstrzygnięty kraj urodzenia: {len(unresolved_birth_country)}')
        for name in unresolved_birth_country:
            print(f'    ! {name}')

    if dry_run:
        print('\n[DRY RUN] Brak zmian w bazie.')
        return

    # Apply birth_country updates
    updated_count = 0
    for person_id, resolved_country_id in birth_country_updates:
        client.update(
            'tbl_People',
            {'birth_country_id': resolved_country_id},
            {'id': f'eq.{person_id}'},
        )
        updated_count += 1

    # Apply represented-country links
    inserted_count = 0
    if person_country_inserts:
        inserted = client.insert('tbl_Person_Countries', person_country_inserts)
        inserted_count = len(inserted)

    print('\nZakończone:')
    print(f'  ✓ Zaktualizowano birth_country_id: {updated_count}')
    print(f'  ✓ Dodano linki reprezentowanego kraju: {inserted_count}')


def main() -> None:
    load_env_file(ENV_FILE)

    parser = argparse.ArgumentParser(description='Finalize birth_country_id and represented countries for imported people')
    parser.add_argument('--input-xlsx', type=Path, default=DEFAULT_INPUT_XLSX)
    parser.add_argument('--represented-country-name', default='Finlandia')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    try:
        run(args.input_xlsx, args.represented_country_name, args.dry_run)
    except Exception as exc:
        print(f'BŁĄD: {exc}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
