import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type AdminClub = {
  id: string
  name: string
  city_name: string | null
  country_name: string | null
  country_fifa_code: string | null
  player_count: number
  appearance_count: number
  goal_count: number
}

type ClubParticipantRow = {
  person_id: string
  match_id: string
  is_starting: boolean | null
  club_team_id: string
}

async function getClubStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  clubIds: string[]
): Promise<Map<string, { player_count: number; appearance_count: number; goal_count: number }>> {
  if (!clubIds.length) return new Map()

  // Find Poland's team ID
  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()
  if (!polandCountry) return new Map()

  const { data: polandTeam } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', polandCountry.id)
    .maybeSingle()
  if (!polandTeam) return new Map()

  const polandTeamId = polandTeam.id

  const { data: teams, error: teamsError } = await supabase
    .from('tbl_Teams')
    .select('id, club_id')
    .in('club_id', clubIds)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)

  const teamRows = (teams ?? []) as Array<{ id: string; club_id: string }>
  if (!teamRows.length) return new Map()

  const clubIdByTeamId = new Map(teamRows.map((t) => [t.id, t.club_id]))
  const teamIds = [...clubIdByTeamId.keys()]

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  const allParticipants: ClubParticipantRow[] = []
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting, club_team_id')
        .eq('role', 'PLAYER')
        .eq('team_id', polandTeamId)
        .in('club_team_id', teamIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
      const rows = (data ?? []) as ClubParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]

  const allSubEvents: Array<{ match_id: string; secondary_person_id: string }> = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
      const rows = (data ?? []) as Array<{ match_id: string; secondary_person_id: string }>
      allSubEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const subEnteredSet = new Set(allSubEvents.map((e) => `${e.match_id}:${e.secondary_person_id}`))
  const playedParticipants = allParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )

  const matchPersonToTeamId = new Map<string, string>()
  for (const p of playedParticipants) {
    matchPersonToTeamId.set(`${p.match_id}:${p.person_id}`, p.club_team_id)
  }

  const allGoalEvents: Array<{ match_id: string; primary_person_id: string }> = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id')
        .in('event_type', ['GOAL', 'PENALTY_GOAL'])
        .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
        .not('primary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (goals): ${error.message}`)
      const rows = (data ?? []) as Array<{ match_id: string; primary_person_id: string }>
      allGoalEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const statsMap = new Map<string, { players: Set<string>; appearances: number; goals: number }>()

  for (const p of playedParticipants) {
    const clubId = clubIdByTeamId.get(p.club_team_id)
    if (!clubId) continue
    const s = statsMap.get(clubId) ?? { players: new Set(), appearances: 0, goals: 0 }
    s.players.add(p.person_id)
    s.appearances++
    statsMap.set(clubId, s)
  }

  for (const e of allGoalEvents) {
    const teamId = matchPersonToTeamId.get(`${e.match_id}:${e.primary_person_id}`)
    if (!teamId) continue
    const clubId = clubIdByTeamId.get(teamId)
    if (!clubId) continue
    const s = statsMap.get(clubId)
    if (s) s.goals++
  }

  return new Map(
    [...statsMap.entries()].map(([clubId, s]) => [
      clubId,
      { player_count: s.players.size, appearance_count: s.appearances, goal_count: s.goals },
    ])
  )
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
  country_fifa_code: string | null
  stadium_id: string | null
  stadium_name: string | null
}

export type AdminCity = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
}

export type AdminClubPlayerStat = {
  person_id: string
  person_name: string
  appearance_count: number
  goal_count: number
  assist_count: number
  minute_count: number
}

