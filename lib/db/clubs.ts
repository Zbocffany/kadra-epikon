import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type AdminClub = {
  id: string
  name: string
  city_name: string | null
  country_name: string | null
}

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
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

async function getCityCountryPeriodsByCityIds(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cityIds: string[]
): Promise<CityCountryPeriod[]> {
  if (!cityIds.length) return []

  const periods: CityCountryPeriod[] = []
  const batchSize = 250

  for (let start = 0; start < cityIds.length; start += batchSize) {
    const cityIdsBatch = cityIds.slice(start, start + batchSize)
    const { data: periodsBatch, error: periodsError } = await supabase
      .from('tbl_City_Country_Periods')
      .select('city_id, country_id, valid_from, valid_to')
      .in('city_id', cityIdsBatch)

    if (periodsError) {
      throw new Error(`tbl_City_Country_Periods: ${periodsError.message}`)
    }

    if (periodsBatch?.length) {
      periods.push(...periodsBatch)
    }
  }

  return periods
}

export type AdminClubDetails = {
  id: string
  name: string
  club_city_id: string | null
  city_name: string | null
  country_name: string | null
  stadium_id: string | null
  stadium_name: string | null
}

export type AdminCity = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
}

export const CLUB_HISTORY_EVENT_TYPES = [
  { value: 'FOUNDED', label: 'Założenie / Poczatek' },
  { value: 'DISSOLVED', label: 'Rozwiązanie / Koniec' },
  { value: 'NAME_CHANGED', label: 'Zmiana nazwy' },
  { value: 'RELOCATED', label: 'Relokacja' },
  { value: 'MERGED', label: 'Połączenie' },
  { value: 'REFORMED', label: 'Reaktywacja' },
] as const

export type ClubHistoryEventType = typeof CLUB_HISTORY_EVENT_TYPES[number]['value']

export type AdminClubHistoryEvent = {
  id: string
  event_date: string | null
  event_date_precision: 'YEAR' | 'MONTH' | 'DAY' | null
  title: string | null
  description: string | null
  event_type: ClubHistoryEventType | null
  event_order: number | null
}

export async function getAdminClubs(): Promise<AdminClub[]> {
  const supabase = createServiceRoleClient()

  const { data: clubs, error: clubsError } = await supabase
    .from('tbl_Clubs')
    .select('id, name, club_city_id')
    .order('name', { ascending: true })

  if (clubsError) throw new Error(`tbl_Clubs: ${clubsError.message}`)
  if (!clubs?.length) return []

  const cityIds = [...new Set(clubs.map((c) => c.club_city_id).filter(Boolean))]

  if (!cityIds.length) {
    return clubs.map((c) => ({ id: c.id, name: c.name, city_name: null, country_name: null }))
  }

  const [
    { data: cities, error: citiesError },
    periods,
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds),
    getCityCountryPeriodsByCityIds(supabase, cityIds),
  ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const list = periodsByCity.get(period.city_id) ?? []
    list.push(period)
    periodsByCity.set(period.city_id, list)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const current = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (current?.country_id) {
      currentCountryIdByCity.set(cityId, current.country_id)
    }
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryMap = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return clubs.map((c) => ({
    id: c.id,
    name: c.name,
    city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
    country_name: c.club_city_id
      ? ((currentCountryIdByCity.get(c.club_city_id)
        ? countryMap.get(currentCountryIdByCity.get(c.club_city_id) as string)
        : null) ?? null)
      : null,
  }))
}

export async function getAdminClubsPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminClub>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: clubs, error: clubsError, count } = await supabase
    .from('tbl_Clubs')
    .select('id, name, club_city_id', { count: 'exact' })
    .order('name', { ascending: true })
    .range(from, to)

  if (clubsError) throw new Error(`tbl_Clubs: ${clubsError.message}`)
  if (!clubs?.length) return { items: [], total: count ?? 0 }

  const cityIds = [...new Set(clubs.map((c) => c.club_city_id).filter(Boolean))]

  if (!cityIds.length) {
    return {
      items: clubs.map((c) => ({ id: c.id, name: c.name, city_name: null, country_name: null })),
      total: count ?? 0,
    }
  }

  const [
    { data: cities, error: citiesError },
    periods,
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds),
    getCityCountryPeriodsByCityIds(supabase, cityIds),
  ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const list = periodsByCity.get(period.city_id) ?? []
    list.push(period)
    periodsByCity.set(period.city_id, list)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const current = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (current?.country_id) {
      currentCountryIdByCity.set(cityId, current.country_id)
    }
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryMap = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return {
    items: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
      country_name: c.club_city_id
        ? ((currentCountryIdByCity.get(c.club_city_id)
          ? countryMap.get(currentCountryIdByCity.get(c.club_city_id) as string)
          : null) ?? null)
        : null,
    })),
    total: count ?? 0,
  }
}

