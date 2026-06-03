/**
 * export-clubs-csv.mjs
 *
 * Eksportuje listę wszystkich klubów do pliku CSV (UTF-8 BOM, otwieralny w Excelu).
 * Kolumny: Nazwa klubu, Miasto, Kraj (aktualny), Rok założenia
 *
 * Użycie:
 *   node scripts/export-clubs-csv.mjs
 *   node scripts/export-clubs-csv.mjs --out clubs_export.csv
 *
 * Wymagane zmienne środowiskowe: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Ładowanie z .env.local (PowerShell):
 *   Get-Content .env.local | Where-Object { $_ -match '^SUPABASE_URL=|^SUPABASE_SERVICE_ROLE_KEY=' } |
 *     ForEach-Object { $parts = $_ -split '=', 2; [System.Environment]::SetEnvironmentVariable($parts[0], $parts[1]) };
 *   node scripts/export-clubs-csv.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w zmiennych środowiskowych.')
  process.exit(1)
}

const outArg = process.argv.indexOf('--out')
const outFile = outArg !== -1 ? process.argv[outArg + 1] : 'clubs_export.csv'
const outPath = resolve(process.cwd(), outFile)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── 1. Wszystkie kluby ─────────────────────────────────────────────────────────
const { data: clubs, error: clubsError } = await supabase
  .from('tbl_Clubs')
  .select('id, name, club_city_id')
  .order('name', { ascending: true })

if (clubsError) { console.error('tbl_Clubs:', clubsError.message); process.exit(1) }

console.log(`Pobrano ${clubs.length} klubów.`)

// ── 2. Miasta ─────────────────────────────────────────────────────────────────
const cityIds = [...new Set(clubs.map(c => c.club_city_id).filter(Boolean))]
const cityMap = new Map()  // id → city_name

if (cityIds.length) {
  const BATCH = 250
  for (let i = 0; i < cityIds.length; i += BATCH) {
    const chunk = cityIds.slice(i, i + BATCH)
    const { data: cities, error: citiesError } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', chunk)
    if (citiesError) { console.error('tbl_Cities:', citiesError.message); process.exit(1) }
    for (const c of cities ?? []) cityMap.set(c.id, c.city_name)
  }
  console.log(`Pobrano ${cityMap.size} miast.`)
}

// ── 3. Okresy przynależności miast do krajów ──────────────────────────────────
const periodsMap = new Map()  // city_id → [{ country_id, valid_from, valid_to }]

if (cityIds.length) {
  const BATCH = 250
  for (let i = 0; i < cityIds.length; i += BATCH) {
    const chunk = cityIds.slice(i, i + BATCH)
    const { data: periods, error: periodsError } = await supabase
      .from('tbl_City_Country_Periods')
      .select('city_id, country_id, valid_from, valid_to')
      .in('city_id', chunk)
    if (periodsError) { console.error('tbl_City_Country_Periods:', periodsError.message); process.exit(1) }
    for (const p of periods ?? []) {
      const list = periodsMap.get(p.city_id) ?? []
      list.push(p)
      periodsMap.set(p.city_id, list)
    }
  }
}

// ── 4. Kraje ──────────────────────────────────────────────────────────────────
const allCountryIds = [...new Set(
  [...periodsMap.values()].flat().map(p => p.country_id).filter(Boolean)
)]
const countryMap = new Map()  // id → name

if (allCountryIds.length) {
  const BATCH = 250
  for (let i = 0; i < allCountryIds.length; i += BATCH) {
    const chunk = allCountryIds.slice(i, i + BATCH)
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', chunk)
    if (countriesError) { console.error('tbl_Countries:', countriesError.message); process.exit(1) }
    for (const c of countries ?? []) countryMap.set(c.id, c.name)
  }
  console.log(`Pobrano ${countryMap.size} krajów.`)
}

// ── 5. Rok założenia ──────────────────────────────────────────────────────────
const foundedMap = new Map()  // club_id → rok (string)

{
  const allClubIds = clubs.map(c => c.id)
  const BATCH = 250
  for (let i = 0; i < allClubIds.length; i += BATCH) {
    const chunk = allClubIds.slice(i, i + BATCH)
    const { data: history, error: historyError } = await supabase
      .from('tbl_Club_History')
      .select('club_id, event_date')
      .eq('event_type', 'FOUNDED')
      .in('club_id', chunk)
      .not('event_date', 'is', null)
    if (historyError) { console.error('tbl_Club_History:', historyError.message); process.exit(1) }
    for (const row of history ?? []) {
      const prev = foundedMap.get(row.club_id)
      if (!prev || row.event_date < prev) foundedMap.set(row.club_id, row.event_date)
    }
  }
  console.log(`Pobrano daty założenia dla ${foundedMap.size} klubów.`)
}

// ── 6. Funkcja pomocnicza: aktualny kraj miasta ───────────────────────────────
function getCurrentCountry(cityId) {
  const periods = periodsMap.get(cityId)
  if (!periods?.length) return null
  // Preferuj bieżący (valid_to IS NULL)
  const current = periods.find(p => p.valid_to === null)
  if (current) return countryMap.get(current.country_id) ?? null
  // Fallback: najpóźniejszy valid_to
  const latest = periods.reduce((best, p) =>
    !best || (p.valid_to && p.valid_to > (best.valid_to ?? '')) ? p : best
  )
  return countryMap.get(latest?.country_id) ?? null
}

// ── 7. Zbuduj CSV ─────────────────────────────────────────────────────────────
function csvEscape(val) {
  if (val == null || val === '') return ''
  const str = String(val)
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

const header = ['Nazwa klubu', 'Miasto', 'Kraj', 'Rok założenia']
const rows = clubs.map(c => [
  c.name,
  c.club_city_id ? (cityMap.get(c.club_city_id) ?? '') : '',
  c.club_city_id ? (getCurrentCountry(c.club_city_id) ?? '') : '',
  foundedMap.has(c.id) ? foundedMap.get(c.id).slice(0, 4) : '',
])

const csvLines = [header, ...rows].map(row => row.map(csvEscape).join(','))
// UTF-8 BOM dla Excela
const BOM = '\uFEFF'
const csvContent = BOM + csvLines.join('\r\n')

writeFileSync(outPath, csvContent, 'utf8')
console.log(`\nEksport gotowy: ${outPath}`)
console.log(`Wierszy danych: ${rows.length}`)
