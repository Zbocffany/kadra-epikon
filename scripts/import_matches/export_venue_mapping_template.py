import csv
import os
from collections import Counter
from pathlib import Path

import requests


REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = REPO_ROOT / 'scripts' / 'import_matches' / 'output'
REVIEW_CSV = OUTPUT_DIR / 'review_needed.csv'
ENV_FILE = REPO_ROOT / '.env.local'


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


def export_mapping_template() -> int:
    rows: list[dict[str, str]] = []
    with REVIEW_CSV.open('r', encoding='utf-8', newline='') as file:
        reader = csv.DictReader(file)
        for row in reader:
            notes = row.get('review_notes') or ''
            if 'Brak match_city_id/match_stadium_id' in notes:
                rows.append(row)

    counter = Counter(
        (
            (row.get('city_raw') or '').strip(),
            (row.get('stadium_raw') or '').strip(),
            (row.get('venue_country_raw') or '').strip(),
        )
        for row in rows
    )

    target = OUTPUT_DIR / 'venue_mapping_template.csv'
    with target.open('w', encoding='utf-8-sig', newline='') as file:
        fieldnames = [
            'occurrences',
            'city_raw',
            'stadium_raw',
            'venue_country_raw',
            'target_city_name',
            'target_city_id',
            'target_stadium_name',
            'target_stadium_id',
            'notes',
        ]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()

        for (city_raw, stadium_raw, venue_country_raw), count in sorted(
            counter.items(), key=lambda item: (-item[1], item[0][0], item[0][1])
        ):
            writer.writerow(
                {
                    'occurrences': count,
                    'city_raw': city_raw,
                    'stadium_raw': stadium_raw,
                    'venue_country_raw': venue_country_raw,
                    'target_city_name': '',
                    'target_city_id': '',
                    'target_stadium_name': '',
                    'target_stadium_id': '',
                    'notes': '',
                }
            )

    return len(counter)


def export_db_reference() -> tuple[int, int]:
    url = (os.environ.get('SUPABASE_URL') or '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        raise RuntimeError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
    }

    cities_response = requests.get(
        f'{url}/rest/v1/tbl_Cities',
        params={'select': 'id,city_name', 'order': 'city_name.asc'},
        headers=headers,
        timeout=60,
    )
    cities_response.raise_for_status()
    cities = cities_response.json() if isinstance(cities_response.json(), list) else []

    stadiums_response = requests.get(
        f'{url}/rest/v1/tbl_Stadiums',
        params={'select': 'id,name,stadium_city_id', 'order': 'name.asc'},
        headers=headers,
        timeout=60,
    )
    stadiums_response.raise_for_status()
    stadiums = stadiums_response.json() if isinstance(stadiums_response.json(), list) else []

    cities_csv = OUTPUT_DIR / 'db_cities_reference.csv'
    with cities_csv.open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['id', 'city_name'])
        writer.writeheader()
        for city in cities:
            writer.writerow({'id': city.get('id') or '', 'city_name': city.get('city_name') or ''})

    stadiums_csv = OUTPUT_DIR / 'db_stadiums_reference.csv'
    with stadiums_csv.open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['id', 'name', 'stadium_city_id'])
        writer.writeheader()
        for stadium in stadiums:
            writer.writerow(
                {
                    'id': stadium.get('id') or '',
                    'name': stadium.get('name') or '',
                    'stadium_city_id': stadium.get('stadium_city_id') or '',
                }
            )

    return len(cities), len(stadiums)


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if not REVIEW_CSV.exists():
        raise FileNotFoundError(f'Missing review file: {REVIEW_CSV}')

    load_env_file(ENV_FILE)
    mapping_rows = export_mapping_template()
    cities_rows, stadiums_rows = export_db_reference()

    print(f'venue_mapping_template_rows={mapping_rows}')
    print(f'db_cities_reference_rows={cities_rows}')
    print(f'db_stadiums_reference_rows={stadiums_rows}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
