import os
import csv
from pathlib import Path
import requests


for line in Path('.env.local').read_text(encoding='utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

url = os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/tbl_Countries'
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
}
resp = requests.get(url, params={'select': 'id,name', 'order': 'name.asc'}, headers=headers, timeout=60)
resp.raise_for_status()
countries = resp.json()

out = Path('scripts/import_matches/output/db_countries_reference.csv')
with out.open('w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['id', 'name'])
    w.writeheader()
    for c in countries:
        w.writerow({'id': c.get('id', ''), 'name': c.get('name', '')})

print(f'exported {len(countries)} countries to {out}')
