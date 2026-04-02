#!/usr/bin/env python3
"""
Generate SQL to add missing cities and link them to countries.
Maps English country names (from venues) to Polish names in DB.
"""

import pandas as pd
import os
from pathlib import Path
import json
from country_mapping_en_to_pl import COUNTRY_MAPPING

# Load the missing cities mapping from Excel
xlsx_path = Path('output/missing_city_mapping_needed_updated.xlsx')
if not xlsx_path.exists():
    print(f"ERROR: {xlsx_path} not found")
    print(f"Current directory: {os.getcwd()}")
    exit(1)

print(f"Loading {xlsx_path}...")
df = pd.read_excel(xlsx_path)
print(f"Loaded {len(df)} rows")
print(f"Columns: {df.columns.tolist()}")

# Check if required columns exist
required_cols = ['target_city_name', 'country']
if not all(col in df.columns for col in required_cols):
    print(f"ERROR: Expected columns {required_cols}")
    print(f"Actual columns: {df.columns.tolist()}")
    exit(1)

# Get unique city-country pairs
df_clean = df[required_cols].dropna()
df_clean = df_clean[df_clean['target_city_name'].str.strip() != '']
city_country_pairs = df_clean.drop_duplicates()
print(f"\nFound {len(city_country_pairs)} unique city-country pairs")

# Extract unique countries
unique_countries = sorted(city_country_pairs['country'].unique())
print(f"\nUnique countries ({len(unique_countries)}):")
for country in unique_countries:
    print(f"  - {country}")

# Build mapping for this data
unmapped = []
en_to_pl_mapping_actual = {}
for en_country in unique_countries:
    if en_country in COUNTRY_MAPPING:
        pl_country = COUNTRY_MAPPING[en_country]
        en_to_pl_mapping_actual[en_country] = pl_country
        print(f"✓ {en_country} -> {pl_country}")
    else:
        unmapped.append(en_country)
        print(f"✗ {en_country} -> [UNMAPPED]")

if unmapped:
    print(f"\n⚠️  WARNING: {len(unmapped)} unmapped country names:")
    for country in unmapped:
        print(f"  - {country}")
    print("\nPlease add these to COUNTRY_MAPPING in country_mapping_en_to_pl.py")
    exit(1)

print("\n✅ All countries mapped successfully!")

# Load countries from CSV
csv_path = Path('output/db_countries_reference.csv')
if not csv_path.exists():
    print(f"\nERROR: {csv_path} not found")
    exit(1)

print(f"\nLoading {csv_path}...")
countries_df = pd.read_csv(csv_path)
print(f"Loaded {len(countries_df)} countries from DB")
print(f"Columns: {countries_df.columns.tolist()}")

# Create mapping Polish name -> country_id (as string UUID)
pl_name_to_id = dict(zip(countries_df['name'], countries_df['id']))
print(f"Country ID mapping ready: {len(pl_name_to_id)} entries")

# For each city, get its country ID
city_country_pairs = city_country_pairs.copy()
city_country_pairs['country_id'] = city_country_pairs['country'].map(
    lambda en: pl_name_to_id.get(en_to_pl_mapping_actual[en])
)

missing_country_ids = city_country_pairs[city_country_pairs['country_id'].isna()]
if not missing_country_ids.empty:
    print(f"\n⚠️  WARNING: {len(missing_country_ids)} city-country pairs missing country IDs:")
    for idx, row in missing_country_ids.iterrows():
        pl_name = en_to_pl_mapping_actual[row['country']]
        print(f"  - City '{row['target_city_name']}' / Polish country '{pl_name}' (from '{row['country']}')")
    exit(1)

print(f"\n✅ All cities have country IDs!")

# Generate SQL
sql_lines = [
    "-- Generated SQL to add missing cities and country links",
    "-- WARNING: Review each INSERT before executing",
    f"-- Total inserts: {len(city_country_pairs)} cities",
    "",
    "BEGIN TRANSACTION;",
    "",
]

# Insert cities
for idx, (_, row) in enumerate(city_country_pairs.iterrows(), 1):
    city_name = row['target_city_name'].replace("'", "''")  # Escape single quotes
    
    sql_lines.append(
        f"-- {idx}. {row['country']} -> {city_name}"
    )
    sql_lines.append(
        f"INSERT INTO public.\"tbl_Cities\" (id, city_name) SELECT gen_random_uuid(), '{city_name}' WHERE NOT EXISTS (SELECT 1 FROM public.\"tbl_Cities\" WHERE city_name = '{city_name}');"
    )
    sql_lines.append("")

sql_lines.append("-- Now link cities to countries (if not already linked)")
sql_lines.append("")

# Link cities to countries
for idx, (_, row) in enumerate(city_country_pairs.iterrows(), 1):
    city_name = row['target_city_name'].replace("'", "''")
    country_id = str(row['country_id'])
    
    sql_lines.append(
        f"-- Link {idx}: {row['country']} -> {city_name}"
    )
    sql_lines.append(
                f"""INSERT INTO public.\"tbl_City_Country_Periods\" (id, city_id, country_id, valid_from, valid_to)
SELECT gen_random_uuid(), c.id, '{country_id}'::uuid, '2000-01-01'::date, NULL
FROM public.\"tbl_Cities\" c
WHERE c.city_name = '{city_name}'
  AND NOT EXISTS (
        SELECT 1 FROM public.\"tbl_City_Country_Periods\" ccp
    WHERE ccp.city_id = c.id
      AND ccp.country_id = '{country_id}'::uuid
  );"""
    )
    sql_lines.append("")

sql_lines.extend([
    "COMMIT;",
    "",
    "-- NOTE: Review the output above.",
    f"-- Total cities to add: {len(city_country_pairs)}",
])

sql_content = "\n".join(sql_lines)

# Save to file
output_file = Path('output/add_missing_cities_with_countries_FINAL.sql')
output_file.write_text(sql_content, encoding='utf-8')
print(f"\n✅ SQL generated: {output_file}")
print(f"   Total cities: {len(city_country_pairs)}")

# Also save summary as JSON for reference
summary = {
    'total_cities': len(city_country_pairs),
    'cities': [
        {
            'name': row['target_city_name'],
            'en_country': row['country'],
            'pl_country': en_to_pl_mapping_actual[row['country']],
            'country_id': str(row['country_id'])
        }
        for _, row in city_country_pairs.iterrows()
    ]
}

summary_file = Path('output/missing_cities_summary.json')
summary_file.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"✅ Summary saved: {summary_file}")

print("\n" + "="*60)
print("NEXT STEPS:")
print("1. Review the generated SQL:")
print(f"   cat {output_file}")
print("2. Execute in Supabase SQL Editor (copy-paste entire content)")
print("3. Re-run stage1 importer with the updated cities/countries")
print("="*60)
