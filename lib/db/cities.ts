import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type AdminCityListItem = {
  id: string
  city_name: string | null
  country_name: string | null
  country_fifa_code: string | null
  player_count: number
  appearance_count: number
  goal_count: number
}

export type AdminCountryOption = {
  id: string
  name: string
  fifa_code?: string | null
}

export type AdminCityDetails = {
  id: string
  city_name: string | null
  current_country_id: string | null
  country_name: string | null
  country_fifa_code: string | null
  voivodeship: string | null
}

export type AdminCityPeriod = {
  id: string
  city_id: string
  country_id: string
  country_name: string | null
  country_fifa_code: string | null
  valid_from: string | null
  valid_to: string | null
  description: string | null
}

export async function getAdminCitiesList(): Promise<AdminCityListItem[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase.rpc('get_admin_cities_list')
  if (error) throw new Error(`get_admin_cities_list: ${error.message}`)
  return (data ?? []) as AdminCityListItem[]
}

export async function getAdminCitiesListPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminCityListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: cities, error: citiesError, count } = await supabase
    .from('tbl_Cities')
    .select('id, city_name, current_country_id', { count: 'exact' })
    .order('city_name', { ascending: true })
    .range(from, to)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return { items: [], total: count ?? 0 }

  const currentCountryIdByCity = new Map<string, string>()
  for (const c of cities) {
    if (c.current_country_id) currentCountryIdByCity.set(c.id, c.current_country_id)
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
        country_fifa_code: null,
        player_count: 0,
        appearance_count: 0,
        goal_count: 0,
      }
    }),
    total: count ?? 0,
  }
}

export async function getAdminCountriesOptions(): Promise<AdminCountryOption[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .order('name', { ascending: true })

  if (error) throw new Error(`tbl_Countries: ${error.message}`)
  return data ?? []
}

export async function getAdminCityDetails(id: string): Promise<AdminCityDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: city, error: cityError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name, voivodeship, current_country_id')
    .eq('id', id)
    .maybeSingle()

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (!city) return null

  let countryName: string | null = null
  let countryFifaCode: string | null = null

  if (city.current_country_id) {
    const { data: country, error: countryError } = await supabase
      .from('tbl_Countries')
      .select('name, fifa_code')
      .eq('id', city.current_country_id)
      .maybeSingle()

    if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
    countryName = country?.name ?? null
    countryFifaCode = country?.fifa_code ?? null
  }

  // Po migracji 038 źródłem prawdy aktualnego kraju jest tbl_Cities.current_country_id.
  // Formularz edycji aktualnego kraju trafia bezpośrednio do tbl_Cities;
  // spójność z otwartym okresem pilnuje trigger sync_city_current_country.
  return {
    id: city.id,
    city_name: city.city_name,
    current_country_id: city.current_country_id ?? null,
    country_name: countryName,
    country_fifa_code: countryFifaCode,
    voivodeship: city.voivodeship ?? null,
  }
}

export async function getCityCountryPeriods(cityId: string): Promise<AdminCityPeriod[]> {
  const supabase = createServiceRoleClient()

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('id, city_id, country_id, valid_from, valid_to, description')
    .eq('city_id', cityId)

  if (periodsError) throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
  if (!periods?.length) return []

  const countryIds = [...new Set(periods.map((p) => p.country_id))]
  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .in('id', countryIds)

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map((countries ?? []).map((c) => [c.id, c]))

  const sorted = [...periods].sort((a, b) => {
    const aOpen = a.valid_to === null
    const bOpen = b.valid_to === null
    if (aOpen !== bOpen) return aOpen ? -1 : 1
    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo
    const aFrom = a.valid_from ? new Date(a.valid_from).getTime() : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from ? new Date(b.valid_from).getTime() : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })

  return sorted.map((p) => {
    const country = countryMap.get(p.country_id)
    return {
      id: p.id,
      city_id: p.city_id,
      country_id: p.country_id,
      country_name: country?.name ?? null,
      country_fifa_code: country?.fifa_code ?? null,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
      description: (p as Record<string, unknown>).description as string | null ?? null,
    }
  })
}
