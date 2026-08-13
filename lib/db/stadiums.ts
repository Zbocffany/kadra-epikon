import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchAllRows, getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'
import { getPublicCacheKey } from '@/lib/db/publicCache'

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
      .select('id, match_stadium_id, home_team_id, away_team_id, home_goals, away_goals')
      .eq('match_status', 'FINISHED')
      .neq('result_type', 'WALKOVER')
      .eq('editorial_status', 'VERIFIED')
      .eq('home_team_id', polandTeamId)
      .not('match_stadium_id', 'is', null),
    supabase
      .from('tbl_Matches')
      .select('id, match_stadium_id, home_team_id, away_team_id, home_goals, away_goals')
      .eq('match_status', 'FINISHED')
      .neq('result_type', 'WALKOVER')
      .eq('editorial_status', 'VERIFIED')
      .eq('away_team_id', polandTeamId)
      .not('match_stadium_id', 'is', null),
  ])

  const allMatches = [...(homeMatches ?? []), ...(awayMatches ?? [])]
  if (!allMatches.length) return empty

  const result = new Map<string, StadiumVsPolandStat>()

  for (const match of allMatches) {
    const stadiumId = match.match_stadium_id as string
    const isPolandHome = (match.home_team_id as string) === polandTeamId
    const polandGoals = isPolandHome ? match.home_goals : match.away_goals
    const opponentGoals = isPolandHome ? match.away_goals : match.home_goals

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

  type StadiumRow = { id: string; name: string; stadium_city_id: string | null }
  // PostgREST tnie do 1000 wierszy bez .range() — paginujemy całą tabelę.
  const stadiums = await fetchAllRows<StadiumRow>((from, to) =>
    supabase
      .from('tbl_Stadiums')
      .select('id, name, stadium_city_id')
      .order('name', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, to)
  )

  if (!stadiums.length) return []

  const cityIds = [...new Set(stadiums.map((s) => s.stadium_city_id).filter((v): v is string => Boolean(v)))]

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
    .select('id, city_name, current_country_id')
    .in('id', cityIds)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))
  const currentCountryByCity = new Map(
    (cities ?? [])
      .filter((city): city is typeof city & { current_country_id: string } => Boolean(city.current_country_id))
      .map((city) => [city.id, city.current_country_id])
  )
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

export async function getPublicStadiums(): Promise<AdminStadiumListItem[]> {
  const cacheKey = await getPublicCacheKey('public-stadiums')
  return unstable_cache(
    async () => getAdminStadiums(),
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-stadiums'],
    }
  )()
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
    .select('id, city_name, current_country_id')
    .in('id', cityIds)

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))
  const currentCountryByCity = new Map(
    (cities ?? [])
      .filter((city): city is typeof city & { current_country_id: string } => Boolean(city.current_country_id))
      .map((city) => [city.id, city.current_country_id])
  )
  const countryIds = [...new Set([...currentCountryByCity.values()])]
  const countryMap = await getCountryDetailsMap(countryIds)
  const statsMap = await getStadiumVsPolandStats(supabase)

  return {
    items: stadiums.map((stadium) => {
      const cityId = stadium.stadium_city_id
      const countryId = cityId ? currentCountryByCity.get(cityId) : null
      const countryDetails = countryId ? countryMap.get(countryId) : null
      const stats = statsMap.get(stadium.id)

      return {
        id: stadium.id,
        name: stadium.name,
        stadium_city_id: cityId,
        city_name: cityId ? (cityMap.get(cityId) ?? null) : null,
        country_name: countryDetails?.name ?? null,
        country_fifa_code: countryDetails?.fifa_code ?? null,
        matches: stats?.matches ?? 0,
        wins: stats?.wins ?? 0,
        draws: stats?.draws ?? 0,
        losses: stats?.losses ?? 0,
        goals_for: stats?.goals_for ?? 0,
        goals_against: stats?.goals_against ?? 0,
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
    .select('id, city_name, current_country_id')
    .eq('id', stadium.stadium_city_id)
    .maybeSingle()

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)

  const countryId = city?.current_country_id ?? null
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
