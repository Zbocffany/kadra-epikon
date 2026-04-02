import argparse
import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from openpyxl import Workbook


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / 'output'

DEFAULT_INPUT = OUTPUT_DIR / 'flashscore_lineups_6uCu1S0k_non_poland_players.csv'
DEFAULT_OUTPUT_CSV = OUTPUT_DIR / 'flashscore_lineups_6uCu1S0k_non_poland_players_enriched.csv'
DEFAULT_OUTPUT_XLSX = OUTPUT_DIR / 'flashscore_lineups_6uCu1S0k_non_poland_players_enriched.xlsx'

HEADERS = {
    'User-Agent': 'kadra-epikon-stage2-enrichment/0.1 (+https://kadra-epikon.vercel.app)'
}


def _date_from_wikidata_time(value: str) -> str:
    # Example: +1993-03-21T00:00:00Z
    match = re.match(r'^[+\-](\d{4})-(\d{2})-(\d{2})T', value)
    if not match:
        return ''
    return f'{match.group(1)}-{match.group(2)}-{match.group(3)}'


def _date_from_flashscore_text(html: str) -> str:
    # Expected fragment: Age: 33 (21.03.1993)
    match = re.search(r'Age:\s*\d+\s*\((\d{2}\.\d{2}\.\d{4})\)', html)
    if not match:
        return ''

    try:
        parsed = datetime.strptime(match.group(1), '%d.%m.%Y')
        return parsed.strftime('%Y-%m-%d')
    except ValueError:
        return ''


def _full_name_from_flashscore_html(html: str) -> str:
    # Use title: <title>Jesse Joronen - Finland / Palermo stats</title>
    title_match = re.search(r'<title>\s*([^<]+?)\s*-\s*[^<]+</title>', html, flags=re.IGNORECASE)
    if title_match:
        raw = title_match.group(1).strip()
        # Normalize variants like "Jesse Joronen (Palermo) Stats".
        raw = re.sub(r'\s*\([^)]*\)\s*stats\s*$', '', raw, flags=re.IGNORECASE)
        raw = re.sub(r'\s+stats\s*$', '', raw, flags=re.IGNORECASE)
        return raw.strip()

    h2_match = re.search(r'<h2[^>]*>([^<]+)</h2>', html, flags=re.IGNORECASE)
    if h2_match:
        return h2_match.group(1).strip()

    return ''


