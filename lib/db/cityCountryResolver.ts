// Wspólny resolver historycznej i aktualnej przynależności miasta do kraju.
// Używany przez warstwę people (birth_date), clubs (data założenia) oraz potencjalnie
// inne miejsca, które chcą rozróżnić "kraj w momencie zdarzenia" vs "kraj aktualny".
//
// Konwencja "KRAJ_HISTORYCZNY (KRAJ_AKTUALNY)" — gdy historyczny i aktualny są równe,
// wyświetlamy tylko jeden kod (komponent UI sam to wykrywa po porównaniu id).

import { createServiceRoleClient } from '@/lib/supabase/server'

export type CityCountryPeriodRow = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type CountryInfo = {
  id: string
  name: string | null
  fifa_code: string | null
}

export type ResolvedCityCountry = {
  historical_country_id: string | null
  historical_country_name: string | null
  historical_country_fifa_code: string | null
  current_country_id: string | null
  current_country_name: string | null
  current_country_fifa_code: string | null
}

export const EMPTY_RESOLVED_CITY_COUNTRY: ResolvedCityCountry = {
  historical_country_id: null,
  historical_country_name: null,
  historical_country_fifa_code: null,
  current_country_id: null,
  current_country_name: null,
  current_country_fifa_code: null,
}

function pickCurrentPeriod(periods: CityCountryPeriodRow[]): CityCountryPeriodRow | null {
  if (!periods.length) return null
  // current = jedyny okres z valid_to = NULL; fallback = ten z najpóźniejszą datą.
  const open = periods.find((p) => p.valid_to === null)
  if (open) return open
  return [...periods].sort((a, b) => {
    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : 0
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : 0
    if (aTo !== bTo) return bTo - aTo
    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : 0
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : 0
    return bFrom - aFrom
  })[0] ?? null
}

function pickPeriodForDate(
  periods: CityCountryPeriodRow[],
  referenceDate: string | null
): CityCountryPeriodRow | null {
  if (!referenceDate || !periods.length) return null
  const ref = new Date(referenceDate).getTime()
  if (Number.isNaN(ref)) return null
  // Pasujący okres: valid_from <= ref <= COALESCE(valid_to, +∞)
  for (const p of periods) {
    const from = p.valid_from ? new Date(p.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const to = p.valid_to ? new Date(p.valid_to).getTime() : Number.POSITIVE_INFINITY
    if (ref >= from && ref <= to) return p
  }
  return null
}

/**
 * Resolve historical + current country for a city.
 *
 * @param periods   Wszystkie okresy dla DANEGO miasta (zewnętrznie wyfiltrowane po city_id).
 * @param referenceDate  Data zdarzenia (birth_date / founded_date). Może być null —
 *                       wtedy historyczny = aktualny.
 * @param countryMap  Mapa country_id → { name, fifa_code } (sumarycznie ze wszystkich okresów).
 * @param cityFallbackCountryId  Bezpośredni fallback (np. tbl_People.birth_country_id) używany
 *                               gdy nie ma żadnego okresu dla miasta. Może być null.
 */
export function resolveCityCountry(
  periods: CityCountryPeriodRow[],
  referenceDate: string | null,
  countryMap: Map<string, CountryInfo>,
  cityFallbackCountryId: string | null = null,
): ResolvedCityCountry {
  const current = pickCurrentPeriod(periods)
  const historical = pickPeriodForDate(periods, referenceDate) ?? current

  if (!current && !historical) {
    // Brak okresów — użyj fallbacku (np. birth_country_id z tbl_People) jako obu wartości.
    if (cityFallbackCountryId) {
      const info = countryMap.get(cityFallbackCountryId)
      return {
        historical_country_id: cityFallbackCountryId,
        historical_country_name: info?.name ?? null,
        historical_country_fifa_code: info?.fifa_code ?? null,
        current_country_id: cityFallbackCountryId,
        current_country_name: info?.name ?? null,
        current_country_fifa_code: info?.fifa_code ?? null,
      }
    }
    return EMPTY_RESOLVED_CITY_COUNTRY
  }

  const currentInfo = current ? countryMap.get(current.country_id) : null
  const historicalInfo = historical ? countryMap.get(historical.country_id) : null

  return {
    historical_country_id: historical?.country_id ?? null,
    historical_country_name: historicalInfo?.name ?? null,
    historical_country_fifa_code: historicalInfo?.fifa_code ?? null,
    current_country_id: current?.country_id ?? null,
    current_country_name: currentInfo?.name ?? null,
    current_country_fifa_code: currentInfo?.fifa_code ?? null,
  }
}

/**
 * Bulk loader: dla podanego zbioru city_id zwraca Map<city_id, periods[]>.
 * Periods są zwracane "raw", bez sortowania — resolver sam wybiera odpowiedni okres.
 */
export async function loadCityCountryPeriodsMap(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cityIds: string[]
): Promise<Map<string, CityCountryPeriodRow[]>> {
  const map = new Map<string, CityCountryPeriodRow[]>()
  if (!cityIds.length) return map

  const BATCH = 250
  for (let i = 0; i < cityIds.length; i += BATCH) {
    const chunk = cityIds.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('tbl_City_Country_Periods')
      .select('city_id, country_id, valid_from, valid_to')
      .in('city_id', chunk)
    if (error) throw new Error(`tbl_City_Country_Periods: ${error.message}`)
    for (const row of (data ?? []) as CityCountryPeriodRow[]) {
      const list = map.get(row.city_id)
      if (list) list.push(row)
      else map.set(row.city_id, [row])
    }
  }
  return map
}

/**
 * Bulk loader: dla podanego zbioru country_id zwraca Map<id, { name, fifa_code }>.
 */
export async function loadCountryInfoMap(
  supabase: ReturnType<typeof createServiceRoleClient>,
  countryIds: string[]
): Promise<Map<string, CountryInfo>> {
  const map = new Map<string, CountryInfo>()
  if (!countryIds.length) return map
  const unique = [...new Set(countryIds.filter(Boolean))]
  const BATCH = 250
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', chunk)
    if (error) throw new Error(`tbl_Countries (resolver): ${error.message}`)
    for (const row of (data ?? []) as CountryInfo[]) {
      map.set(row.id, row)
    }
  }
  return map
}

