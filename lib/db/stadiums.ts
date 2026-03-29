import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type AdminStadiumListItem = {
  id: string
  name: string | null
  stadium_city_id: string | null
  city_name: string | null
  country_name: string | null
}

export type AdminStadiumDetails = {
  id: string
  name: string | null
  stadium_city_id: string | null
  city_name: string | null
  country_name: string | null
  country_fifa_code: string | null
}

export type AdminStadiumOption = {
  id: string
  name: string | null
  stadium_city_id: string | null
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

async function getCurrentCountryIdByCity(
  cityIds: string[]
): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient()

  const { data: periods, error: periodsError } = await supabase
    .from('tbl_City_Country_Periods')
    .select('city_id, country_id, valid_from, valid_to')
    .in('city_id', cityIds)

  if (periodsError) {
    throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods ?? []) {
    const list = periodsByCity.get(period.city_id) ?? []
    list.push(period)
    periodsByCity.set(period.city_id, list)
  }

  const currentCountryByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const current = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (current?.country_id) {
      currentCountryByCity.set(cityId, current.country_id)
    }
  }

  return currentCountryByCity
}

async function getCountryNameMap(countryIds: string[]): Promise<Map<string, string>> {
  if (!countryIds.length) return new Map()

  const supabase = createServiceRoleClient()
  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name')
    .in('id', countryIds)

  if (countriesError) {
    throw new Error(`tbl_Countries: ${countriesError.message}`)
  }

  return new Map((countries ?? []).map((country) => [country.id, country.name]))
}

async function getCountryDetailsMap(
  countryIds: string[]
): Promise<Map<string, { name: string | null; fifa_code: string | null }>> {
  if (!countryIds.length) return new Map()

  const supabase = createServiceRoleClient()
  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .in('id', countryIds)

  if (countriesError) {
    throw new Error(`tbl_Countries: ${countriesError.message}`)
  }

  return new Map(
    (countries ?? []).map((country) => [
      country.id,
      {
        name: country.name ?? null,
        fifa_code: country.fifa_code ?? null,
      },
    ])
  )
}

export async function getAdminStadiums(): Promise<AdminStadiumListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: stadiums, error: stadiumsError } = await supabase
    .from('tbl_Stadiums')
    .select('id, name, stadium_city_id')
    .order('name', { ascending: true })

  if (stadiumsError) throw new Error(`tbl_Stadiums: ${stadiumsError.message}`)
  if (!stadiums?.length) return []

  const cityIds = [...new Set(stadiums.map((s) => s.stadium_city_id).filter(Boolean))]

  if (!cityIds.length) {
    return stadiums.map((stadium) => ({
      id: stadium.id,
      name: stadium.name,
      stadium_city_id: stadium.stadium_city_id,
      city_name: null,
      country_name: null,
    }))
  }

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .in('id', cityIds)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))
  const currentCountryByCity = await getCurrentCountryIdByCity(cityIds)
  const countryIds = [...new Set([...currentCountryByCity.values()])]
  const countryMap = await getCountryNameMap(countryIds)

  return stadiums.map((stadium) => {
    const cityId = stadium.stadium_city_id
    const countryId = cityId ? currentCountryByCity.get(cityId) : null

    return {
      id: stadium.id,
      name: stadium.name,
      stadium_city_id: cityId,
      city_name: cityId ? (cityMap.get(cityId) ?? null) : null,
      country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
    }
  })
}

export async function getAdminStadiumsPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminStadiumListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: stadiums, error: stadiumsError, count } = await supabase
    .from('tbl_Stadiums')
    .select('id, name, stadium_city_id', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  if (stadiumsError) throw new Error(`tbl_Stadiums: ${stadiumsError.message}`)
  if (!stadiums?.length) return { items: [], total: count ?? 0 }

  const cityIds = [...new Set(stadiums.map((s) => s.stadium_city_id).filter(Boolean))]

  if (!cityIds.length) {
    return {
      items: stadiums.map((stadium) => ({
        id: stadium.id,
        name: stadium.name,
        stadium_city_id: stadium.stadium_city_id,
        city_name: null,
        country_name: null,
      })),
      total: count ?? 0,
    }
  }

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .in('id', cityIds)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))
  const currentCountryByCity = await getCurrentCountryIdByCity(cityIds)
  const countryIds = [...new Set([...currentCountryByCity.values()])]
  const countryMap = await getCountryNameMap(countryIds)

  return {
    items: stadiums.map((stadium) => {
      const cityId = stadium.stadium_city_id
      const countryId = cityId ? currentCountryByCity.get(cityId) : null

      return {
        id: stadium.id,
        name: stadium.name,
        stadium_city_id: cityId,
        city_name: cityId ? (cityMap.get(cityId) ?? null) : null,
        country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
      }
    }),
    total: count ?? 0,
  }
}

export async function getAdminStadiumOptions(): Promise<AdminStadiumOption[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Stadiums')
    .select('id, name, stadium_city_id')
    .order('name', { ascending: true })

  if (error) throw new Error(`tbl_Stadiums: ${error.message}`)
  return data ?? []
}

export async function getAdminStadiumDetails(
  id: string
): Promise<AdminStadiumDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: stadium, error: stadiumError } = await supabase
    .from('tbl_Stadiums')
    .select('id, name, stadium_city_id')
    .eq('id', id)
    .maybeSingle()

  if (stadiumError) throw new Error(`tbl_Stadiums: ${stadiumError.message}`)
  if (!stadium) return null

  if (!stadium.stadium_city_id) {
    return {
      id: stadium.id,
      name: stadium.name,
      stadium_city_id: null,
      city_name: null,
      country_name: null,
      country_fifa_code: null,
    }
  }

  const { data: city, error: cityError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .eq('id', stadium.stadium_city_id)
    .maybeSingle()

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)

  const currentCountryByCity = await getCurrentCountryIdByCity([stadium.stadium_city_id])
  const countryId = currentCountryByCity.get(stadium.stadium_city_id)
  const countryMap = await getCountryDetailsMap(countryId ? [countryId] : [])

  return {
    id: stadium.id,
    name: stadium.name,
    stadium_city_id: stadium.stadium_city_id,
    city_name: city?.city_name ?? null,
    country_name: countryId ? (countryMap.get(countryId)?.name ?? null) : null,
    country_fifa_code: countryId ? (countryMap.get(countryId)?.fifa_code ?? null) : null,
  }
}