def _place_from_flashscore_html(html: str) -> str:
    # Some profiles may include this label.
    patterns = [
        r'Place of birth:\s*</[^>]+>\s*<[^>]+>([^<]+)<',
        r'Place of birth:\s*([^<\n]+)',
        r'Birth place:\s*([^<\n]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ''


def fetch_flashscore_profile(slug: str, player_id: str) -> dict[str, str]:
    url = f'https://www.flashscore.com/player/{slug}/{player_id}/'
    response = requests.get(url, headers=HEADERS, timeout=45)
    response.raise_for_status()
    html = response.text

    full_name = _full_name_from_flashscore_html(html)
    birth_date = _date_from_flashscore_text(html)
    birth_place = _place_from_flashscore_html(html)

    return {
        'full_name': full_name,
        'birth_date': birth_date,
        'birth_place': birth_place,
    }


def _extract_wikidata_string_claim(entity: dict[str, Any], claim_code: str) -> str:
    claims = entity.get('claims', {}).get(claim_code, [])
    if not claims:
        return ''

    datavalue = claims[0].get('mainsnak', {}).get('datavalue', {})
    value = datavalue.get('value')
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return str(value.get('id') or '')
    return ''


def fetch_wikidata_profile(full_name: str) -> dict[str, str]:
    if not full_name:
        return {'birth_date': '', 'birth_place': ''}

    search = requests.get(
        'https://www.wikidata.org/w/api.php',
        params={
            'action': 'wbsearchentities',
            'search': full_name,
            'language': 'en',
            'format': 'json',
            'limit': 1,
        },
        headers=HEADERS,
        timeout=45,
    )
    search.raise_for_status()
    payload = search.json()
    found = payload.get('search', [])
    if not found:
        return {'birth_date': '', 'birth_place': ''}

    entity_id = str(found[0].get('id') or '')
    if not entity_id:
        return {'birth_date': '', 'birth_place': ''}

    entity_response = requests.get(
        f'https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json',
        headers=HEADERS,
        timeout=45,
    )
    entity_response.raise_for_status()
    entity_payload = entity_response.json()
    entity = entity_payload.get('entities', {}).get(entity_id, {})

    dob_raw = (
        entity.get('claims', {})
        .get('P569', [{}])[0]
        .get('mainsnak', {})
        .get('datavalue', {})
        .get('value', {})
        .get('time', '')
    )
    birth_date = _date_from_wikidata_time(dob_raw) if isinstance(dob_raw, str) else ''

    birth_place_entity = _extract_wikidata_string_claim(entity, 'P19')
    birth_place = ''
    if birth_place_entity:
        place_response = requests.get(
            f'https://www.wikidata.org/wiki/Special:EntityData/{birth_place_entity}.json',
            headers=HEADERS,
            timeout=45,
        )
        place_response.raise_for_status()
        place_payload = place_response.json()
        place_entity = place_payload.get('entities', {}).get(birth_place_entity, {})
        birth_place = str(
            place_entity.get('labels', {}).get('en', {}).get('value')
            or place_entity.get('labels', {}).get('pl', {}).get('value')
            or ''
        )

    return {
        'birth_date': birth_date,
        'birth_place': birth_place,
    }


def first_name_from_full_name(full_name: str) -> str:
    if not full_name:
        return ''
    tokens = [token for token in full_name.strip().split(' ') if token]
    return tokens[0] if tokens else ''


def first_name_from_slug(slug: str) -> str:
    if not slug:
        return ''
    parts = [part for part in slug.strip().split('-') if part]
    if len(parts) < 2:
        return parts[0].capitalize() if parts else ''
    # Flashscore slug usually looks like surname-name.
    return parts[-1].capitalize()


def save_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text('', encoding='utf-8')
        return

    fieldnames = list(rows[0].keys())
    with path.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def save_xlsx(path: Path, rows: list[dict[str, Any]]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = 'non_poland_enriched'

    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for row in rows:
            ws.append([row.get(column, '') for column in headers])

        ws.freeze_panes = 'A2'
        ws.auto_filter.ref = ws.dimensions

        for index, header in enumerate(headers, start=1):
            max_len = max(len(str(header)), *(len(str(row.get(header, ''))) for row in rows))
            ws.column_dimensions[ws.cell(row=1, column=index).column_letter].width = min(max(max_len + 2, 10), 40)

    wb.save(path)


def run(input_csv: Path, output_csv: Path, output_xlsx: Path) -> dict[str, Any]:
    with input_csv.open('r', encoding='utf-8', newline='') as file:
        rows = list(csv.DictReader(file))

    profile_cache: dict[tuple[str, str], dict[str, str]] = {}
    wikidata_cache: dict[str, dict[str, str]] = {}
    enriched_rows: list[dict[str, Any]] = []

    for row in rows:
        slug = str(row.get('player_url_slug') or '').strip()
        player_id = str(row.get('player_id') or '').strip()
        profile_key = (slug, player_id)

        profile = profile_cache.get(profile_key)
        if profile is None and slug and player_id:
            try:
                profile = fetch_flashscore_profile(slug, player_id)
            except requests.RequestException:
                profile = {'full_name': '', 'birth_date': '', 'birth_place': ''}
            profile_cache[profile_key] = profile
        elif profile is None:
            profile = {'full_name': '', 'birth_date': '', 'birth_place': ''}

        full_name = profile.get('full_name', '').strip()
        birth_date = profile.get('birth_date', '').strip()
        birth_place = profile.get('birth_place', '').strip()

        if full_name and (not birth_date or not birth_place):
            wiki = wikidata_cache.get(full_name)
            if wiki is None:
                try:
                    wiki = fetch_wikidata_profile(full_name)
                except requests.RequestException:
                    wiki = {'birth_date': '', 'birth_place': ''}
                wikidata_cache[full_name] = wiki

            if not birth_date:
                birth_date = wiki.get('birth_date', '')
            if not birth_place:
                birth_place = wiki.get('birth_place', '')

        merged = dict(row)
        merged['full_name'] = full_name
        inferred_first_name = first_name_from_full_name(full_name)
        if not inferred_first_name:
            inferred_first_name = first_name_from_slug(slug)

        merged['first_name'] = inferred_first_name
        merged['birth_date'] = birth_date
        merged['birth_place'] = birth_place
        merged['birth_place_custom'] = ''
        enriched_rows.append(merged)

    save_csv(output_csv, enriched_rows)
    save_xlsx(output_xlsx, enriched_rows)

    return {
        'input_rows': len(rows),
        'output_csv': str(output_csv),
        'output_xlsx': str(output_xlsx),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Enrich non-Poland lineup players with profile data.')
    parser.add_argument('--input-csv', type=Path, default=DEFAULT_INPUT)
    parser.add_argument('--output-csv', type=Path, default=DEFAULT_OUTPUT_CSV)
    parser.add_argument('--output-xlsx', type=Path, default=DEFAULT_OUTPUT_XLSX)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = run(args.input_csv, args.output_csv, args.output_xlsx)
    print(summary)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