function buildClubPlayerDisplayName(person: {
  first_name: string | null
  last_name: string | null
  nickname: string | null
}): string {
  const first = person.first_name?.trim() ?? ''
  const last = person.last_name?.trim() ?? ''
  const nickname = person.nickname?.trim() ?? ''
  const fullName = `${first} ${last}`.trim()

  if (fullName) return fullName
  if (nickname) return nickname
  return '—'
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
    const stats = await getClubStats(supabase, clubs.map((c) => c.id))
    return clubs.map((c) => {
      const s = stats.get(c.id)
      return { id: c.id, name: c.name, city_name: null, country_name: null, country_fifa_code: null, player_count: s?.player_count ?? 0, appearance_count: s?.appearance_count ?? 0, goal_count: s?.goal_count ?? 0 }
    })
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
  let countryFifaCodeMap = new Map<string, string | null>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((country) => [country.id, country.name]))
    countryFifaCodeMap = new Map((countries ?? []).map((country) => [country.id, country.fifa_code ?? null]))
  }

  const stats = await getClubStats(supabase, clubs.map((c) => c.id))

  return clubs.map((c) => {
    const countryId = c.club_city_id ? currentCountryIdByCity.get(c.club_city_id) : undefined
    const s = stats.get(c.id)
    return {
      id: c.id,
      name: c.name,
      city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
      country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
      country_fifa_code: countryId ? (countryFifaCodeMap.get(countryId) ?? null) : null,
      player_count: s?.player_count ?? 0,
      appearance_count: s?.appearance_count ?? 0,
      goal_count: s?.goal_count ?? 0,
    }
  })
}

