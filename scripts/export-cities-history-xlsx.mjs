import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const OUTPUT_PATH = resolve(process.cwd(), 'exports', 'cities_history_export.xlsx')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

function normalizeDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function formatPeriod(period) {
  const from = normalizeDate(period.valid_from)
  const to = normalizeDate(period.valid_to)

  if (!from && !to) return `${period.countryName}`
  if (from && !to) return `${period.countryName} (od ${from})`
  if (!from && to) return `${period.countryName} (do ${to})`
  return `${period.countryName} (${from} - ${to})`
}

function sortPeriods(a, b) {
  const aFrom = normalizeDate(a.valid_from)
  const bFrom = normalizeDate(b.valid_from)

  if (aFrom && bFrom && aFrom !== bFrom) return aFrom.localeCompare(bFrom)
  if (aFrom && !bFrom) return 1
  if (!aFrom && bFrom) return -1

  const aTo = normalizeDate(a.valid_to)
  const bTo = normalizeDate(b.valid_to)
  if (aTo && bTo && aTo !== bTo) return aTo.localeCompare(bTo)
  if (aTo && !bTo) return -1
  if (!aTo && bTo) return 1

  return a.countryName.localeCompare(b.countryName, 'pl')
}

async function main() {
  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const [{ data: cities, error: citiesError }, { data: periods, error: periodsError }, { data: countries, error: countriesError }] = await Promise.all([
    supabase.from('tbl_Cities').select('id, city_name').order('city_name', { ascending: true }),
    supabase.from('tbl_City_Country_Periods').select('city_id, country_id, valid_from, valid_to'),
    supabase.from('tbl_Countries').select('id, name'),
  ])

  if (citiesError) throw new Error(`Failed loading cities: ${citiesError.message}`)
  if (periodsError) throw new Error(`Failed loading city-country periods: ${periodsError.message}`)
  if (countriesError) throw new Error(`Failed loading countries: ${countriesError.message}`)

  const countryNameById = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const periodsByCityId = new Map()

  for (const p of periods ?? []) {
    const countryName = countryNameById.get(p.country_id) ?? 'Nieznany kraj'
    const item = {
      city_id: p.city_id,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
      countryName,
    }
    const list = periodsByCityId.get(p.city_id) ?? []
    list.push(item)
    periodsByCityId.set(p.city_id, list)
  }

  const rows = (cities ?? []).map((city) => {
    const allPeriods = [...(periodsByCityId.get(city.id) ?? [])]
    const hasDatedPeriod = allPeriods.some((p) => p.valid_from !== null || p.valid_to !== null)
    const filteredPeriods = hasDatedPeriod
      ? allPeriods.filter((p) => p.valid_from !== null || p.valid_to !== null)
      : allPeriods

    const history = filteredPeriods
      .sort(sortPeriods)
      .map(formatPeriod)
      .join('; ')

    return {
      Miasto: city.city_name,
      'Kraje (historia przynaleznosci)': history || '—',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Miasta')

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  XLSX.writeFile(wb, OUTPUT_PATH)

  console.log(`Exported ${rows.length} rows to ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
