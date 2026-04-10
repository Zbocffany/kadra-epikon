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
  country_fifa_code: string | null
  matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
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

type StadiumVsPolandStat = {
  matches: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
}

async function getStadiumVsPolandStats(
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<Map<string, StadiumVsPolandStat>> {
  const empty = new Map<string, StadiumVsPolandStat>()

  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()
  if (!polandCountry) return empty

  const { data: polandTeam } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', polandCountry.id)
    .is('club_id', null)
    .maybeSingle()
  if (!polandTeam) return empty

  const polandTeamId = (polandTeam as { id: string }).id

  // Fetch all Poland matches with a stadium assigned (no .in() on stadiumIds to avoid URL length limit)
  const [{ data: homeMatches }, { data: awayMatches }] = await Promise.all([
    supabase
      .from('tbl_Matches')
      .select('id, match_stadium_id, home_team_id, away_team_id')
      .eq('match_status', 'FINISHED')
      .in('editorial_status', ['COMPLETE', 'VERIFIED'])
      .eq('home_team_id', polandTeamId)
      .not('match_stadium_id', 'is', null),
    supabase
      .from('tbl_Matches')
      .select('id, match_stadium_id, home_team_id, away_team_id')
      .eq('match_status', 'FINISHED')
      .in('editorial_status', ['COMPLETE', 'VERIFIED'])
      .eq('away_team_id', polandTeamId)
      .not('match_stadium_id', 'is', null),
  ])

  const allMatches = [...(homeMatches ?? []), ...(awayMatches ?? [])]
  if (!allMatches.length) return empty

  const matchIds = allMatches.map((m) => m.id as string)

  const CHUNK_SIZE = 80
  const allEvents: Array<{ match_id: string; team_id: string | null; event_type: string }> = []
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Events')
      .select('match_id, team_id, event_type')
      .in('match_id', matchIds.slice(i, i + CHUNK_SIZE))
      .in('event_type', ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'])
    if (error) throw new Error(`tbl_Match_Events: ${error.message}`)
    allEvents.push(...((data ?? []) as typeof allEvents))
  }

  const eventsByMatch = new Map<string, Array<{ team_id: string | null; event_type: string }>>()
  for (const e of allEvents) {
    const arr = eventsByMatch.get(e.match_id) ?? []
    arr.push({ team_id: e.team_id, event_type: e.event_type })
    eventsByMatch.set(e.match_id, arr)
  }

  const result = new Map<string, StadiumVsPolandStat>()

  for (const match of allMatches) {
    const stadiumId = match.match_stadium_id as string
    const isPolandHome = (match.home_team_id as string) === polandTeamId

    let homeGoals = 0
    let awayGoals = 0
    for (const e of eventsByMatch.get(match.id as string) ?? []) {
      if (e.team_id === match.home_team_id) homeGoals++
      else if (e.team_id === match.away_team_id) awayGoals++
    }

    const polandGoals = isPolandHome ? homeGoals : awayGoals
    const opponentGoals = isPolandHome ? awayGoals : homeGoals

    const stat = result.get(stadiumId) ?? { matches: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 }
    stat.matches++
    stat.goals_for += polandGoals
    stat.goals_against += opponentGoals
    if (polandGoals > opponentGoals) stat.wins++
    else if (polandGoals === opponentGoals) stat.draws++
    else stat.losses++
    result.set(stadiumId, stat)
  }

  return result
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
      country_fifa_code: null,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
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
  const countryMap = await getCountryDetailsMap(countryIds)

  const statsMap = await getStadiumVsPolandStats(supabase)

  return stadiums.map((stadium) => {
    const cityId = stadium.stadium_city_id
    const countryId = cityId ? currentCountryByCity.get(cityId) : null
    const countryDetails = countryId ? countryMap.get(countryId) : null
    const s = statsMap.get(stadium.id)

    return {
      id: stadium.id,
      name: stadium.name,
      stadium_city_id: cityId,
      city_name: cityId ? (cityMap.get(cityId) ?? null) : null,
      country_name: countryDetails?.name ?? null,
      country_fifa_code: countryDetails?.fifa_code ?? null,
      matches: s?.matches ?? 0,
      wins: s?.wins ?? 0,
      draws: s?.draws ?? 0,
      losses: s?.losses ?? 0,
      goals_for: s?.goals_for ?? 0,
      goals_against: s?.goals_against ?? 0,
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
        country_fifa_code: null,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
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
        country_fifa_code: null,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
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
