import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'
import { getPublicCacheKey } from '@/lib/db/publicCache'
import {
  loadCityCountryPeriodsMap,
  loadCountryInfoMap,
  resolveCityCountry,
  buildCityCountryTimeline,
  type CityCountryTimelineEntry,
} from '@/lib/db/cityCountryResolver'

export type AdminClub = {
  id: string
  name: string
  city_name: string | null
  // Historyczny kraj = w momencie założenia klubu (z tbl_Club_History FOUNDED).
  // Fallback gdy brak FOUNDED = aktualny.
  country_name: string | null
  country_fifa_code: string | null
  country_current_name: string | null
  country_current_fifa_code: string | null
  player_count: number
  appearance_count: number
  goal_count: number
  // Te same statystyki, ale liczone dla zawodników naszych klubów grających
  // przeciw Polsce (w drużynie rywala) w meczach reprezentacji Polski.
  rival_player_count: number
  rival_appearance_count: number
  rival_goal_count: number
  // Rok założenia (tylko rok, np. "1899"), null gdy brak daty FOUNDED.
  founded_year: string | null
}

type ClubParticipantRow = {
  person_id: string
  match_id: string
  is_starting: boolean | null
  club_team_id: string
  team_id: string
}

type ClubStatsBreakdown = {
  poland: { player_count: number; appearance_count: number; goal_count: number }
  rivals: { player_count: number; appearance_count: number; goal_count: number }
}

const EMPTY_CLUB_STATS: ClubStatsBreakdown = {
  poland: { player_count: 0, appearance_count: 0, goal_count: 0 },
  rivals: { player_count: 0, appearance_count: 0, goal_count: 0 },
}

async function getNonWalkoverMatchIdSet(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchIds: string[]
): Promise<Set<string>> {
  if (!matchIds.length) return new Set()

  const CHUNK_SIZE = 80
  const allowedMatchIds = new Set<string>()

  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (walkover filter): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; result_type: string | null }>) {
      if (row.result_type !== 'WALKOVER') {
        allowedMatchIds.add(row.id)
      }
    }
  }

  return allowedMatchIds
}