export type CityCountryTimelineEntry = {
  country_id: string
  country_name: string | null
  country_fifa_code: string | null
  valid_from: string | null
  valid_to: string | null
}

/**
 * Buduje chronologiczny timeline przynależności miasta do krajów.
 *
 * @param periods    Wszystkie okresy dla danego miasta (wyfiltrowane po city_id).
 * @param countryMap Mapa country_id → { name, fifa_code }.
 * @param sinceDate  Jeśli podany, pomija okresy zakończone PRZED tą datą
 *                   (np. dla osoby = birth_date; dla klubu = data założenia).
 *                   Null = brak filtra (pełna historia).
 *
 * Kolejność wyniku: chronologicznie od najstarszego do najnowszego —
 * (valid_from NULLS FIRST), potem (valid_to NULLS LAST).
 *
 * UWAGA: nie deduplikujemy globalnie po country_id. Jeśli miasto wracało
 * do tego samego kraju po okresie pośrednim, każdy okres musi pozostać
 * osobnym wpisem, bo inaczej psuje się kolejność i zakresy dat.
 */
export function buildCityCountryTimeline(
  periods: CityCountryPeriodRow[],
  countryMap: Map<string, CountryInfo>,
  sinceDate: string | null = null,
): CityCountryTimelineEntry[] {
  if (!periods.length) return []

  const sinceTs = sinceDate ? new Date(sinceDate).getTime() : null
  const validSince = sinceTs !== null && !Number.isNaN(sinceTs) ? sinceTs : null

  const filtered = validSince === null
    ? periods
    : periods.filter((p) => {
        if (p.valid_to === null) return true
        const to = new Date(p.valid_to).getTime()
        if (Number.isNaN(to)) return true
        return to >= validSince
      })

  const sorted = [...filtered].sort((a, b) => {
    // valid_from NULLS FIRST (otwarty początek = najstarszy znany).
    const aFromNull = a.valid_from === null
    const bFromNull = b.valid_from === null
    if (aFromNull !== bFromNull) return aFromNull ? -1 : 1
    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : 0
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : 0
    if (aFrom !== bFrom) return aFrom - bFrom
    // valid_to NULLS LAST (otwarty koniec = najnowszy).
    const aToNull = a.valid_to === null
    const bToNull = b.valid_to === null
    if (aToNull !== bToNull) return aToNull ? 1 : -1
    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : 0
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : 0
    return aTo - bTo
  })

  return sorted.map((p) => {
    const info = countryMap.get(p.country_id)
    return {
      country_id: p.country_id,
      country_name: info?.name ?? null,
      country_fifa_code: info?.fifa_code ?? null,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
    }
  })
}
