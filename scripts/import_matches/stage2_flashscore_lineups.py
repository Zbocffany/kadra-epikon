import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

import requests


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / 'output'

DEFAULT_ENDPOINT = 'https://3.ds.lsapp.eu/pq_graphql'
DEFAULT_PROJECT_ID = 3
DEFAULT_QUERY_HASH = 'dlie2'
DEFAULT_TIMEOUT = 45

HEADERS = {
    'User-Agent': 'kadra-epikon-stage2-lineups/0.1 (+https://kadra-epikon.vercel.app)'
}


def normalize_text(value: str) -> str:
    text = unicodedata.normalize('NFKD', value)
    text = ''.join(char for char in text if not unicodedata.combining(char))
    text = text.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    return text


def is_poland_name(team_name: str) -> bool:
    normalized = normalize_text(team_name)
    return normalized in {
        'poland',
        'polska',
        'polen',
        'pologne',
    }


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_lineups_payload(
    event_id: str,
    project_id: int,
    query_hash: str,
    endpoint: str,
    timeout: int,
) -> dict[str, Any]:
    params = {
        '_hash': query_hash,
        'eventId': event_id,
        'projectId': str(project_id),
    }
    response = requests.get(endpoint, params=params, headers=HEADERS, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError('Unexpected response type: expected JSON object')
    return payload


def _group_player_ids(groups: list[dict[str, Any]]) -> tuple[set[str], set[str]]:
    starters: set[str] = set()
    bench: set[str] = set()

    for group in groups:
        sort_key = group.get('sortKey')
        group_name = str(group.get('name') or '')
        normalized_name = normalize_text(group_name)
        ids = {str(player_id) for player_id in (group.get('playerIds') or [])}

        if sort_key == 11 or 'wyjsciow' in normalized_name or 'starting' in normalized_name:
            starters.update(ids)
        elif sort_key == 501 or 'rezer' in normalized_name or 'bench' in normalized_name:
            bench.update(ids)

    return starters, bench


def _used_substitution_maps(used_substitutions: list[dict[str, Any]]) -> tuple[dict[str, str], dict[str, str]]:
    in_minutes: dict[str, str] = {}
    out_minutes: dict[str, str] = {}

    for sub in used_substitutions:
        minute = str(sub.get('minute') or '')
        player_in_id = str(sub.get('playerId') or '')
        player_out_id = str(sub.get('playerOutId') or '')

        if player_in_id:
            in_minutes[player_in_id] = minute
        if player_out_id:
            out_minutes[player_out_id] = minute

    return in_minutes, out_minutes


def flatten_players(payload: dict[str, Any], event_id: str) -> list[dict[str, Any]]:
    participants = (
        payload.get('data', {})
        .get('findEventById', {})
        .get('eventParticipants', [])
    )

    if not isinstance(participants, list):
        raise ValueError('Unexpected payload shape: eventParticipants missing or not a list')

    rows: list[dict[str, Any]] = []

    for participant in participants:
        team_id = str(participant.get('id') or '')
        team_name = str(participant.get('name') or '')
        side = str(participant.get('type', {}).get('side') or '')
        lineup = participant.get('lineup') or {}

        players = lineup.get('players') or []
        groups = lineup.get('groups') or []
        used_substitutions = lineup.get('usedSubstitutions') or []

        starters, bench = _group_player_ids(groups)
        in_minutes, out_minutes = _used_substitution_maps(used_substitutions)

        for player in players:
            player_id = str(player.get('id') or '')
            player_roles = player.get('playerRoles') or []
            participant_meta = player.get('participant') or {}
            rating = player.get('rating') or {}

            if player_id in starters:
                lineup_group = 'starting_xi'
            elif player_id in bench:
                lineup_group = 'bench'
            else:
                lineup_group = 'other'

            rows.append(
                {
                    'event_id': event_id,
                    'team_id': team_id,
                    'team_name': team_name,
                    'team_side': side,
                    'is_poland_team': is_poland_name(team_name),
                    'player_id': player_id,
                    'player_participant_id': str(player.get('participantId') or ''),
                    'player_field_name': str(player.get('fieldName') or ''),
                    'player_list_name': str(player.get('listName') or ''),
                    'player_shirt_number': str(player.get('number') or ''),
                    'player_url_slug': str(participant_meta.get('url') or ''),
                    'lineup_group': lineup_group,
                    'subbed_in_minute': in_minutes.get(player_id, ''),
                    'subbed_out_minute': out_minutes.get(player_id, ''),
                    'rating_value': str(rating.get('value') or ''),
                    'rating_is_best': bool(rating.get('isBest') or False),
                    'club_name': str(player.get('teamName') or ''),
                    'player_roles': '; '.join(
                        str(role.get('suffix') or '').strip()
                        for role in player_roles
                        if isinstance(role, dict) and str(role.get('suffix') or '').strip()
                    ),
                }
            )

    return rows


def save_json(path: Path, payload: Any) -> None:
    with path.open('w', encoding='utf-8') as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def save_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        with path.open('w', encoding='utf-8', newline='') as file:
            file.write('')
        return

    fieldnames = list(rows[0].keys())
    with path.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Stage 2 lineup extractor for Flashscore FSDS endpoint.'
    )
    parser.add_argument('--event-id', required=True, help='Flashscore event id, e.g. 6uCu1S0k')
    parser.add_argument('--project-id', type=int, default=DEFAULT_PROJECT_ID)
    parser.add_argument('--query-hash', default=DEFAULT_QUERY_HASH)
    parser.add_argument('--endpoint', default=DEFAULT_ENDPOINT)
    parser.add_argument('--timeout', type=int, default=DEFAULT_TIMEOUT)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_output_dir()

    payload = fetch_lineups_payload(
        event_id=args.event_id,
        project_id=args.project_id,
        query_hash=args.query_hash,
        endpoint=args.endpoint,
        timeout=args.timeout,
    )
    rows = flatten_players(payload, event_id=args.event_id)
    non_poland_rows = [row for row in rows if not row['is_poland_team']]

    base_name = f'flashscore_lineups_{args.event_id}'
    raw_output = OUTPUT_DIR / f'{base_name}_raw.json'
    all_players_output = OUTPUT_DIR / f'{base_name}_all_players.csv'
    non_poland_output = OUTPUT_DIR / f'{base_name}_non_poland_players.csv'
    summary_output = OUTPUT_DIR / f'{base_name}_summary.json'

    save_json(raw_output, payload)
    save_csv(all_players_output, rows)
    save_csv(non_poland_output, non_poland_rows)

    summary = {
        'event_id': args.event_id,
        'endpoint': args.endpoint,
        'query_hash': args.query_hash,
        'project_id': args.project_id,
        'all_players_count': len(rows),
        'non_poland_players_count': len(non_poland_rows),
        'teams': sorted({row['team_name'] for row in rows}),
        'outputs': {
            'raw_json': str(raw_output),
            'all_players_csv': str(all_players_output),
            'non_poland_players_csv': str(non_poland_output),
        },
    }
    save_json(summary_output, summary)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