async function getClubStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  clubIds: string[]
): Promise<Map<string, ClubStatsBreakdown>> {
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

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  const allTeamRows: Array<{ id: string; club_id: string }> = []
  for (let i = 0; i < clubIds.length; i += CHUNK_SIZE) {
    const { data: teams, error: teamsError } = await supabase
      .from('tbl_Teams')
      .select('id, club_id')
      .in('club_id', clubIds.slice(i, i + CHUNK_SIZE))
    if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
    allTeamRows.push(...((teams ?? []) as Array<{ id: string; club_id: string }>))
  }

  const teamRows = allTeamRows
  if (!teamRows.length) return new Map()

  const clubIdByTeamId = new Map(teamRows.map((t) => [t.id, t.club_id]))
  const teamIds = [...clubIdByTeamId.keys()]

  // 1) Wszystkie mecze Polski (potrzebne do filtra dla rywali).
  const polandMatchIdSet = new Set<string>()
  for (const side of ['home_team_id', 'away_team_id'] as const) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Matches')
        .select('id')
        .eq(side, polandTeamId)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Matches (poland ${side}): ${error.message}`)
      const rows = (data ?? []) as Array<{ id: string }>
      for (const r of rows) polandMatchIdSet.add(r.id)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  const polandMatchIds = [...polandMatchIdSet]
  if (!polandMatchIds.length) return new Map()

  // 2) Uczestnicy: gracze (PLAYER) naszych klubów w meczach Polski.
  // Pokrywa zarówno stronę Polski (team_id = polandTeamId) jak i rywali (team_id != polandTeamId).
  const allParticipants: ClubParticipantRow[] = []
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const teamChunk = teamIds.slice(i, i + CHUNK_SIZE)
    for (let j = 0; j < polandMatchIds.length; j += CHUNK_SIZE) {
      const matchChunk = polandMatchIds.slice(j, j + CHUNK_SIZE)
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('tbl_Match_Participants')
          .select('person_id, match_id, is_starting, club_team_id, team_id')
          .eq('role', 'PLAYER')
          .in('club_team_id', teamChunk)
          .in('match_id', matchChunk)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
        const rows = (data ?? []) as ClubParticipantRow[]
        allParticipants.push(...rows)
        if (rows.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
    }
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return new Map()
  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  const allSubEvents: Array<{ match_id: string; secondary_person_id: string }> = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
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
  const playedParticipants = filteredParticipants.filter(
    (p) => p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]

  // (match_id, person_id) -> { club_team_id, team_id } – żeby przy golach wiedzieć i klub, i stronę.
  const matchPersonInfo = new Map<string, { clubTeamId: string; teamId: string }>()
  for (const p of playedParticipants) {
    matchPersonInfo.set(`${p.match_id}:${p.person_id}`, { clubTeamId: p.club_team_id, teamId: p.team_id })
  }

  const allGoalEvents: Array<{ match_id: string; primary_person_id: string }> = []
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id')
        .in('event_type', ['GOAL', 'PENALTY_GOAL'])
        .in('match_id', playedMatchIds.slice(i, i + CHUNK_SIZE))
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

  type Bucket = { players: Set<string>; appearances: number; goals: number }
  const empty = (): Bucket => ({ players: new Set(), appearances: 0, goals: 0 })
  const breakdown = new Map<string, { poland: Bucket; rivals: Bucket }>()

  for (const p of playedParticipants) {
    const clubId = clubIdByTeamId.get(p.club_team_id)
    if (!clubId) continue
    const entry = breakdown.get(clubId) ?? { poland: empty(), rivals: empty() }
    const side = p.team_id === polandTeamId ? entry.poland : entry.rivals
    side.players.add(p.person_id)
    side.appearances++
    breakdown.set(clubId, entry)
  }

  for (const e of allGoalEvents) {
    const info = matchPersonInfo.get(`${e.match_id}:${e.primary_person_id}`)
    if (!info) continue
    const clubId = clubIdByTeamId.get(info.clubTeamId)
    if (!clubId) continue
    const entry = breakdown.get(clubId)
    if (!entry) continue
    const side = info.teamId === polandTeamId ? entry.poland : entry.rivals
    side.goals++
  }

  return new Map(
    [...breakdown.entries()].map(([clubId, { poland, rivals }]) => [
      clubId,
      {
        poland: {
          player_count: poland.players.size,
          appearance_count: poland.appearances,
          goal_count: poland.goals,
        },
        rivals: {
          player_count: rivals.players.size,
          appearance_count: rivals.appearances,
          goal_count: rivals.goals,
        },
      },
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
  founded_year: string | null
  // Historyczny kraj = w momencie założenia klubu (z tbl_Club_History FOUNDED).
  country_name: string | null
  country_fifa_code: string | null
  country_current_name: string | null
  country_current_fifa_code: string | null
  /**
   * Chronologiczna lista państw, do których należało miasto klubu —
   * od daty założenia (jeśli znana) lub pełna historia.
   */
  city_country_timeline: CityCountryTimelineEntry[]
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

// Statystyki zawodnika klubu, ale liczone dla występów PRZECIW Polsce
// (w drużynie rywala) w meczach reprezentacji Polski. Zawodnik mógł
// reprezentować różne kraje na przestrzeni meczów — stąd lista flag.
export type AdminClubRivalPlayerStat = {
  person_id: string
  person_name: string
  appearance_count: number
  goal_count: number
  minute_count: number
  represented_countries: Array<{ country_id: string; name: string; fifa_code: string | null }>
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

  if (fullName && nickname) return nickname
  if (nickname) return nickname
  if (fullName) return fullName
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

// Bulk loader: dla podanego zbioru club_id zwraca Map<club_id, najwcześniejsza data FOUNDED>.
// Klub może mieć wiele FOUNDED (np. REFORMED), ale dla "historycznego kraju" interesuje nas
// pierwsze założenie.
async function getEarliestFoundedDatesByClubIds(
  supabase: ReturnType<typeof createServiceRoleClient>,
  clubIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!clubIds.length) return map
  const BATCH = 250
  for (let i = 0; i < clubIds.length; i += BATCH) {
    const chunk = clubIds.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('tbl_Club_History')
      .select('club_id, event_date')
      .eq('event_type', 'FOUNDED')
      .in('club_id', chunk)
      .not('event_date', 'is', null)
    if (error) throw new Error(`tbl_Club_History (founded): ${error.message}`)
    for (const row of (data ?? []) as Array<{ club_id: string; event_date: string }>) {
      const prev = map.get(row.club_id)
      if (!prev || row.event_date < prev) map.set(row.club_id, row.event_date)
    }
  }
  return map
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
    const [stats, foundedDateByClubId] = await Promise.all([
      getClubStats(supabase, clubs.map((c) => c.id)),
      getEarliestFoundedDatesByClubIds(supabase, clubs.map((c) => c.id)),
    ])
    return clubs.map((c) => {
      const s = stats.get(c.id) ?? EMPTY_CLUB_STATS
      const founded = foundedDateByClubId.get(c.id) ?? null
      return {
        id: c.id,
        name: c.name,
        city_name: null,
        country_name: null,
        country_fifa_code: null,
        country_current_name: null,
        country_current_fifa_code: null,
        player_count: s.poland.player_count,
        appearance_count: s.poland.appearance_count,
        goal_count: s.poland.goal_count,
        rival_player_count: s.rivals.player_count,
        rival_appearance_count: s.rivals.appearance_count,
        rival_goal_count: s.rivals.goal_count,
        founded_year: founded ? founded.slice(0, 4) : null,
      }
    })
  }

  const [
    { data: cities, error: citiesError },
    cityPeriodsMap,
    foundedDateByClubId,
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name, current_country_id')
      .in('id', cityIds as string[]),
    loadCityCountryPeriodsMap(supabase, cityIds as string[]),
    getEarliestFoundedDatesByClubIds(supabase, clubs.map((c) => c.id)),
  ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const cityCurrentCountryMap = new Map(
    (cities ?? []).map((c) => [c.id, c.current_country_id ?? null] as const)
  )

  const allCountryIds = new Set<string>()
  for (const list of cityPeriodsMap.values()) for (const p of list) allCountryIds.add(p.country_id)
  for (const cid of cityCurrentCountryMap.values()) if (cid) allCountryIds.add(cid)
  const countryInfoMap = await loadCountryInfoMap(supabase, [...allCountryIds])

  const stats = await getClubStats(supabase, clubs.map((c) => c.id))

  return clubs.map((c) => {
    const s = stats.get(c.id) ?? EMPTY_CLUB_STATS
    const periods = c.club_city_id ? (cityPeriodsMap.get(c.club_city_id) ?? []) : []
    const founded = foundedDateByClubId.get(c.id) ?? null
    const cityFallbackCountryId = c.club_city_id
      ? (cityCurrentCountryMap.get(c.club_city_id) ?? null)
      : null
    const resolved = resolveCityCountry(periods, founded, countryInfoMap, cityFallbackCountryId)
    return {
      id: c.id,
      name: c.name,
      city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
      country_name: resolved.historical_country_name,
      country_fifa_code: resolved.historical_country_fifa_code,
      country_current_name: resolved.current_country_name,
      country_current_fifa_code: resolved.current_country_fifa_code,
      player_count: s.poland.player_count,
      appearance_count: s.poland.appearance_count,
      goal_count: s.poland.goal_count,
      rival_player_count: s.rivals.player_count,
      rival_appearance_count: s.rivals.appearance_count,
      rival_goal_count: s.rivals.goal_count,
      founded_year: founded ? founded.slice(0, 4) : null,
    }
  })
}

export async function getPublicClubs(): Promise<AdminClub[]> {
  const cacheKey = await getPublicCacheKey('public-clubs')
  return unstable_cache(
    async () => getAdminClubs(),
    cacheKey,
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
      items: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        city_name: null,
        country_name: null,
        country_fifa_code: null,
        country_current_name: null,
        country_current_fifa_code: null,
        player_count: 0,
        appearance_count: 0,
        goal_count: 0,
        rival_player_count: 0,
        rival_appearance_count: 0,
        rival_goal_count: 0,
        founded_year: null,
      })),
      total: count ?? 0,
    }
  }

  const [
    { data: cities, error: citiesError },
    cityPeriodsMap,
    foundedDateByClubId,
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name, current_country_id')
      .in('id', cityIds as string[]),
    loadCityCountryPeriodsMap(supabase, cityIds as string[]),
    getEarliestFoundedDatesByClubIds(supabase, clubs.map((c) => c.id)),
  ])

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)

  const cityMap = new Map((cities ?? []).map((c) => [c.id, c.city_name]))
  const cityCurrentCountryMap = new Map(
    (cities ?? []).map((c) => [c.id, c.current_country_id ?? null] as const)
  )

  const allCountryIds = new Set<string>()
  for (const list of cityPeriodsMap.values()) for (const p of list) allCountryIds.add(p.country_id)
  for (const cid of cityCurrentCountryMap.values()) if (cid) allCountryIds.add(cid)
  const countryInfoMap = await loadCountryInfoMap(supabase, [...allCountryIds])

  return {
    items: clubs.map((c) => {
      const periods = c.club_city_id ? (cityPeriodsMap.get(c.club_city_id) ?? []) : []
      const founded = foundedDateByClubId.get(c.id) ?? null
      const cityFallbackCountryId = c.club_city_id
        ? (cityCurrentCountryMap.get(c.club_city_id) ?? null)
        : null
      const resolved = resolveCityCountry(periods, founded, countryInfoMap, cityFallbackCountryId)
      return {
        id: c.id,
        name: c.name,
        city_name: c.club_city_id ? (cityMap.get(c.club_city_id) ?? null) : null,
        country_name: resolved.historical_country_name,
        country_fifa_code: resolved.historical_country_fifa_code,
        country_current_name: resolved.current_country_name,
        country_current_fifa_code: resolved.current_country_fifa_code,
        player_count: 0,
        appearance_count: 0,
        goal_count: 0,
        rival_player_count: 0,
        rival_appearance_count: 0,
        rival_goal_count: 0,
        founded_year: founded ? founded.slice(0, 4) : null,
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
  const cacheKey = await getPublicCacheKey('public-club-details', id)
  return unstable_cache(
    async () => getAdminClubDetails(id),
    cacheKey,
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
      founded_year: null,
      country_name: null,
      country_fifa_code: null,
      country_current_name: null,
      country_current_fifa_code: null,
      city_country_timeline: [],
      stadium_id: club.stadium_id ?? null,
      stadium_name: null,
    }
  }

  const [
    { data: city, error: cityError },
    cityPeriodsMap,
    foundedDateByClubId,
    { data: stadium, error: stadiumError },
  ] = await Promise.all([
    supabase
      .from('tbl_Cities')
      .select('id, city_name, current_country_id')
      .eq('id', club.club_city_id)
      .maybeSingle(),
    loadCityCountryPeriodsMap(supabase, [club.club_city_id]),
    getEarliestFoundedDatesByClubIds(supabase, [club.id]),
    club.stadium_id
      ? supabase
          .from('tbl_Stadiums')
          .select('name')
          .eq('id', club.stadium_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null, error: null }),
  ])

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (stadiumError) throw new Error(`tbl_Stadiums: ${stadiumError.message}`)

  const periods = cityPeriodsMap.get(club.club_city_id) ?? []
  const cityFallbackCountryId = city?.current_country_id ?? null
  const allCountryIds = new Set<string>(periods.map((p) => p.country_id))
  if (cityFallbackCountryId) allCountryIds.add(cityFallbackCountryId)
  const countryInfoMap = await loadCountryInfoMap(supabase, [...allCountryIds])
  const founded = foundedDateByClubId.get(club.id) ?? null
  const resolved = resolveCityCountry(periods, founded, countryInfoMap, cityFallbackCountryId)
  const cityCountryTimeline = buildCityCountryTimeline(periods, countryInfoMap, founded)

  return {
    id: club.id,
    name: club.name,
    club_city_id: club.club_city_id,
    city_name: city?.city_name ?? null,
    founded_year: founded ? founded.slice(0, 4) : null,
    country_name: resolved.historical_country_name,
    country_fifa_code: resolved.historical_country_fifa_code,
    country_current_name: resolved.current_country_name,
    country_current_fifa_code: resolved.current_country_fifa_code,
    city_country_timeline: cityCountryTimeline,
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
  const cacheKey = await getPublicCacheKey('public-club-stats', clubId)
  return unstable_cache(
    async () => getAdminClubDetailStats(clubId),
    cacheKey,
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
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return zero
  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  // Determine who actually played (started or entered as sub)
  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
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
  const playedParticipants = filteredParticipants.filter(
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
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)
    minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }

  return { player_count, appearance_count, goal_count, assist_count, minute_count }
}

export async function getPublicClubPlayerStats(clubId: string): Promise<AdminClubPlayerStat[]> {
  const cacheKey = await getPublicCacheKey('public-club-player-stats', clubId)
  return unstable_cache(
    async () => getAdminClubPlayerStats(clubId),
    cacheKey,
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
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return []
  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
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
  const playedParticipants = filteredParticipants.filter(
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
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

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

// =====================================================================
// Statystyki rywali Polski grających dla danego klubu.
// Patrzymy na zawodników, którzy w meczu reprezentacji Polski byli
// po stronie rywala (team_id != polandTeamId) i mieli przypisany club_team_id
// należący do tego klubu. Logika appearance/goals/minutes — identyczna jak
// w getAdminClubPlayerStats; różnica to filtr team_id i dodatkowo zbieramy
// reprezentowane kraje (z tbl_Teams.country_id) do flag w UI.
// =====================================================================
export async function getPublicClubRivalPlayerStats(clubId: string): Promise<AdminClubRivalPlayerStat[]> {
  const cacheKey = await getPublicCacheKey('public-club-rival-player-stats', clubId)
  return unstable_cache(
    async () => getAdminClubRivalPlayerStats(clubId),
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-clubs', `public-club:${clubId}`],
    }
  )()
}

export async function getAdminClubRivalPlayerStats(clubId: string): Promise<AdminClubRivalPlayerStat[]> {
  const supabase = createServiceRoleClient()
  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

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
  const polandTeamId = polandTeam.id

  const { data: clubTeams, error: teamsError } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('club_id', clubId)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
  const clubTeamIds = (clubTeams ?? []).map((t) => t.id)
  if (!clubTeamIds.length) return []

  // Wszystkie mecze Polski (Polska po stronie home lub away).
  const polandMatchIdSet = new Set<string>()
  for (const side of ['home_team_id', 'away_team_id'] as const) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Matches')
        .select('id')
        .eq(side, polandTeamId)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Matches (poland ${side}): ${error.message}`)
      const rows = (data ?? []) as Array<{ id: string }>
      for (const r of rows) polandMatchIdSet.add(r.id)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  const polandMatchIds = [...polandMatchIdSet]
  if (!polandMatchIds.length) return []

  // Uczestnicy: gracze klubu w meczach Polski, ale po stronie rywala.
  type ParticipantRow = {
    person_id: string
    match_id: string
    is_starting: boolean | null
    team_id: string
  }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < clubTeamIds.length; i += CHUNK_SIZE) {
    const teamChunk = clubTeamIds.slice(i, i + CHUNK_SIZE)
    for (let j = 0; j < polandMatchIds.length; j += CHUNK_SIZE) {
      const matchChunk = polandMatchIds.slice(j, j + CHUNK_SIZE)
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('tbl_Match_Participants')
          .select('person_id, match_id, is_starting, team_id')
          .eq('role', 'PLAYER')
          .neq('team_id', polandTeamId)
          .in('club_team_id', teamChunk)
          .in('match_id', matchChunk)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
        const rows = (data ?? []) as ParticipantRow[]
        allParticipants.push(...rows)
        if (rows.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
    }
  }
  if (!allParticipants.length) return []

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return []
  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  // Substytucje (kto wszedł z ławki) — żeby wykluczyć zgłoszonych, którzy nie weszli.
  type SubEvent = { match_id: string; secondary_person_id: string }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
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
  const playedParticipants = filteredParticipants.filter(
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

  // Mapa team_id -> country_id (drużyny rywali, w których wystąpili nasi zawodnicy).
  const rivalTeamIds = [...new Set(playedParticipants.map((p) => p.team_id))]
  const teamCountryMap = new Map<string, string | null>()
  for (let i = 0; i < rivalTeamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', rivalTeamIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Teams (rivals): ${error.message}`)
    for (const t of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      teamCountryMap.set(t.id, t.country_id)
    }
  }

  // Mapa country_id -> { name, fifa_code }.
  const countryIds = [...new Set([...teamCountryMap.values()].filter((v): v is string => !!v))]
  const countryInfoMap = new Map<string, { name: string; fifa_code: string | null }>()
  if (countryIds.length) {
    for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
      const { data, error } = await supabase
        .from('tbl_Countries')
        .select('id, name, fifa_code')
        .in('id', countryIds.slice(i, i + CHUNK_SIZE))
      if (error) throw new Error(`tbl_Countries (rivals): ${error.message}`)
      for (const c of (data ?? []) as Array<{ id: string; name: string; fifa_code: string | null }>) {
        countryInfoMap.set(c.id, { name: c.name, fifa_code: c.fifa_code })
      }
    }
  }

  const statsByPersonId = new Map<string, AdminClubRivalPlayerStat>()
  const countryIdsByPerson = new Map<string, Set<string>>()
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
      minute_count: 0,
      represented_countries: [],
    })
    countryIdsByPerson.set(person.id as string, new Set())
  }

  for (const p of playedParticipants) {
    const entry = statsByPersonId.get(p.person_id)
    if (entry) entry.appearance_count += 1
    const countryId = teamCountryMap.get(p.team_id) ?? null
    if (countryId) countryIdsByPerson.get(p.person_id)?.add(countryId)
  }

  // Gole strzelone przez tych graczy w tych meczach (po stronie rywala).
  type PrimaryEvent = { match_id: string; primary_person_id: string }
  const allGoalEvents: PrimaryEvent[] = []
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let from = 0
    while (true) {
      const goalsRes = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id')
        .in('event_type', ['GOAL', 'PENALTY_GOAL'])
        .in('match_id', batch)
        .not('primary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
      allGoalEvents.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
      if ((goalsRes.data ?? []).length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  for (const event of allGoalEvents) {
    if (!playedMatchPersonSet.has(`${event.match_id}:${event.primary_person_id}`)) continue
    const entry = statsByPersonId.get(event.primary_person_id)
    if (entry) entry.goal_count += 1
  }

  // Minuty (sub-on / sub-off / koniec meczu).
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
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

    const entry = statsByPersonId.get(participation.person_id)
    if (entry) entry.minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }

  // Wstaw listę reprezentowanych krajów na koniec, posortowaną alfabetycznie.
  for (const [personId, ids] of countryIdsByPerson.entries()) {
    const entry = statsByPersonId.get(personId)
    if (!entry) continue
    entry.represented_countries = [...ids]
      .map((cid) => {
        const info = countryInfoMap.get(cid)
        return { country_id: cid, name: info?.name ?? '—', fifa_code: info?.fifa_code ?? null }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  }

  return [...statsByPersonId.values()]
    .filter((player) => player.appearance_count > 0)
    .sort((a, b) => {
      if (b.appearance_count !== a.appearance_count) return b.appearance_count - a.appearance_count
      if (b.goal_count !== a.goal_count) return b.goal_count - a.goal_count
      if (b.minute_count !== a.minute_count) return b.minute_count - a.minute_count
      return a.person_name.localeCompare(b.person_name, 'pl')
    })
}

export async function getPublicClubHistory(clubId: string): Promise<AdminClubHistoryEvent[]> {
  const cacheKey = await getPublicCacheKey('public-club-history', clubId)
  return unstable_cache(
    async () => getClubHistory(clubId),
    cacheKey,
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

