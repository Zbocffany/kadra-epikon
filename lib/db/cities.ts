import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

type CityCountryPeriod = {
  id?: string
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type AdminCityListItem = {
  id: string
  city_name: string | null
  country_name: string | null
}

export type AdminCountryOption = {
  id: string
  name: string
}

export type AdminCityDetails = {
  id: string
  city_name: string | null
  current_country_id: string | null
  current_period_id: string | null
  country_name: string | null
  voivodeship: string | null
}

function sortPeriods(periods: CityCountryPeriod[]): CityCountryPeriod[] {
  return [...periods].sort((a, b) => {
    const aCurrent = a.valid_to === null
    const bCurrent = b.valid_to === null

    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1

    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo

    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })
}

export async function getAdminCitiesList(): Promise<AdminCityListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((c) => c.id)

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('city_id, country_id, valid_from, valid_to')
    .in('city_id', cityIds)

  if (periodsError) {
    throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const p of periods ?? []) {
    const arr = periodsByCity.get(p.city_id) ?? []
    arr.push(p)
    periodsByCity.set(p.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const best = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (best?.country_id) currentCountryIdByCity.set(cityId, best.country_id)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryMap = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

    countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  }

  return cities.map((city) => {
    const countryId = currentCountryIdByCity.get(city.id)

    return {
      id: city.id,
      city_name: city.city_name,
      country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
    }
  })
}

export async function getAdminCitiesListPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminCityListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: cities, error: citiesError, count } = await supabase
    .from('tbl_Cities')
    .select('id, city_name', { count: 'exact' })
    .order('city_name', { ascending: true })
    .range(from, to)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return { items: [], total: count ?? 0 }

  const cityIds = cities.map((c) => c.id)

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('city_id, country_id, valid_from, valid_to')
    .in('city_id', cityIds)

  if (periodsError) throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const p of periods ?? []) {
    const arr = periodsByCity.get(p.city_id) ?? []
    arr.push(p)
    periodsByCity.set(p.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const best = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (best?.country_id) currentCountryIdByCity.set(cityId, best.country_id)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryMap = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  }

  return {
    items: cities.map((city) => {
      const countryId = currentCountryIdByCity.get(city.id)
      return {
        id: city.id,
        city_name: city.city_name,
        country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
      }
    }),
    total: count ?? 0,
  }
}

export async function getAdminCountriesOptions(): Promise<AdminCountryOption[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Countries')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(`tbl_Countries: ${error.message}`)
  return data ?? []
}

export async function getAdminCityDetails(id: string): Promise<AdminCityDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: city, error: cityError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name, voivodeship')
    .eq('id', id)
    .maybeSingle()

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (!city) return null

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('id, city_id, country_id, valid_from, valid_to')
    .eq('city_id', id)

  if (periodsError) {
    throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
  }

  const best = sortPeriods(periods ?? [])[0]

  let countryName: string | null = null

  if (best?.country_id) {
    const { data: country, error: countryError } = await supabase
      .from('tbl_Countries')
      .select('name')
      .eq('id', best.country_id)
      .maybeSingle()

    if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
    countryName = country?.name ?? null
  }

  return {
    id: city.id,
    city_name: city.city_name,
    current_country_id: best?.country_id ?? null,
    current_period_id: best?.id ?? null,
    country_name: countryName,
    voivodeship: city.voivodeship ?? null,
  }
}
