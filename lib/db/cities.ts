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
  current_period_id: string | null
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

async function getCityStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personByCityId: Map<string, string[]>
): Promise<Map<string, { player_count: number; appearance_count: number; goal_count: number }>> {
  const allPersonIds = [...new Set([...personByCityId.values()].flat())]
  if (!allPersonIds.length) return new Map()

  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()
  if (!polandCountry) return new Map()

  const { data: polandTeam } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', (polandCountry as { id: string }).id)
    .is('club_id', null)
    .maybeSingle()
  if (!polandTeam) return new Map()

  const polandTeamId = (polandTeam as { id: string }).id

  const CHUNK_SIZE = 80
  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < allPersonIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Participants')
      .select('person_id, match_id, is_starting')
      .eq('role', 'PLAYER')
      .eq('team_id', polandTeamId)
      .in('person_id', allPersonIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allParticipants.push(...((data ?? []) as ParticipantRow[]))
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]

  const allSubEvents: Array<{ match_id: string; secondary_person_id: string }> = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Events')
      .select('match_id, secondary_person_id')
      .eq('event_type', 'SUBSTITUTION')
      .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
      .not('secondary_person_id', 'is', null)
    if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
    allSubEvents.push(...((data ?? []) as Array<{ match_id: string; secondary_person_id: string }>))
  }

  const subEnteredSet = new Set(allSubEvents.map((e) => `${e.match_id}:${e.secondary_person_id}`))
  const playedParticipants = allParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )

  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]

  const allGoalEvents: Array<{ match_id: string; primary_person_id: string }> = []
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Events')
      .select('match_id, primary_person_id')
      .in('event_type', ['GOAL', 'PENALTY_GOAL'])
      .in('match_id', playedMatchIds.slice(i, i + CHUNK_SIZE))
      .not('primary_person_id', 'is', null)
    if (error) throw new Error(`tbl_Match_Events (goals): ${error.message}`)
    allGoalEvents.push(...((data ?? []) as Array<{ match_id: string; primary_person_id: string }>))
  }

  const cityByPersonId = new Map<string, string>()
  for (const [cityId, personIds] of personByCityId) {
    for (const personId of personIds) cityByPersonId.set(personId, cityId)
  }

  const statsMap = new Map<string, { players: Set<string>; appearances: number; goals: number }>()

  for (const p of playedParticipants) {
    const cityId = cityByPersonId.get(p.person_id)
    if (!cityId) continue
    const s = statsMap.get(cityId) ?? { players: new Set(), appearances: 0, goals: 0 }
    s.players.add(p.person_id)
    s.appearances++
    statsMap.set(cityId, s)
  }

  const playedPersonSet = new Set(playedParticipants.map((p) => p.person_id))
  for (const e of allGoalEvents) {
    if (!e.primary_person_id || !playedPersonSet.has(e.primary_person_id)) continue
    const cityId = cityByPersonId.get(e.primary_person_id)
    if (!cityId) continue
    const s = statsMap.get(cityId)
    if (s) s.goals++
  }

  return new Map(
    [...statsMap.entries()].map(([cityId, s]) => [
      cityId,
      { player_count: s.players.size, appearance_count: s.appearances, goal_count: s.goals },
    ])
  )
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

  const periods = await getCityCountryPeriodsByCityIds(supabase, cityIds)

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const p of periods) {
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
  let countryFifaCodeMap = new Map<string, string | null>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

    countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
    countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code ?? null]))
  }

  // Pobieramy WSZYSTKICH ludzi z ustawionym birth_city_id i filtrujemy w JS.
  // Nie używamy .in('birth_city_id', cityIds) bo cityIds może mieć setki UUID-ów i przekraczać limit URL PostgREST.
  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, birth_city_id')
    .not('birth_city_id', 'is', null)

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)

  const cityIdSet = new Set(cityIds)
  const personByCityId = new Map<string, string[]>()
  for (const p of people ?? []) {
    if (!p.birth_city_id || !cityIdSet.has(p.birth_city_id)) continue
    const arr = personByCityId.get(p.birth_city_id) ?? []
    arr.push(p.id)
    personByCityId.set(p.birth_city_id, arr)
  }

  const stats = await getCityStats(supabase, personByCityId)

  return cities.map((city) => {
    const countryId = currentCountryIdByCity.get(city.id)
    const s = stats.get(city.id)

    return {
      id: city.id,
      city_name: city.city_name,
      country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
      country_fifa_code: countryId ? (countryFifaCodeMap.get(countryId) ?? null) : null,
      player_count: s?.player_count ?? 0,
      appearance_count: s?.appearance_count ?? 0,
      goal_count: s?.goal_count ?? 0,
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

  const periods = await getCityCountryPeriodsByCityIds(supabase, cityIds)

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const p of periods) {
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
  let countryFifaCode: string | null = null

  if (best?.country_id) {
    const { data: country, error: countryError } = await supabase
      .from('tbl_Countries')
      .select('name, fifa_code')
      .eq('id', best.country_id)
      .maybeSingle()

    if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
    countryName = country?.name ?? null
    countryFifaCode = country?.fifa_code ?? null
  }

  return {
    id: city.id,
    city_name: city.city_name,
    current_country_id: best?.country_id ?? null,
    current_period_id: best?.id ?? null,
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