export async function getAdminCities(): Promise<AdminCity[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((c) => c.id)

  const periods = await getCityCountryPeriodsByCityIds(supabase, cityIds)

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const list = periodsByCity.get(period.city_id) ?? []
    list.push(period)
    periodsByCity.set(period.city_id, list)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const current = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (current?.country_id) {
      currentCountryIdByCity.set(cityId, current.country_id)
    }
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryMap = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return cities.map((c) => {
    const countryId = currentCountryIdByCity.get(c.id) ?? null
    return {
      id: c.id,
      city_name: c.city_name,
      current_country_id: countryId,
      current_country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
    }
  })
}

export async function getAdminClubDetails(
  id: string
): Promise<AdminClubDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: club, error: clubError } = await supabase
    .from('tbl_Clubs')
    .select('id, name, club_city_id, stadium_id')
    .eq('id', id)
    .maybeSingle()

  if (clubError) throw new Error(`tbl_Clubs: ${clubError.message}`)
  if (!club) return null

  if (!club.club_city_id) {
    return {
      id: club.id,
      name: club.name,
      club_city_id: null,
      city_name: null,
      country_name: null,
      stadium_id: club.stadium_id ?? null,
      stadium_name: null,
    }
  }

  const [
    { data: city, error: cityError },
    { data: periods, error: periodError },
    { data: stadium, error: stadiumError },
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .eq('id', club.club_city_id)
      .maybeSingle(),
    supabase
      .from('tbl_City_Country_Periods')
      .select('country_id, valid_from, valid_to')
      .eq('city_id', club.club_city_id),
    club.stadium_id
      ? supabase
          .from('tbl_Stadiums')
          .select('name')
          .eq('id', club.stadium_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null, error: null }),
  ])

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (periodError) {
    throw new Error(`tbl_City_Country_Periods: ${periodError.message}`)
  }
  if (stadiumError) throw new Error(`tbl_Stadiums: ${stadiumError.message}`)

  const sortedPeriods = [...(periods ?? [])].sort((a, b) => {
    // Prefer current assignment (valid_to is null), otherwise newest period.
    const aCurrent = a.valid_to === null
    const bCurrent = b.valid_to === null

    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1

    const aTo = a.valid_to ? new Date(a.valid_to).getTime() : Number.NEGATIVE_INFINITY
    const bTo = b.valid_to ? new Date(b.valid_to).getTime() : Number.NEGATIVE_INFINITY
    if (aTo !== bTo) return bTo - aTo

    const aFrom = a.valid_from
      ? new Date(a.valid_from).getTime()
      : Number.NEGATIVE_INFINITY
    const bFrom = b.valid_from
      ? new Date(b.valid_from).getTime()
      : Number.NEGATIVE_INFINITY
    return bFrom - aFrom
  })

  const countryId = sortedPeriods[0]?.country_id ?? null
  let countryName: string | null = null

  if (countryId) {
    const { data: country, error: countryError } = await supabase
      .from('tbl_Countries')
      .select('name')
      .eq('id', countryId)
      .maybeSingle()

    if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
    countryName = country?.name ?? null
  }

  return {
    id: club.id,
    name: club.name,
    club_city_id: club.club_city_id,
    city_name: city?.city_name ?? null,
    country_name: countryName,
    stadium_id: club.stadium_id ?? null,
    stadium_name: stadium?.name ?? null,
  }
}

export async function getClubHistory(
  clubId: string
): Promise<AdminClubHistoryEvent[]> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('tbl_Club_History')
    .select('id, event_date, event_date_precision, title, description, event_type, event_order')
    .eq('club_id', clubId)
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('event_order', { ascending: false, nullsFirst: false })

  if (error) throw new Error(`tbl_Club_History: ${error.message}`)
  return data ?? []
}