export async function getPublicClubs(): Promise<AdminClub[]> {
  return unstable_cache(
    async () => getAdminClubs(),
    ['public-clubs'],
    {
      revalidate: 3600,
      tags: ['public-clubs'],
    }
  )()
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
      items: clubs.map((c) => ({ id: c.id, name: c.name, city_name: null, country_name: null, country_fifa_code: null, player_count: 0, appearance_count: 0, goal_count: 0 })),
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
  let countryFifaCodeMap = new Map<string, string | null>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryMap = new Map((countries ?? []).map((country) => [country.id, country.name]))
    countryFifaCodeMap = new Map((countries ?? []).map((country) => [country.id, country.fifa_code ?? null]))
  }

  return {
    items: clubs.map((c) => {
      const countryId = c.club_city_id ? currentCountryIdByCity.get(c.club_city_id) : undefined
      return {
        id: c.id,
        name: c.name,
        city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
        country_name: countryId ? (countryMap.get(countryId) ?? null) : null,
        country_fifa_code: countryId ? (countryFifaCodeMap.get(countryId) ?? null) : null,
        player_count: 0,
        appearance_count: 0,
        goal_count: 0,
      }
    }),
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

export async function getPublicClubDetails(id: string): Promise<AdminClubDetails | null> {
  return unstable_cache(
    async () => getAdminClubDetails(id),
    ['public-club-details', id],
    {
      revalidate: 3600,
      tags: ['public-clubs', `public-club:${id}`],
    }
  )()
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
      country_fifa_code: null,
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
  let countryFifaCode: string | null = null

  if (countryId) {
    const { data: country, error: countryError } = await supabase
      .from('tbl_Countries')
      .select('name, fifa_code')
      .eq('id', countryId)
      .maybeSingle()

    if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
    countryName = country?.name ?? null
    countryFifaCode = country?.fifa_code ?? null
  }

  return {
    id: club.id,
    name: club.name,
    club_city_id: club.club_city_id,
    city_name: city?.city_name ?? null,
    country_name: countryName,
    country_fifa_code: countryFifaCode,
    stadium_id: club.stadium_id ?? null,
    stadium_name: stadium?.name ?? null,
  }
}

/**
 * Detailed stats for a single club: unique players, appearances, goals, assists and minutes
 * played for Poland's national team by players representing this club.
 *
 * Minute calculation rule (mirrors getPlayerMinutes in lib/db/people.ts):
 * - Stoppage/added time is NOT counted.
 * - A player entering during added time of a period (minute == period boundary, minute_extra > 0)
 *   earns exactly 1 minute for that period remainder (effectiveEntry = entryMin - 1).
 * - Exit during added time is clamped to the regular period boundary.
 * - Regular match max: 90 min. Extra-time match (EXTRA_TIME, EXTRA_TIME_AND_PENALTIES, GOLDEN_GOAL): 120 min.
 */
export async function getPublicClubDetailStats(clubId: string): Promise<{
  player_count: number
  appearance_count: number
  goal_count: number
  assist_count: number
  minute_count: number
}> {
  return unstable_cache(
    async () => getAdminClubDetailStats(clubId),
    ['public-club-stats', clubId],
    {
      revalidate: 3600,
      tags: ['public-clubs', `public-club:${clubId}`],
    }
  )()
}

export async function getAdminClubDetailStats(clubId: string): Promise<{
  player_count: number
  appearance_count: number
  goal_count: number
  assist_count: number
  minute_count: number
}> {
  const supabase = createServiceRoleClient()
  const CHUNK_SIZE = 80
  const zero = { player_count: 0, appearance_count: 0, goal_count: 0, assist_count: 0, minute_count: 0 }

  const { data: polandCountry } = await supabase.from('tbl_Countries').select('id').ilike('name', 'Polska').maybeSingle()
  if (!polandCountry) return zero
  const { data: polandTeam } = await supabase.from('tbl_Teams').select('id').eq('country_id', polandCountry.id).maybeSingle()
  if (!polandTeam) return zero
  const polandTeamId = polandTeam.id

  const { data: clubTeams, error: teamsError } = await supabase.from('tbl_Teams').select('id').eq('club_id', clubId)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
  const clubTeamIds = (clubTeams ?? []).map((t) => t.id)
  if (!clubTeamIds.length) return zero

  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null }
  const allParticipants: ParticipantRow[] = []
  const PAGE_SIZE = 1000
  for (let i = 0; i < clubTeamIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting')
        .eq('role', 'PLAYER')
        .eq('team_id', polandTeamId)
        .in('club_team_id', clubTeamIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  if (!allParticipants.length) return zero

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]

  // Determine who actually played (started or entered as sub)
  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
      const rows = (data ?? []) as SubEvent[]
      allSubEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const subEnteredSet = new Set(allSubEvents.map((e) => `${e.match_id}:${e.secondary_person_id}`))
  const playedParticipants = allParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  if (!playedParticipants.length) return zero

  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]
  const playedMatchPersonSet = new Set(playedParticipants.map((p) => `${p.match_id}:${p.person_id}`))

  // Goals and assists
  type PrimaryEvent = { match_id: string; primary_person_id: string }
  type SecondaryEvent = { match_id: string; secondary_person_id: string }
  const allGoalEvents: PrimaryEvent[] = []
  const allAssistEvents: SecondaryEvent[] = []
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromG = 0
    while (true) {
      const goalsRes = await supabase.from('tbl_Match_Events').select('match_id, primary_person_id').in('event_type', ['GOAL', 'PENALTY_GOAL']).in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromG, fromG + PAGE_SIZE - 1)
      if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
      allGoalEvents.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
      if ((goalsRes.data ?? []).length < PAGE_SIZE) break
      fromG += PAGE_SIZE
    }
    let fromA = 0
    while (true) {
      const assistsRes = await supabase.from('tbl_Match_Events').select('match_id, secondary_person_id').in('event_type', ['GOAL', 'OWN_GOAL']).in('match_id', batch).not('secondary_person_id', 'is', null).order('id', { ascending: true }).range(fromA, fromA + PAGE_SIZE - 1)
      if (assistsRes.error) throw new Error(`tbl_Match_Events (assists): ${assistsRes.error.message}`)
      allAssistEvents.push(...((assistsRes.data ?? []) as SecondaryEvent[]))
      if ((assistsRes.data ?? []).length < PAGE_SIZE) break
      fromA += PAGE_SIZE
    }
  }

  // Sub-on / sub-off events for minute calculation
  type SubInRow = { match_id: string; secondary_person_id: string; minute: number; minute_extra: number | null }
  type SubOffRow = { match_id: string; primary_person_id: string; minute: number; minute_extra: number | null }
  const allSubInEvents: SubInRow[] = []
  const allSubOffEvents: SubOffRow[] = []
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromIn = 0
    while (true) {
      const subInRes = await supabase.from('tbl_Match_Events').select('match_id, secondary_person_id, minute, minute_extra').eq('event_type', 'SUBSTITUTION').in('match_id', batch).not('secondary_person_id', 'is', null).order('id', { ascending: true }).range(fromIn, fromIn + PAGE_SIZE - 1)
      if (subInRes.error) throw new Error(`tbl_Match_Events (sub-in): ${subInRes.error.message}`)
      allSubInEvents.push(...((subInRes.data ?? []) as SubInRow[]))
      if ((subInRes.data ?? []).length < PAGE_SIZE) break
      fromIn += PAGE_SIZE
    }
    let fromOff = 0
    while (true) {
      const subOffRes = await supabase.from('tbl_Match_Events').select('match_id, primary_person_id, minute, minute_extra').eq('event_type', 'SUBSTITUTION').in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromOff, fromOff + PAGE_SIZE - 1)
      if (subOffRes.error) throw new Error(`tbl_Match_Events (sub-off): ${subOffRes.error.message}`)
      allSubOffEvents.push(...((subOffRes.data ?? []) as SubOffRow[]))
      if ((subOffRes.data ?? []).length < PAGE_SIZE) break
      fromOff += PAGE_SIZE
    }
  }

  // Match result types to determine max duration
  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase.from('tbl_Matches').select('id, result_type').in('id', playedMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches: ${error.message}`)
    for (const m of data ?? []) matchResultTypeMap.set(m.id as string, m.result_type as string | null)
  }

  type SubEntry = { minute: number; extra: number }
  const subInMap = new Map<string, SubEntry>()
  for (const e of allSubInEvents) subInMap.set(`${e.match_id}:${e.secondary_person_id}`, { minute: e.minute, extra: e.minute_extra ?? 0 })
  const subOffMap = new Map<string, SubEntry>()
  for (const e of allSubOffEvents) subOffMap.set(`${e.match_id}:${e.primary_person_id}`, { minute: e.minute, extra: e.minute_extra ?? 0 })

  const player_count = new Set(playedParticipants.map((p) => p.person_id)).size
  const appearance_count = playedParticipants.length

  let goal_count = 0
  for (const e of allGoalEvents) {
    if (playedMatchPersonSet.has(`${e.match_id}:${e.primary_person_id}`)) goal_count++
  }
  let assist_count = 0
  for (const e of allAssistEvents) {
    if (playedMatchPersonSet.has(`${e.match_id}:${e.secondary_person_id}`)) assist_count++
  }

  let minute_count = 0
  for (const p of playedParticipants) {
    const resultType = matchResultTypeMap.get(p.match_id) ?? null
    const hasExtraTime = resultType === 'EXTRA_TIME' || resultType === 'EXTRA_TIME_AND_PENALTIES' || resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90
    const isStarter = p.is_starting === true
    const subOn = isStarter ? null : (subInMap.get(`${p.match_id}:${p.person_id}`) ?? null)
    if (!isStarter && !subOn) continue
    const subOff = subOffMap.get(`${p.match_id}:${p.person_id}`) ?? null
    const entryMin = isStarter ? 0 : subOn!.minute
    const entryExtra = isStarter ? 0 : subOn!.extra
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0
    const effectiveEntry = entryExtra > 0 ? entryMin - 1 : entryMin
    const effectiveExit = Math.min(exitExtra > 0 ? exitMin : exitMin, matchRegularEnd)
    minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }

  return { player_count, appearance_count, goal_count, assist_count, minute_count }
}

export async function getPublicClubPlayerStats(clubId: string): Promise<AdminClubPlayerStat[]> {
  return unstable_cache(
    async () => getAdminClubPlayerStats(clubId),
    ['public-club-player-stats', clubId],
    {
      revalidate: 3600,
      tags: ['public-clubs', `public-club:${clubId}`],
    }
  )()
}

export async function getAdminClubPlayerStats(clubId: string): Promise<AdminClubPlayerStat[]> {
  const supabase = createServiceRoleClient()
  const CHUNK_SIZE = 80

  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()
  if (!polandCountry) return []

  const { data: polandTeam } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', polandCountry.id)
    .maybeSingle()
  if (!polandTeam) return []

  const { data: clubTeams, error: teamsError } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('club_id', clubId)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)

  const clubTeamIds = (clubTeams ?? []).map((team) => team.id)
  if (!clubTeamIds.length) return []

  type ParticipantRow = {
    person_id: string
    match_id: string
    is_starting: boolean | null
    club_team_id: string
  }

  const allParticipants: ParticipantRow[] = []
  const PAGE_SIZE = 1000
  for (let i = 0; i < clubTeamIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting, club_team_id')
        .eq('role', 'PLAYER')
        .eq('team_id', polandTeam.id)
        .in('club_team_id', clubTeamIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) return []

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]

  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', allMatchIds.slice(i, i + CHUNK_SIZE))
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (substitutions): ${error.message}`)
      const rows = (data ?? []) as SubEvent[]
      allSubEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const subEnteredSet = new Set(allSubEvents.map((e) => `${e.match_id}:${e.secondary_person_id}`))
  const playedParticipants = allParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  if (!playedParticipants.length) return []

  const personIds = [...new Set(playedParticipants.map((p) => p.person_id))]
  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]
  const playedMatchPersonSet = new Set(playedParticipants.map((p) => `${p.match_id}:${p.person_id}`))

  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname')
    .in('id', personIds)
  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)

  const statsByPersonId = new Map<string, AdminClubPlayerStat>()
  for (const person of people ?? []) {
    statsByPersonId.set(person.id as string, {
      person_id: person.id as string,
      person_name: buildClubPlayerDisplayName({
        first_name: (person.first_name as string | null | undefined) ?? null,
        last_name: (person.last_name as string | null | undefined) ?? null,
        nickname: (person.nickname as string | null | undefined) ?? null,
      }),
      appearance_count: 0,
      goal_count: 0,
      assist_count: 0,
      minute_count: 0,
    })
  }

  for (const participation of playedParticipants) {
    const entry = statsByPersonId.get(participation.person_id)
    if (entry) entry.appearance_count += 1
  }

  type PrimaryEvent = { match_id: string; primary_person_id: string }
  type SecondaryEvent = { match_id: string; secondary_person_id: string }
  const allGoalEvents: PrimaryEvent[] = []
  const allAssistEvents: SecondaryEvent[] = []

  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromG = 0
    while (true) {
      const goalsRes = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id')
        .in('event_type', ['GOAL', 'PENALTY_GOAL'])
        .in('match_id', batch)
        .not('primary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(fromG, fromG + PAGE_SIZE - 1)
      if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
      allGoalEvents.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
      if ((goalsRes.data ?? []).length < PAGE_SIZE) break
      fromG += PAGE_SIZE
    }
    let fromA = 0
    while (true) {
      const assistsRes = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .in('event_type', ['GOAL', 'OWN_GOAL'])
        .in('match_id', batch)
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(fromA, fromA + PAGE_SIZE - 1)
      if (assistsRes.error) throw new Error(`tbl_Match_Events (assists): ${assistsRes.error.message}`)
      allAssistEvents.push(...((assistsRes.data ?? []) as SecondaryEvent[]))
      if ((assistsRes.data ?? []).length < PAGE_SIZE) break
      fromA += PAGE_SIZE
    }
  }

  for (const event of allGoalEvents) {
    if (!playedMatchPersonSet.has(`${event.match_id}:${event.primary_person_id}`)) continue
    const entry = statsByPersonId.get(event.primary_person_id)
    if (entry) entry.goal_count += 1
  }

  for (const event of allAssistEvents) {
    if (!playedMatchPersonSet.has(`${event.match_id}:${event.secondary_person_id}`)) continue
    const entry = statsByPersonId.get(event.secondary_person_id)
    if (entry) entry.assist_count += 1
  }

  type SubInRow = { match_id: string; secondary_person_id: string; minute: number; minute_extra: number | null }
  type SubOffRow = { match_id: string; primary_person_id: string; minute: number; minute_extra: number | null }
  const allSubInEvents: SubInRow[] = []
  const allSubOffEvents: SubOffRow[] = []

  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromIn = 0
    while (true) {
      const subInRes = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id, minute, minute_extra')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', batch)
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(fromIn, fromIn + PAGE_SIZE - 1)
      if (subInRes.error) throw new Error(`tbl_Match_Events (sub-in): ${subInRes.error.message}`)
      allSubInEvents.push(...((subInRes.data ?? []) as SubInRow[]))
      if ((subInRes.data ?? []).length < PAGE_SIZE) break
      fromIn += PAGE_SIZE
    }
    let fromOff = 0
    while (true) {
      const subOffRes = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id, minute, minute_extra')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', batch)
        .not('primary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(fromOff, fromOff + PAGE_SIZE - 1)
      if (subOffRes.error) throw new Error(`tbl_Match_Events (sub-off): ${subOffRes.error.message}`)
      allSubOffEvents.push(...((subOffRes.data ?? []) as SubOffRow[]))
      if ((subOffRes.data ?? []).length < PAGE_SIZE) break
      fromOff += PAGE_SIZE
    }
  }

  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', playedMatchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches: ${error.message}`)
    for (const match of data ?? []) matchResultTypeMap.set(match.id as string, (match.result_type as string | null | undefined) ?? null)
  }

  type SubEntry = { minute: number; extra: number }
  const subInMap = new Map<string, SubEntry>()
  for (const event of allSubInEvents) {
    subInMap.set(`${event.match_id}:${event.secondary_person_id}`, { minute: event.minute, extra: event.minute_extra ?? 0 })
  }
  const subOffMap = new Map<string, SubEntry>()
  for (const event of allSubOffEvents) {
    subOffMap.set(`${event.match_id}:${event.primary_person_id}`, { minute: event.minute, extra: event.minute_extra ?? 0 })
  }

  for (const participation of playedParticipants) {
    const resultType = matchResultTypeMap.get(participation.match_id) ?? null
    const hasExtraTime = resultType === 'EXTRA_TIME' || resultType === 'EXTRA_TIME_AND_PENALTIES' || resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90
    const isStarter = participation.is_starting === true
    const subOn = isStarter ? null : (subInMap.get(`${participation.match_id}:${participation.person_id}`) ?? null)
    if (!isStarter && !subOn) continue

    const subOff = subOffMap.get(`${participation.match_id}:${participation.person_id}`) ?? null
    const entryMin = isStarter ? 0 : subOn!.minute
    const entryExtra = isStarter ? 0 : subOn!.extra
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0
    const effectiveEntry = entryExtra > 0 ? entryMin - 1 : entryMin
    const effectiveExit = Math.min(exitExtra > 0 ? exitMin : exitMin, matchRegularEnd)

    const entry = statsByPersonId.get(participation.person_id)
    if (entry) entry.minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }

  return [...statsByPersonId.values()]
    .filter((player) => player.appearance_count > 0)
    .sort((a, b) => {
      if (b.appearance_count !== a.appearance_count) return b.appearance_count - a.appearance_count
      if (b.goal_count !== a.goal_count) return b.goal_count - a.goal_count
      if (b.assist_count !== a.assist_count) return b.assist_count - a.assist_count
      if (b.minute_count !== a.minute_count) return b.minute_count - a.minute_count
      return a.person_name.localeCompare(b.person_name, 'pl')
    })
}

export async function getPublicClubHistory(clubId: string): Promise<AdminClubHistoryEvent[]> {
  return unstable_cache(
    async () => getClubHistory(clubId),
    ['public-club-history', clubId],
    {
      revalidate: 3600,
      tags: ['public-clubs', `public-club:${clubId}`],
    }
  )()
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

