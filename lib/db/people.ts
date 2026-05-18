import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'
import { getPublicCacheKey } from '@/lib/db/publicCache'

type CityCountryPeriod = {
  city_id: string
  country_id: string
  valid_from: string | null
  valid_to: string | null
}

export type AdminPersonRole = 'PLAYER' | 'COACH' | 'REFEREE'

export type CoachCompetitionFilterKey = 'WORLD_CUP' | 'EURO' | 'NATIONS_LEAGUE' | 'FRIENDLY' | 'OTHER'
export type CoachStageFilterKey = 'TOURNAMENT' | 'QUALIFIERS' | 'PLAYOFFS'

export type CoachPolandFilterMatch = {
  match_id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_key: CoachCompetitionFilterKey
  competition_name: string
  stage_key: CoachStageFilterKey
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  coach_team_id: string | null
  coach_team_fifa_code: string | null
  coach_is_home: boolean | null
  goals_for: number
  goals_against: number
  final_score: string | null
  shootout_score: string | null
  outcome: 'W' | 'D' | 'L' | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
  // POV: Polska. 'HOME' = mecz w Polsce, 'AWAY' = w kraju rywala Polski,
  // 'NEUTRAL' = ani jedno, ani drugie. null = brak danych o miejscu.
  venue_type: 'HOME' | 'AWAY' | 'NEUTRAL' | null
}

// Per-match row for the referee filter ribbon (matches Poland played that were officiated
// by the given referee). Field semantics mirror CoachPolandFilterMatch, but the POV
// fields refer to Poland's team instead of the coached team. outcome / goals_for /
// goals_against are computed from Poland's perspective.
export type RefereeFilterMatch = {
  match_id: string
  match_date: string
  match_time: string | null
  match_status: string | null
  result_type: string | null
  walkover_winner_team_id: string | null
  editorial_status: string
  competition_key: CoachCompetitionFilterKey
  competition_name: string
  stage_key: CoachStageFilterKey
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  poland_team_id: string | null
  poland_team_fifa_code: string | null
  poland_is_home: boolean | null
  goals_for: number
  goals_against: number
  final_score: string | null
  shootout_score: string | null
  outcome: 'W' | 'D' | 'L' | null
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
  venue_type: 'HOME' | 'AWAY' | 'NEUTRAL' | null
}

const ROLE_ORDER: Record<AdminPersonRole, number> = {
  PLAYER: 0,
  COACH: 1,
  REFEREE: 2,
}

const ROLE_LABEL: Record<AdminPersonRole, string> = {
  PLAYER: 'Piłkarz',
  COACH: 'Trener',
  REFEREE: 'Sędzia',
}

export type AdminPersonListItem = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  birth_date: string | null
  death_date: string | null
  is_active: boolean | null
  birth_city_id: string | null
  birth_country_id: string | null
  birth_city_name: string | null
  birth_country_name: string | null
  birth_country_fifa_code: string | null
  represented_country_names: string[]
  represented_country_fifa_codes: (string | null)[]
  has_represented_poland?: boolean
  has_played_against_poland?: boolean
  coached_country_names: string[]
  coached_country_fifa_codes: (string | null)[]
  has_coached_poland?: boolean
  has_coached_against_poland?: boolean
  roles: AdminPersonRole[]
  role_labels: string[]
  appearance_count: number
  starting_appearance_count: number
  sub_on_count: number
  sub_off_count: number
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  minute_count: number
  bench_count: number
  player_match_count: number
  coach_match_count: number
  coach_poland_match_count: number
  coach_against_poland_match_count: number
  coach_poland_first_match_date: string | null
  coach_poland_last_match_date: string | null
  coach_poland_filter_matches: CoachPolandFilterMatch[]
  referee_filter_matches: RefereeFilterMatch[]
  referee_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_points_per_match: number
  coach_poland_wins: number
  coach_poland_draws: number
  coach_poland_losses: number
  coach_poland_goals_scored: number
  coach_poland_goals_conceded: number
  coach_poland_points_per_match: number
  coach_against_poland_wins: number
  coach_against_poland_draws: number
  coach_against_poland_losses: number
  coach_against_poland_goals_scored: number
  coach_against_poland_goals_conceded: number
  coach_against_poland_points_per_match: number
  referee_wins: number
  referee_draws: number
  referee_losses: number
  referee_goals_scored: number
  referee_goals_conceded: number
}

export type AdminPersonDetails = AdminPersonListItem & {
  represented_country_ids: string[]
}

export type AdminPersonBirthCityOption = {
  id: string
  city_name: string
  current_country_id: string | null
  current_country_name: string | null
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

function buildDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  const first = person.first_name?.trim() ?? ''
  const last = person.last_name?.trim() ?? ''
  const nick = person.nickname?.trim() ?? ''

  const fullName = `${first} ${last}`.trim()
  // If both full name and nickname exist, prefer nickname
  if (fullName && nick) return nick
  if (nick) return nick
  if (fullName) return fullName
  return '—'
}

export function getPersonDisplayName(person: Pick<AdminPersonListItem, 'first_name' | 'last_name' | 'nickname'>): string {
  return buildDisplayName(person)
}

function mapRolesToLabels(roles: AdminPersonRole[]): string[] {
  return roles.map((role) => ROLE_LABEL[role])
}

async function getRolesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, AdminPersonRole[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allParticipants: { person_id: string; role: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Participants')
      .select('person_id, role')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allParticipants.push(...(data ?? []))
  }
  const participants = allParticipants

  const map = new Map<string, AdminPersonRole[]>()

  for (const row of participants ?? []) {
    const role = row.role as AdminPersonRole
    if (!role || !(role in ROLE_ORDER)) continue

    const existing = map.get(row.person_id) ?? []
    if (!existing.includes(role)) {
      existing.push(role)
      existing.sort((left, right) => ROLE_ORDER[left] - ROLE_ORDER[right])
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getExplicitRepresentedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { name: string; fifaCode: string | null }[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allLinks: { person_id: string; country_id: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Person_Countries')
      .select('person_id, country_id')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Person_Countries: ${error.message}`)
    allLinks.push(...(data ?? []))
  }
  const links = allLinks

  const countryIds = [...new Set(links.map((row) => row.country_id).filter(Boolean))]
  if (!countryIds.length) {
    return new Map()
  }

  const { data: countries, error: countriesError } = await supabase
    .from('tbl_Countries')
    .select('id, name, fifa_code')
    .in('id', countryIds)

  if (countriesError) {
    throw new Error(`tbl_Countries: ${countriesError.message}`)
  }

  const countryById = new Map((countries ?? []).map((country) => [country.id, { name: country.name, fifaCode: country.fifa_code ?? null }]))
  const map = new Map<string, { name: string; fifaCode: string | null }[]>()

  for (const row of links ?? []) {
    const country = countryById.get(row.country_id)
    if (!country?.name) continue

    const existing = map.get(row.person_id) ?? []
    if (!existing.some((e) => e.name === country.name)) {
      existing.push({ name: country.name, fifaCode: country.fifaCode })
      existing.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getExplicitRepresentedCountryIdsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, string[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const allLinks: { person_id: string; country_id: string }[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Person_Countries')
      .select('person_id, country_id')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Person_Countries: ${error.message}`)
    allLinks.push(...(data ?? []))
  }
  const links = allLinks

  const map = new Map<string, string[]>()

  for (const row of links ?? []) {
    const existing = map.get(row.person_id) ?? []
    if (!existing.includes(row.country_id)) {
      existing.push(row.country_id)
      map.set(row.person_id, existing)
    }
  }

  return map
}

async function getPolandCountryId(supabase: ReturnType<typeof createServiceRoleClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()

  if (error) throw new Error(`tbl_Countries (Polska): ${error.message}`)
  return data?.id ?? null
}

async function getPolandTeamIdByMatchId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchIds: string[]
): Promise<Map<string, string>> {
  if (!matchIds.length) {
    return new Map()
  }

  const polandCountryId = await getPolandCountryId(supabase)
  if (!polandCountryId) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const matchPolandTeamIdMap = new Map<string, string>()

  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data: matchData, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (Poland team lookup): ${error.message}`)

    const matches = (matchData ?? []) as Array<{ id: string; home_team_id: string; away_team_id: string }>
    const teamIds = [...new Set(matches.flatMap((match) => [match.home_team_id, match.away_team_id]))]
    if (!teamIds.length) continue

    const teamCountryMap = new Map<string, string | null>()
    for (let j = 0; j < teamIds.length; j += CHUNK_SIZE) {
      const { data: teamData, error: teamError } = await supabase
        .from('tbl_Teams')
        .select('id, country_id')
        .in('id', teamIds.slice(j, j + CHUNK_SIZE))

      if (teamError) throw new Error(`tbl_Teams (Poland team lookup): ${teamError.message}`)

      for (const team of (teamData ?? []) as Array<{ id: string; country_id: string | null }>) {
        teamCountryMap.set(team.id, team.country_id)
      }
    }

    for (const match of matches) {
      const homeCountryId = teamCountryMap.get(match.home_team_id) ?? null
      const awayCountryId = teamCountryMap.get(match.away_team_id) ?? null
      if (homeCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.home_team_id)
      } else if (awayCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.away_team_id)
      }
    }
  }

  return matchPolandTeamIdMap
}

type MatchVenue = {
  venue_country_id: string | null
  venue_country_name: string | null
  venue_city_id: string | null
  venue_city_name: string | null
  venue_stadium_id: string | null
  venue_stadium_name: string | null
}

// Resolves venue (stadium → city → country @ match_date) for the given match ids.
// Country comes from tbl_City_Country_Periods (time-dependent), city from
// tbl_Stadiums.stadium_city_id when match has a stadium, else from tbl_Matches.match_city_id.
async function getMatchVenuesByMatchId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matchInfos: Array<{ id: string; match_date: string; match_stadium_id: string | null; match_city_id: string | null }>
): Promise<Map<string, MatchVenue>> {
  const result = new Map<string, MatchVenue>()
  if (!matchInfos.length) return result

  const CHUNK_SIZE = 250

  const stadiumIds = [...new Set(matchInfos.map((m) => m.match_stadium_id).filter((v): v is string => Boolean(v)))]
  type StadiumRow = { id: string; name: string | null; stadium_city_id: string | null }
  const stadiumById = new Map<string, StadiumRow>()
  for (let i = 0; i < stadiumIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Stadiums')
      .select('id, name, stadium_city_id')
      .in('id', stadiumIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Stadiums (match venues): ${error.message}`)
    for (const row of (data ?? []) as StadiumRow[]) stadiumById.set(row.id, row)
  }

  const effectiveCityIdByMatch = new Map<string, string | null>()
  for (const m of matchInfos) {
    const fromStadium = m.match_stadium_id ? (stadiumById.get(m.match_stadium_id)?.stadium_city_id ?? null) : null
    effectiveCityIdByMatch.set(m.id, fromStadium ?? m.match_city_id ?? null)
  }

  const cityIds = [...new Set([...effectiveCityIdByMatch.values()].filter((v): v is string => Boolean(v)))]

  type CityRow = { id: string; city_name: string | null }
  const cityById = new Map<string, CityRow>()
  for (let i = 0; i < cityIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Cities (match venues): ${error.message}`)
    for (const row of (data ?? []) as CityRow[]) cityById.set(row.id, row)
  }

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (let i = 0; i < cityIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_City_Country_Periods')
      .select('city_id, country_id, valid_from, valid_to')
      .in('city_id', cityIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_City_Country_Periods (match venues): ${error.message}`)
    for (const row of (data ?? []) as CityCountryPeriod[]) {
      const arr = periodsByCity.get(row.city_id) ?? []
      arr.push(row)
      periodsByCity.set(row.city_id, arr)
    }
  }

  const matchCountryIdByMatch = new Map<string, string | null>()
  for (const m of matchInfos) {
    const cityId = effectiveCityIdByMatch.get(m.id) ?? null
    if (!cityId) { matchCountryIdByMatch.set(m.id, null); continue }
    const periods = periodsByCity.get(cityId) ?? []
    const matchDate = m.match_date
    const inRange = periods.find((p) => {
      const fromOk = !p.valid_from || p.valid_from <= matchDate
      const toOk = !p.valid_to || matchDate <= p.valid_to
      return fromOk && toOk
    })
    const chosen = inRange ?? sortPeriods(periods)[0] ?? null
    matchCountryIdByMatch.set(m.id, chosen?.country_id ?? null)
  }

  const countryIds = [...new Set([...matchCountryIdByMatch.values()].filter((v): v is string => Boolean(v)))]
  const countryNameById = new Map<string, string>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Countries (match venues): ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string; name: string }>) countryNameById.set(row.id, row.name)
  }

  for (const m of matchInfos) {
    const cityId = effectiveCityIdByMatch.get(m.id) ?? null
    const countryId = matchCountryIdByMatch.get(m.id) ?? null
    const stadium = m.match_stadium_id ? stadiumById.get(m.match_stadium_id) ?? null : null
    result.set(m.id, {
      venue_country_id: countryId,
      venue_country_name: countryId ? (countryNameById.get(countryId) ?? null) : null,
      venue_city_id: cityId,
      venue_city_name: cityId ? (cityById.get(cityId)?.city_name ?? null) : null,
      venue_stadium_id: m.match_stadium_id ?? null,
      venue_stadium_name: stadium?.name ?? null,
    })
  }

  return result
}

async function getRepresentedPolandByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, boolean>> {
  if (!personIds.length) {
    return new Map()
  }

  const polandCountryId = await getPolandCountryId(supabase)
  if (!polandCountryId) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const allParticipants: ParticipantRow[] = []

  // Get all PLAYER participations with team_id (any cadre - starting, subbed on, or bench)
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .eq('role', 'PLAYER')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (represented Poland): ${error.message}`)

      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) {
    return new Map()
  }

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) {
    return new Map()
  }

  // Get match data and identify Poland teams
  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]
  const matchPolandTeamIdMap = new Map<string, string>() // match_id -> poland_team_id
  
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (represented Poland): ${error.message}`)

    const matchIds = (data ?? []) as Array<{ id: string; home_team_id: string; away_team_id: string }>
    const teamIds = new Set<string>()
    for (const m of matchIds ?? []) {
      teamIds.add(m.home_team_id)
      teamIds.add(m.away_team_id)
    }
    
    if (!teamIds.size) continue

    const teamCountryMap = new Map<string, string | null>()
    const teamIdArray = [...teamIds]
    for (let j = 0; j < teamIdArray.length; j += CHUNK_SIZE) {
      const { data: teamData, error: teamError } = await supabase
        .from('tbl_Teams')
        .select('id, country_id')
        .in('id', teamIdArray.slice(j, j + CHUNK_SIZE))

      if (teamError) throw new Error(`tbl_Teams (represented Poland): ${teamError.message}`)

      for (const team of (teamData ?? []) as Array<{ id: string; country_id: string | null }>) {
        teamCountryMap.set(team.id, team.country_id)
      }
    }

    // For each match, find which team is Poland
    for (const match of matchIds ?? []) {
      const homeCountryId = teamCountryMap.get(match.home_team_id) ?? null
      const awayCountryId = teamCountryMap.get(match.away_team_id) ?? null
      if (homeCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.home_team_id)
      } else if (awayCountryId === polandCountryId) {
        matchPolandTeamIdMap.set(match.id, match.away_team_id)
      }
    }
  }

  const playedAgainstPolandMatchIds = new Set(matchPolandTeamIdMap.keys())
  const result = new Map<string, boolean>()
  // Mark only participants whose team_id matches Poland's team on that match
  for (const participant of filteredParticipants) {
    const polandTeamId = matchPolandTeamIdMap.get(participant.match_id)
    if (polandTeamId && participant.team_id === polandTeamId) {
      result.set(participant.person_id, true)
    }
  }

  return result
}

async function getPlayedAgainstPolandByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, boolean>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null; team_id: string | null }
  const allParticipants: ParticipantRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting, team_id')
        .eq('role', 'PLAYER')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (rivals): ${error.message}`)

      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) {
    return new Map()
  }

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) {
    return new Map()
  }

  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]
  type SubEvent = { match_id: string; primary_person_id: string | null; secondary_person_id: string | null }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id, secondary_person_id')
        .eq('event_type', 'SUBSTITUTION')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .not('secondary_person_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Events (rivals substitutions): ${error.message}`)

      const rows = (data ?? []) as SubEvent[]
      allSubEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const subEnteredSet = new Set(
    allSubEvents
      .filter((event) => event.secondary_person_id)
      .map((event) => `${event.match_id}:${event.secondary_person_id as string}`)
  )
  const playedParticipants = filteredParticipants.filter(
    (participant) => participant.is_starting || subEnteredSet.has(`${participant.match_id}:${participant.person_id}`)
  )
  if (!playedParticipants.length) {
    return new Map()
  }

  const playedMatchIds = [...new Set(playedParticipants.map((participant) => participant.match_id))]
  const playedMatchMap = new Map<string, { home_team_id: string; away_team_id: string }>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id')
      .in('id', playedMatchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (rivals): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; home_team_id: string; away_team_id: string }>) {
      playedMatchMap.set(row.id, { home_team_id: row.home_team_id, away_team_id: row.away_team_id })
    }
  }

  const teamIds = [...new Set([...playedMatchMap.values()].flatMap((match) => [match.home_team_id, match.away_team_id]))]
  if (!teamIds.length) {
    return new Map()
  }

  const teamCountryMap = new Map<string, string | null>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (rivals): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      teamCountryMap.set(row.id, row.country_id)
    }
  }

  const polandCountryId = await getPolandCountryId(supabase)
  if (!polandCountryId) {
    return new Map()
  }

  // Build map: match_id -> poland_team_id (the team that represents Poland in that match)
  const matchPolandTeamIdMap = new Map<string, string>()
  for (const [matchId, match] of playedMatchMap) {
    const homeCountryId = teamCountryMap.get(match.home_team_id) ?? null
    const awayCountryId = teamCountryMap.get(match.away_team_id) ?? null
    if (homeCountryId === polandCountryId) {
      matchPolandTeamIdMap.set(matchId, match.home_team_id)
    } else if (awayCountryId === polandCountryId) {
      matchPolandTeamIdMap.set(matchId, match.away_team_id)
    }
  }

  const playedAgainstPolandMatchIds = new Set(matchPolandTeamIdMap.keys())
  const result = new Map<string, boolean>()
  // Only mark participants who:
  // 1. Played in a match where Poland was involved
  // 2. Were on the OPPOSING team (not Poland's team)
  for (const participant of playedParticipants) {
    if (!playedAgainstPolandMatchIds.has(participant.match_id)) continue
    
    const polandTeamId = matchPolandTeamIdMap.get(participant.match_id)
    if (!polandTeamId) continue
    
    // Only include if participant was on a different team than Poland
    if (participant.team_id && participant.team_id !== polandTeamId) {
      result.set(participant.person_id, true)
    }
  }

  return result
}

async function getCoachedCountryNamesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, string[]>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type CoachParticipationRow = { person_id: string; team_id: string | null }
  const participations: CoachParticipationRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coached countries): ${error.message}`)

      const rows = (data ?? []) as CoachParticipationRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const teamIds = [...new Set(participations.map((row) => row.team_id).filter((teamId): teamId is string => Boolean(teamId)))]
  if (!teamIds.length) {
    return new Map()
  }

  const countryIdByTeamId = new Map<string, string>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      if (row.country_id) {
        countryIdByTeamId.set(row.id, row.country_id)
      }
    }
  }

  const countryIds = [...new Set(countryIdByTeamId.values())]
  if (!countryIds.length) {
    return new Map()
  }

  const countryNameById = new Map<string, string>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string | null }>) {
      if (row.name) {
        countryNameById.set(row.id, row.name)
      }
    }
  }

  const namesByPersonId = new Map<string, Set<string>>()
  for (const participation of participations) {
    if (!participation.team_id) continue
    const countryId = countryIdByTeamId.get(participation.team_id)
    if (!countryId) continue
    const countryName = countryNameById.get(countryId)
    if (!countryName) continue

    const existing = namesByPersonId.get(participation.person_id) ?? new Set<string>()
    existing.add(countryName)
    namesByPersonId.set(participation.person_id, existing)
  }

  const result = new Map<string, string[]>()
  for (const [personId, names] of namesByPersonId) {
    result.set(personId, [...names].sort((a, b) => a.localeCompare(b, 'pl')))
  }

  return result
}

async function getCoachedCountryDataByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { names: string[]; fifaCodes: (string | null)[] }>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type CoachParticipationRow = { person_id: string; team_id: string | null }
  const participations: CoachParticipationRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coached countries): ${error.message}`)

      const rows = (data ?? []) as CoachParticipationRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const teamIds = [...new Set(participations.map((row) => row.team_id).filter((teamId): teamId is string => Boolean(teamId)))]
  if (!teamIds.length) {
    return new Map()
  }

  const countryIdByTeamId = new Map<string, string>()
  for (let i = 0; i < teamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; country_id: string | null }>) {
      if (row.country_id) {
        countryIdByTeamId.set(row.id, row.country_id)
      }
    }
  }

  const countryIds = [...new Set(countryIdByTeamId.values())]
  if (!countryIds.length) {
    return new Map()
  }

  const countryDataById = new Map<string, { name: string; fifaCode: string | null }>()
  for (let i = 0; i < countryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', countryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (coached countries): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string | null; fifa_code: string | null }>) {
      if (row.name) {
        countryDataById.set(row.id, { name: row.name, fifaCode: row.fifa_code ?? null })
      }
    }
  }

  const dataByPersonId = new Map<string, { names: Set<string>; fifaCodes: Map<string, string | null> }>()
  for (const participation of participations) {
    if (!participation.team_id) continue
    const countryId = countryIdByTeamId.get(participation.team_id)
    if (!countryId) continue
    const countryData = countryDataById.get(countryId)
    if (!countryData) continue

    const existing = dataByPersonId.get(participation.person_id) ?? { names: new Set<string>(), fifaCodes: new Map<string, string | null>() }
    existing.names.add(countryData.name)
    existing.fifaCodes.set(countryData.name, countryData.fifaCode)
    dataByPersonId.set(participation.person_id, existing)
  }

  const result = new Map<string, { names: string[]; fifaCodes: (string | null)[] }>()
  for (const [personId, data] of dataByPersonId) {
    const names = [...data.names].sort((a, b) => a.localeCompare(b, 'pl'))
    const fifaCodes = names.map((name) => data.fifaCodes.get(name) ?? null)
    result.set(personId, { names, fifaCodes })
  }

  return result
}

async function getCoachedPolandByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, boolean>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const allParticipants: ParticipantRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coach Poland): ${error.message}`)

      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) {
    return new Map()
  }

  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(
    supabase,
    [...new Set(allParticipants.map((participant) => participant.match_id))]
  )
  const filteredParticipants = allParticipants.filter((participant) => nonWalkoverMatchIds.has(participant.match_id))
  if (!filteredParticipants.length) {
    return new Map()
  }

  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(
    supabase,
    [...new Set(filteredParticipants.map((participant) => participant.match_id))]
  )

  const result = new Map<string, boolean>()
  for (const participant of filteredParticipants) {
    const polandTeamId = matchPolandTeamIdMap.get(participant.match_id)
    if (polandTeamId && participant.team_id === polandTeamId) {
      result.set(participant.person_id, true)
    }
  }

  return result
}

async function getCoachedAgainstPolandByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, boolean>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const allParticipants: ParticipantRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coach rivals): ${error.message}`)

      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) {
    return new Map()
  }

  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(
    supabase,
    [...new Set(allParticipants.map((participant) => participant.match_id))]
  )
  const filteredParticipants = allParticipants.filter((participant) => nonWalkoverMatchIds.has(participant.match_id))
  if (!filteredParticipants.length) {
    return new Map()
  }

  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(
    supabase,
    [...new Set(filteredParticipants.map((participant) => participant.match_id))]
  )

  const result = new Map<string, boolean>()
  for (const participant of filteredParticipants) {
    const polandTeamId = matchPolandTeamIdMap.get(participant.match_id)
    if (polandTeamId && participant.team_id && participant.team_id !== polandTeamId) {
      result.set(participant.person_id, true)
    }
  }

  return result
}

async function getCoachPolandTenureRangeByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, { firstMatchDate: string; lastMatchDate: string }>> {
  if (!personIds.length) {
    return new Map()
  }

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const allParticipants: ParticipantRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .eq('role', 'COACH')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coach tenure): ${error.message}`)

      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) {
    return new Map()
  }

  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(
    supabase,
    [...new Set(allParticipants.map((participant) => participant.match_id))]
  )
  const filteredParticipants = allParticipants.filter((participant) => nonWalkoverMatchIds.has(participant.match_id))
  if (!filteredParticipants.length) {
    return new Map()
  }

  const matchIds = [...new Set(filteredParticipants.map((participant) => participant.match_id))]
  const polandTeamIdByMatch = await getPolandTeamIdByMatchId(supabase, matchIds)

  type MatchDateRow = { id: string; match_date: string }
  const matchDateById = new Map<string, string>()
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, match_date')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (coach tenure): ${error.message}`)

    for (const row of (data ?? []) as MatchDateRow[]) {
      matchDateById.set(row.id, row.match_date)
    }
  }

  const result = new Map<string, { firstMatchDate: string; lastMatchDate: string }>()
  for (const participant of filteredParticipants) {
    const polandTeamId = polandTeamIdByMatch.get(participant.match_id)
    if (!polandTeamId || !participant.team_id || participant.team_id !== polandTeamId) continue

    const matchDate = matchDateById.get(participant.match_id)
    if (!matchDate) continue

    const existing = result.get(participant.person_id)
    if (!existing) {
      result.set(participant.person_id, { firstMatchDate: matchDate, lastMatchDate: matchDate })
      continue
    }

    if (matchDate < existing.firstMatchDate) existing.firstMatchDate = matchDate
    if (matchDate > existing.lastMatchDate) existing.lastMatchDate = matchDate
  }

  return result
}

function mapCompetitionNameToFilterKey(name: string | null): CoachCompetitionFilterKey {
  if (name === 'Mistrzostwa Świata') return 'WORLD_CUP'
  if (name === 'Mistrzostwa Europy') return 'EURO'
  if (name === 'Liga Narodów') return 'NATIONS_LEAGUE'
  if (name === 'Towarzyski') return 'FRIENDLY'
  return 'OTHER'
}

function mapLevelNameToStageKey(name: string | null): CoachStageFilterKey {
  if (name === 'Eliminacje') return 'QUALIFIERS'
  if (name === 'Baraż') return 'PLAYOFFS'
  return 'TOURNAMENT'
}

async function getCoachPolandFilterMatchesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, CoachPolandFilterMatch[]>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type CoachParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const participations: CoachParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .eq('role', 'COACH')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (coach filter rows): ${error.message}`)

      const rows = (data ?? []) as CoachParticipantRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!participations.length) return new Map()

  const allMatchIds = [...new Set(participations.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipations = participations.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipations.length) return new Map()

  const filteredMatchIds = [...new Set(filteredParticipations.map((p) => p.match_id))]
  type MatchRow = {
    id: string
    match_date: string
    match_time: string | null
    home_team_id: string
    away_team_id: string
    match_status: string | null
    result_type: string | null
    walkover_winner_team_id: string | null
    editorial_status: string
    competition_id: string | null
    match_level_id: string | null
    match_stadium_id: string | null
    match_city_id: string | null
  }
  const matchDataById = new Map<string, MatchRow>()
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, match_date, match_time, home_team_id, away_team_id, match_status, result_type, walkover_winner_team_id, editorial_status, competition_id, match_level_id, match_stadium_id, match_city_id')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Matches (coach filter rows): ${error.message}`)

    for (const row of (data ?? []) as MatchRow[]) {
      matchDataById.set(row.id, row)
    }
  }

  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(supabase, filteredMatchIds)
  const polandCountryId = await getPolandCountryId(supabase)
  const matchVenueById = await getMatchVenuesByMatchId(
    supabase,
    [...matchDataById.values()].map((m) => ({
      id: m.id,
      match_date: m.match_date,
      match_stadium_id: m.match_stadium_id,
      match_city_id: m.match_city_id,
    }))
  )
  const coachPolandContextParticipations = filteredParticipations.filter((p) => {
    const polandTeamId = matchPolandTeamIdMap.get(p.match_id)
    return Boolean(polandTeamId && p.team_id)
  })
  if (!coachPolandContextParticipations.length) return new Map()

  const competitionIds = [...new Set(
    coachPolandContextParticipations
      .map((p) => matchDataById.get(p.match_id)?.competition_id ?? null)
      .filter((id): id is string => Boolean(id))
  )]
  const competitionNameById = new Map<string, string>()
  for (let i = 0; i < competitionIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Competitions')
      .select('id, name')
      .in('id', competitionIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Competitions (coach filter rows): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
      competitionNameById.set(row.id, row.name)
    }
  }

  const levelIds = [...new Set(
    coachPolandContextParticipations
      .map((p) => matchDataById.get(p.match_id)?.match_level_id ?? null)
      .filter((id): id is string => Boolean(id))
  )]
  const levelNameById = new Map<string, string>()
  for (let i = 0; i < levelIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Levels')
      .select('id, name')
      .in('id', levelIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Match_Levels (coach filter rows): ${error.message}`)

    for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
      levelNameById.set(row.id, row.name)
    }
  }

  type GoalEventRow = { match_id: string; event_type: string; team_id: string | null }
  const goalEvents: GoalEventRow[] = []
  const GOAL_EVENT_TYPES = ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'PENALTY_SHOOTOUT_SCORED']
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, event_type, team_id')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .in('event_type', GOAL_EVENT_TYPES)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Events (coach filter rows): ${error.message}`)

      const rows = (data ?? []) as GoalEventRow[]
      goalEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  type TeamGoals = { goals: number; shootoutGoals: number }
  const teamGoalsInMatch = new Map<string, TeamGoals>()
  for (const event of goalEvents) {
    if (!event.team_id) continue
    const matchData = matchDataById.get(event.match_id)
    if (!matchData) continue

    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') {
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.shootoutGoals += 1
      teamGoalsInMatch.set(key, entry)
      continue
    }

    if (event.event_type === 'OWN_GOAL') {
      const otherTeamId = matchData.home_team_id === event.team_id ? matchData.away_team_id : matchData.home_team_id
      const key = `${event.match_id}:${otherTeamId}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
      continue
    }

    const key = `${event.match_id}:${event.team_id}`
    const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
    entry.goals += 1
    teamGoalsInMatch.set(key, entry)
  }

  // Fetch team names and FIFA codes (tbl_Teams has no name/fifa_code — join via country/club)
  const allTeamIds = [...new Set(
    [...matchDataById.values()].flatMap((m) => [m.home_team_id, m.away_team_id])
  )]
  type TeamLinkRow = { id: string; country_id: string | null; club_id: string | null }
  const teamLinks: TeamLinkRow[] = []
  for (let i = 0; i < allTeamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', allTeamIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Teams (coach filter rows): ${error.message}`)
    teamLinks.push(...(data ?? []) as TeamLinkRow[])
  }

  const teamCountryIds = [...new Set(teamLinks.map((t) => t.country_id).filter((id): id is string => Boolean(id)))]
  const teamClubIds = [...new Set(teamLinks.map((t) => t.club_id).filter((id): id is string => Boolean(id)))]

  type CountryNameFifaRow = { id: string; name: string; fifa_code: string | null }
  const countryNameFifaById = new Map<string, CountryNameFifaRow>()
  for (let i = 0; i < teamCountryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', teamCountryIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Countries (coach filter rows): ${error.message}`)
    for (const row of (data ?? []) as CountryNameFifaRow[]) {
      countryNameFifaById.set(row.id, row)
    }
  }

  type ClubNameRow = { id: string; name: string }
  const clubNameById = new Map<string, string>()
  for (let i = 0; i < teamClubIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Clubs')
      .select('id, name')
      .in('id', teamClubIds.slice(i, i + CHUNK_SIZE))

    if (error) throw new Error(`tbl_Clubs (coach filter rows): ${error.message}`)
    for (const row of (data ?? []) as ClubNameRow[]) {
      clubNameById.set(row.id, row.name)
    }
  }

  const getTeamName = (teamId: string): string => {
    const link = teamLinks.find((t) => t.id === teamId)
    if (!link) return '—'
    if (link.country_id) return countryNameFifaById.get(link.country_id)?.name ?? '—'
    if (link.club_id) return clubNameById.get(link.club_id) ?? '—'
    return '—'
  }
  const getTeamFifaCode = (teamId: string): string | null => {
    const link = teamLinks.find((t) => t.id === teamId)
    if (!link?.country_id) return null
    return countryNameFifaById.get(link.country_id)?.fifa_code ?? null
  }

  const result = new Map<string, CoachPolandFilterMatch[]>()
  for (const { person_id, match_id, team_id: coachedTeamId } of coachPolandContextParticipations) {
    if (!coachedTeamId) continue
    const matchData = matchDataById.get(match_id)
    if (!matchData) continue

    const competitionName = matchData.competition_id ? (competitionNameById.get(matchData.competition_id) ?? null) : null
    const levelName = matchData.match_level_id ? (levelNameById.get(matchData.match_level_id) ?? null) : null
    const competitionKey = mapCompetitionNameToFilterKey(competitionName)
    const stageKey = mapLevelNameToStageKey(levelName)

    const homeTeam = { name: getTeamName(matchData.home_team_id), fifa_code: getTeamFifaCode(matchData.home_team_id) }
    const awayTeam = { name: getTeamName(matchData.away_team_id), fifa_code: getTeamFifaCode(matchData.away_team_id) }
    const coachIsHome = matchData.home_team_id === coachedTeamId
    const coachedTeamFifaCode = getTeamFifaCode(coachedTeamId)

    let goalsFor = 0
    let goalsAgainst = 0
    let outcome: 'W' | 'D' | 'L' | null = null
    let finalScore: string | null = null
    let shootoutScore: string | null = null

    if (matchData.match_status === 'FINISHED') {
      const otherTeamId = coachIsHome ? matchData.away_team_id : matchData.home_team_id
      const myGoalsEntry = teamGoalsInMatch.get(`${match_id}:${coachedTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
      const theirGoalsEntry = teamGoalsInMatch.get(`${match_id}:${otherTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
      goalsFor = myGoalsEntry.goals
      goalsAgainst = theirGoalsEntry.goals

      const homeGoalsEntry = teamGoalsInMatch.get(`${match_id}:${matchData.home_team_id}`) ?? { goals: 0, shootoutGoals: 0 }
      const awayGoalsEntry = teamGoalsInMatch.get(`${match_id}:${matchData.away_team_id}`) ?? { goals: 0, shootoutGoals: 0 }
      finalScore = `${homeGoalsEntry.goals}:${awayGoalsEntry.goals}`

      const isPenalties = matchData.result_type === 'PENALTIES' || matchData.result_type === 'EXTRA_TIME_AND_PENALTIES'
      if (isPenalties) {
        shootoutScore = `${homeGoalsEntry.shootoutGoals}:${awayGoalsEntry.shootoutGoals}`
        outcome = 'D'
      } else if (goalsFor > goalsAgainst) {
        outcome = 'W'
      } else if (goalsFor < goalsAgainst) {
        outcome = 'L'
      } else {
        outcome = 'D'
      }
    }

    const venue = matchVenueById.get(match_id) ?? null
    const polandTeamId = matchPolandTeamIdMap.get(match_id) ?? null
    const opponentTeamId = polandTeamId
      ? (polandTeamId === matchData.home_team_id ? matchData.away_team_id : matchData.home_team_id)
      : null
    const opponentCountryId = opponentTeamId
      ? (teamLinks.find((t) => t.id === opponentTeamId)?.country_id ?? null)
      : null
    let venueType: 'HOME' | 'AWAY' | 'NEUTRAL' | null = null
    if (venue?.venue_country_id) {
      if (polandCountryId && venue.venue_country_id === polandCountryId) venueType = 'HOME'
      else if (opponentCountryId && venue.venue_country_id === opponentCountryId) venueType = 'AWAY'
      else venueType = 'NEUTRAL'
    }

    const existing = result.get(person_id) ?? []
    existing.push({
      match_id,
      match_date: matchData.match_date,
      match_time: matchData.match_time,
      match_status: matchData.match_status,
      result_type: matchData.result_type,
      walkover_winner_team_id: matchData.walkover_winner_team_id,
      editorial_status: matchData.editorial_status,
      competition_key: competitionKey,
      competition_name: competitionName ?? '',
      stage_key: stageKey,
      match_level_name: levelName,
      home_team_name: homeTeam.name,
      away_team_name: awayTeam.name,
      home_team_fifa_code: homeTeam.fifa_code,
      away_team_fifa_code: awayTeam.fifa_code,
      coach_team_id: coachedTeamId,
      coach_team_fifa_code: coachedTeamFifaCode,
      coach_is_home: coachIsHome,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      final_score: finalScore,
      shootout_score: shootoutScore,
      outcome,
      venue_country_id: venue?.venue_country_id ?? null,
      venue_country_name: venue?.venue_country_name ?? null,
      venue_city_id: venue?.venue_city_id ?? null,
      venue_city_name: venue?.venue_city_name ?? null,
      venue_stadium_id: venue?.venue_stadium_id ?? null,
      venue_stadium_name: venue?.venue_stadium_name ?? null,
      venue_type: venueType,
    })
    result.set(person_id, existing)
  }

  return result
}

export type DuplicatePerson = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
  birth_date: string | null
  birth_country_name: string | null
}

export async function findDuplicatePeopleByBirthDateAndCountry(
  birthDate: string,
  birthCountryId: string
): Promise<DuplicatePerson[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, birth_country_id')
    .eq('birth_date', birthDate)
    .eq('birth_country_id', birthCountryId)

  if (error) throw new Error(`tbl_People: ${error.message}`)
  if (!people?.length) return []

  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]
  let countryNameById = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((c) => [c.id, c.name ?? '']))
  }

  return people.map((p) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    nickname: p.nickname ?? null,
    birth_date: p.birth_date ?? null,
    birth_country_name: p.birth_country_id ? (countryNameById.get(p.birth_country_id) ?? null) : null,
  }))
}

export async function getAdminPersonBirthCityOptions(): Promise<AdminPersonBirthCityOption[]> {
  const supabase = createServiceRoleClient()

  const { data: cities, error: citiesError } = await supabase
    .from('tbl_Cities')
    .select('id, city_name')
    .order('city_name', { ascending: true })

  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (!cities?.length) return []

  const cityIds = cities.map((city) => city.id)

  // Avoid oversized `.in(...)` queries that can fail at fetch layer when city count is high.
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

  const periodsByCity = new Map<string, CityCountryPeriod[]>()
  for (const period of periods) {
    const arr = periodsByCity.get(period.city_id) ?? []
    arr.push(period)
    periodsByCity.set(period.city_id, arr)
  }

  const currentCountryIdByCity = new Map<string, string>()
  for (const cityId of cityIds) {
    const best = sortPeriods(periodsByCity.get(cityId) ?? [])[0]
    if (best?.country_id) currentCountryIdByCity.set(cityId, best.country_id)
  }

  const countryIds = [...new Set([...currentCountryIdByCity.values()])]
  let countryNameById = new Map<string, string>()

  if (countryIds.length) {
    const { data: countries, error: countriesError } = await supabase
      .from('tbl_Countries')
      .select('id, name')
      .in('id', countryIds)

    if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)
    countryNameById = new Map((countries ?? []).map((country) => [country.id, country.name]))
  }

  return cities.map((city) => {
    const currentCountryId = currentCountryIdByCity.get(city.id) ?? null

    return {
      id: city.id,
      city_name: city.city_name ?? '—',
      current_country_id: currentCountryId,
      current_country_name: currentCountryId ? (countryNameById.get(currentCountryId) ?? null) : null,
    }
  })
}

type PersonStatRow = {
  appearance_count: number
  starting_appearance_count: number
  sub_on_count: number
  sub_off_count: number
  goal_count: number
  assist_count: number
  yellow_card_count: number
  red_card_count: number
  minute_count: number
  bench_count: number
}

type PersonRoleMatchCounts = {
  player_match_count: number
  coach_match_count: number
  referee_match_count: number
}

type CoachResultStats = {
  coach_match_count: number
  coach_wins: number
  coach_draws: number
  coach_losses: number
  coach_goals_scored: number
  coach_goals_conceded: number
  coach_poland_match_count: number
  coach_poland_wins: number
  coach_poland_draws: number
  coach_poland_losses: number
  coach_poland_goals_scored: number
  coach_poland_goals_conceded: number
  coach_against_poland_match_count: number
  coach_against_poland_wins: number
  coach_against_poland_draws: number
  coach_against_poland_losses: number
  coach_against_poland_goals_scored: number
  coach_against_poland_goals_conceded: number
}

function getCoachPointsPerMatch(input: {
  coachMatchCount: number
  coachWins: number
  coachDraws: number
}): number {
  if (input.coachMatchCount <= 0) return 0
  const pointsSum = (input.coachWins * 3) + input.coachDraws
  return pointsSum / input.coachMatchCount
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

async function getRoleMatchCountsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, PersonRoleMatchCounts>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000
  type ParticipantRoleRow = { person_id: string; role: string; match_id: string }
  const allParticipants: ParticipantRoleRow[] = []

  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, role, match_id')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw new Error(`tbl_Match_Participants (role counts): ${error.message}`)

      const rows = (data ?? []) as ParticipantRoleRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  const allMatchIds = [...new Set(allParticipants.map((row) => row.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((row) => nonWalkoverMatchIds.has(row.match_id))

  const buckets = new Map<string, { PLAYER: Set<string>; COACH: Set<string>; REFEREE: Set<string> }>()

  for (const row of filteredParticipants) {
    const role = row.role as AdminPersonRole
    if (!(role in ROLE_ORDER)) continue
    const existing = buckets.get(row.person_id) ?? {
      PLAYER: new Set<string>(),
      COACH: new Set<string>(),
      REFEREE: new Set<string>(),
    }
    existing[role].add(row.match_id)
    buckets.set(row.person_id, existing)
  }

  const counts = new Map<string, PersonRoleMatchCounts>()
  for (const personId of personIds) {
    const existing = buckets.get(personId)
    counts.set(personId, {
      player_match_count: existing?.PLAYER.size ?? 0,
      coach_match_count: existing?.COACH.size ?? 0,
      referee_match_count: existing?.REFEREE.size ?? 0,
    })
  }

  return counts
}

async function getCoachResultStatsByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, CoachResultStats>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  // 1. Get all COACH participations (person_id, match_id, team_id coached)
  type CoachParticipantRow = { person_id: string; match_id: string; team_id: string | null }
  const participations: CoachParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, team_id')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .eq('role', 'COACH')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants (coach stats): ${error.message}`)
      const rows = (data ?? []) as CoachParticipantRow[]
      participations.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!participations.length) return new Map()

  // 2. Get match data for all coach matches
  const allMatchIds = [...new Set(participations.map((p) => p.match_id))]
  const nonWalkoverMatchIdsSet = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipations = participations.filter((p) => nonWalkoverMatchIdsSet.has(p.match_id))
  if (!filteredParticipations.length) return new Map()

  const filteredMatchIds = [...new Set(filteredParticipations.map((p) => p.match_id))]
  type MatchRow = { id: string; home_team_id: string; away_team_id: string; result_type: string | null; match_status: string }
  const matchDataMap = new Map<string, MatchRow>()
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, home_team_id, away_team_id, result_type, match_status')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (coach stats): ${error.message}`)
    for (const m of (data ?? []) as MatchRow[]) matchDataMap.set(m.id, m)
  }

  // 3. Get goal events for all coach matches
  type GoalEventRow = { match_id: string; event_type: string; team_id: string | null }
  const goalEvents: GoalEventRow[] = []
  const GOAL_EVENT_TYPES = ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'PENALTY_SHOOTOUT_SCORED']
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, event_type, team_id')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .in('event_type', GOAL_EVENT_TYPES)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (coach stats): ${error.message}`)
      const rows = (data ?? []) as GoalEventRow[]
      goalEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  // 4. Build per-match goal tally keyed by (matchId, teamId) — for each team separately
  // OWN_GOAL: team_id = team whose player scored it (they concede), so OWN_GOAL with team_id T
  //   means team T concedes → counted as a goal FOR the OTHER team
  type TeamGoals = { goals: number; shootoutGoals: number }
  const teamGoalsInMatch = new Map<string, TeamGoals>() // key: `${matchId}:${teamId}`

  for (const event of goalEvents) {
    if (!event.team_id) continue
    const matchData = matchDataMap.get(event.match_id)
    if (!matchData) continue

    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') {
      // shootout scored: team_id = team who scored
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.shootoutGoals += 1
      teamGoalsInMatch.set(key, entry)
    } else if (event.event_type === 'OWN_GOAL') {
      // OWN_GOAL: team_id = team of the player who scored the own goal (they concede)
      // → goal goes to the OTHER team in the match
      const otherTeamId = matchData.home_team_id === event.team_id
        ? matchData.away_team_id
        : matchData.home_team_id
      const key = `${event.match_id}:${otherTeamId}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    } else {
      // GOAL, PENALTY_GOAL: team_id = team who scored
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    }
  }

  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(supabase, filteredMatchIds)

  function createEmptyCoachStats(): CoachResultStats {
    return {
      coach_match_count: 0,
      coach_wins: 0,
      coach_draws: 0,
      coach_losses: 0,
      coach_goals_scored: 0,
      coach_goals_conceded: 0,
      coach_poland_match_count: 0,
      coach_poland_wins: 0,
      coach_poland_draws: 0,
      coach_poland_losses: 0,
      coach_poland_goals_scored: 0,
      coach_poland_goals_conceded: 0,
      coach_against_poland_match_count: 0,
      coach_against_poland_wins: 0,
      coach_against_poland_draws: 0,
      coach_against_poland_losses: 0,
      coach_against_poland_goals_scored: 0,
      coach_against_poland_goals_conceded: 0,
    }
  }

  // 5. Aggregate W/D/L and goals per coach (from coached team's perspective)
  // and split into context: coached Poland vs coached opponents of Poland.
  const result = new Map<string, CoachResultStats>()
  for (const { person_id, match_id, team_id: coachedTeamId } of filteredParticipations) {
    if (!coachedTeamId) continue
    const matchData = matchDataMap.get(match_id)
    if (!matchData) continue

    const polandTeamId = matchPolandTeamIdMap.get(match_id) ?? null
    const coachedPoland = Boolean(polandTeamId && coachedTeamId === polandTeamId)
    const coachedAgainstPoland = Boolean(polandTeamId && coachedTeamId !== polandTeamId)

    const existing = result.get(person_id) ?? createEmptyCoachStats()
    existing.coach_match_count += 1
    if (coachedPoland) {
      existing.coach_poland_match_count += 1
    } else if (coachedAgainstPoland) {
      existing.coach_against_poland_match_count += 1
    }

    if (matchData.match_status !== 'FINISHED') {
      result.set(person_id, existing)
      continue
    }

    const otherTeamId = matchData.home_team_id === coachedTeamId
      ? matchData.away_team_id
      : matchData.home_team_id

    const myGoalsEntry = teamGoalsInMatch.get(`${match_id}:${coachedTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
    const theirGoalsEntry = teamGoalsInMatch.get(`${match_id}:${otherTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
    const myGoals = myGoalsEntry.goals
    const theirGoals = theirGoalsEntry.goals

    existing.coach_goals_scored += myGoals
    existing.coach_goals_conceded += theirGoals
    if (coachedPoland) {
      existing.coach_poland_goals_scored += myGoals
      existing.coach_poland_goals_conceded += theirGoals
    } else if (coachedAgainstPoland) {
      existing.coach_against_poland_goals_scored += myGoals
      existing.coach_against_poland_goals_conceded += theirGoals
    }

    const rt = matchData.result_type
    const decidedByPenalties = rt === 'PENALTIES' || rt === 'EXTRA_TIME_AND_PENALTIES'

    if (decidedByPenalties) {
      existing.coach_draws += 1
      if (coachedPoland) existing.coach_poland_draws += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_draws += 1
    } else if (myGoals > theirGoals) {
      existing.coach_wins += 1
      if (coachedPoland) existing.coach_poland_wins += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_wins += 1
    } else if (myGoals < theirGoals) {
      existing.coach_losses += 1
      if (coachedPoland) existing.coach_poland_losses += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_losses += 1
    } else {
      existing.coach_draws += 1
      if (coachedPoland) existing.coach_poland_draws += 1
      else if (coachedAgainstPoland) existing.coach_against_poland_draws += 1
    }
    result.set(person_id, existing)
  }

  return result
}

type RefereePolandStats = {
  referee_wins: number
  referee_draws: number
  referee_losses: number
  referee_goals_scored: number
  referee_goals_conceded: number
}

function aggregateRefereePolandStats(matches: RefereeFilterMatch[]): RefereePolandStats {
  const stats: RefereePolandStats = {
    referee_wins: 0, referee_draws: 0, referee_losses: 0, referee_goals_scored: 0, referee_goals_conceded: 0,
  }
  for (const row of matches) {
    if (row.match_status !== 'FINISHED') continue
    stats.referee_goals_scored += row.goals_for
    stats.referee_goals_conceded += row.goals_against
    if (row.outcome === 'W') stats.referee_wins += 1
    else if (row.outcome === 'L') stats.referee_losses += 1
    else if (row.outcome === 'D') stats.referee_draws += 1
  }
  return stats
}

async function getRefereePolandFilterMatchesByPersonId(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, RefereeFilterMatch[]>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  // 1. Get all REFEREE participations
  type RefParticipantRow = { person_id: string; match_id: string }
  const allParticipants: RefParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id')
        .eq('role', 'REFEREE')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants (referee filter rows): ${error.message}`)
      const rows = (data ?? []) as RefParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) return new Map()

  // 2. Filter walkovers
  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIdsSet = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIdsSet.has(p.match_id))
  if (!filteredParticipants.length) return new Map()

  // 3. Find Poland's team_id per match — only keep Poland matches
  const candidateMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]
  const matchPolandTeamIdMap = await getPolandTeamIdByMatchId(supabase, candidateMatchIds)
  const polandParticipants = filteredParticipants.filter((p) => matchPolandTeamIdMap.get(p.match_id))
  if (!polandParticipants.length) return new Map()

  const filteredMatchIds = [...new Set(polandParticipants.map((p) => p.match_id))]

  // 4. Get match data + competition/level
  type MatchRow = {
    id: string
    match_date: string
    match_time: string | null
    home_team_id: string
    away_team_id: string
    match_status: string | null
    result_type: string | null
    walkover_winner_team_id: string | null
    editorial_status: string
    competition_id: string | null
    match_level_id: string | null
    match_stadium_id: string | null
    match_city_id: string | null
  }
  const matchDataById = new Map<string, MatchRow>()
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, match_date, match_time, home_team_id, away_team_id, match_status, result_type, walkover_winner_team_id, editorial_status, competition_id, match_level_id, match_stadium_id, match_city_id')
      .in('id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (referee filter rows): ${error.message}`)
    for (const row of (data ?? []) as MatchRow[]) matchDataById.set(row.id, row)
  }

  const competitionIds = [...new Set(
    [...matchDataById.values()].map((m) => m.competition_id).filter((id): id is string => Boolean(id))
  )]
  const competitionNameById = new Map<string, string>()
  for (let i = 0; i < competitionIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Competitions')
      .select('id, name')
      .in('id', competitionIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Competitions (referee filter rows): ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
      competitionNameById.set(row.id, row.name)
    }
  }

  const levelIds = [...new Set(
    [...matchDataById.values()].map((m) => m.match_level_id).filter((id): id is string => Boolean(id))
  )]
  const levelNameById = new Map<string, string>()
  for (let i = 0; i < levelIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Match_Levels')
      .select('id, name')
      .in('id', levelIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Match_Levels (referee filter rows): ${error.message}`)
    for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
      levelNameById.set(row.id, row.name)
    }
  }

  // 5. Goal events
  type GoalEventRow = { match_id: string; event_type: string; team_id: string | null }
  const goalEvents: GoalEventRow[] = []
  const GOAL_EVENT_TYPES = ['GOAL', 'PENALTY_GOAL', 'OWN_GOAL', 'PENALTY_SHOOTOUT_SCORED']
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, event_type, team_id')
        .in('match_id', filteredMatchIds.slice(i, i + CHUNK_SIZE))
        .in('event_type', GOAL_EVENT_TYPES)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Events (referee filter rows): ${error.message}`)
      const rows = (data ?? []) as GoalEventRow[]
      goalEvents.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  type TeamGoals = { goals: number; shootoutGoals: number }
  const teamGoalsInMatch = new Map<string, TeamGoals>()
  for (const event of goalEvents) {
    if (!event.team_id) continue
    const matchData = matchDataById.get(event.match_id)
    if (!matchData) continue

    if (event.event_type === 'PENALTY_SHOOTOUT_SCORED') {
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.shootoutGoals += 1
      teamGoalsInMatch.set(key, entry)
    } else if (event.event_type === 'OWN_GOAL') {
      const otherTeamId = matchData.home_team_id === event.team_id ? matchData.away_team_id : matchData.home_team_id
      const key = `${event.match_id}:${otherTeamId}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    } else {
      const key = `${event.match_id}:${event.team_id}`
      const entry = teamGoalsInMatch.get(key) ?? { goals: 0, shootoutGoals: 0 }
      entry.goals += 1
      teamGoalsInMatch.set(key, entry)
    }
  }

  // 6. Team names + fifa codes (via country/club join — same approach as coach version)
  const allTeamIds = [...new Set(
    [...matchDataById.values()].flatMap((m) => [m.home_team_id, m.away_team_id])
  )]
  type TeamLinkRow = { id: string; country_id: string | null; club_id: string | null }
  const teamLinks: TeamLinkRow[] = []
  for (let i = 0; i < allTeamIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', allTeamIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Teams (referee filter rows): ${error.message}`)
    teamLinks.push(...(data ?? []) as TeamLinkRow[])
  }

  const teamCountryIds = [...new Set(teamLinks.map((t) => t.country_id).filter((id): id is string => Boolean(id)))]
  const teamClubIds = [...new Set(teamLinks.map((t) => t.club_id).filter((id): id is string => Boolean(id)))]

  type CountryNameFifaRow = { id: string; name: string; fifa_code: string | null }
  const countryNameFifaById = new Map<string, CountryNameFifaRow>()
  for (let i = 0; i < teamCountryIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Countries')
      .select('id, name, fifa_code')
      .in('id', teamCountryIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Countries (referee filter rows): ${error.message}`)
    for (const row of (data ?? []) as CountryNameFifaRow[]) countryNameFifaById.set(row.id, row)
  }

  type ClubNameRow = { id: string; name: string }
  const clubNameById = new Map<string, string>()
  for (let i = 0; i < teamClubIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Clubs')
      .select('id, name')
      .in('id', teamClubIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Clubs (referee filter rows): ${error.message}`)
    for (const row of (data ?? []) as ClubNameRow[]) clubNameById.set(row.id, row.name)
  }

  const getTeamName = (teamId: string): string => {
    const link = teamLinks.find((t) => t.id === teamId)
    if (!link) return '—'
    if (link.country_id) return countryNameFifaById.get(link.country_id)?.name ?? '—'
    if (link.club_id) return clubNameById.get(link.club_id) ?? '—'
    return '—'
  }
  const getTeamFifaCode = (teamId: string): string | null => {
    const link = teamLinks.find((t) => t.id === teamId)
    if (!link?.country_id) return null
    return countryNameFifaById.get(link.country_id)?.fifa_code ?? null
  }

  const polandCountryId = await getPolandCountryId(supabase)
  const matchVenueById = await getMatchVenuesByMatchId(
    supabase,
    [...matchDataById.values()].map((m) => ({
      id: m.id,
      match_date: m.match_date,
      match_stadium_id: m.match_stadium_id,
      match_city_id: m.match_city_id,
    }))
  )

  const result = new Map<string, RefereeFilterMatch[]>()
  for (const { person_id, match_id } of polandParticipants) {
    const matchData = matchDataById.get(match_id)
    if (!matchData) continue
    const polandTeamId = matchPolandTeamIdMap.get(match_id) ?? null
    if (!polandTeamId) continue

    const competitionName = matchData.competition_id ? (competitionNameById.get(matchData.competition_id) ?? null) : null
    const levelName = matchData.match_level_id ? (levelNameById.get(matchData.match_level_id) ?? null) : null
    const competitionKey = mapCompetitionNameToFilterKey(competitionName)
    const stageKey = mapLevelNameToStageKey(levelName)

    const homeTeam = { name: getTeamName(matchData.home_team_id), fifa_code: getTeamFifaCode(matchData.home_team_id) }
    const awayTeam = { name: getTeamName(matchData.away_team_id), fifa_code: getTeamFifaCode(matchData.away_team_id) }
    const polandIsHome = matchData.home_team_id === polandTeamId
    const polandFifaCode = getTeamFifaCode(polandTeamId)

    let goalsFor = 0
    let goalsAgainst = 0
    let outcome: 'W' | 'D' | 'L' | null = null
    let finalScore: string | null = null
    let shootoutScore: string | null = null

    if (matchData.match_status === 'FINISHED') {
      const otherTeamId = polandIsHome ? matchData.away_team_id : matchData.home_team_id
      const myGoalsEntry = teamGoalsInMatch.get(`${match_id}:${polandTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
      const theirGoalsEntry = teamGoalsInMatch.get(`${match_id}:${otherTeamId}`) ?? { goals: 0, shootoutGoals: 0 }
      goalsFor = myGoalsEntry.goals
      goalsAgainst = theirGoalsEntry.goals

      const homeGoalsEntry = teamGoalsInMatch.get(`${match_id}:${matchData.home_team_id}`) ?? { goals: 0, shootoutGoals: 0 }
      const awayGoalsEntry = teamGoalsInMatch.get(`${match_id}:${matchData.away_team_id}`) ?? { goals: 0, shootoutGoals: 0 }
      finalScore = `${homeGoalsEntry.goals}:${awayGoalsEntry.goals}`

      const isPenalties = matchData.result_type === 'PENALTIES' || matchData.result_type === 'EXTRA_TIME_AND_PENALTIES'
      if (isPenalties) {
        shootoutScore = `${homeGoalsEntry.shootoutGoals}:${awayGoalsEntry.shootoutGoals}`
        outcome = 'D'
      } else if (goalsFor > goalsAgainst) {
        outcome = 'W'
      } else if (goalsFor < goalsAgainst) {
        outcome = 'L'
      } else {
        outcome = 'D'
      }
    }

    const existing = result.get(person_id) ?? []
    const venue = matchVenueById.get(match_id) ?? null
    const opponentTeamId = polandIsHome ? matchData.away_team_id : matchData.home_team_id
    const opponentCountryId = teamLinks.find((t) => t.id === opponentTeamId)?.country_id ?? null
    let venueType: 'HOME' | 'AWAY' | 'NEUTRAL' | null = null
    if (venue?.venue_country_id) {
      if (polandCountryId && venue.venue_country_id === polandCountryId) venueType = 'HOME'
      else if (opponentCountryId && venue.venue_country_id === opponentCountryId) venueType = 'AWAY'
      else venueType = 'NEUTRAL'
    }
    existing.push({
      match_id,
      match_date: matchData.match_date,
      match_time: matchData.match_time,
      match_status: matchData.match_status,
      result_type: matchData.result_type,
      walkover_winner_team_id: matchData.walkover_winner_team_id,
      editorial_status: matchData.editorial_status,
      competition_key: competitionKey,
      competition_name: competitionName ?? '',
      stage_key: stageKey,
      match_level_name: levelName,
      home_team_name: homeTeam.name,
      away_team_name: awayTeam.name,
      home_team_fifa_code: homeTeam.fifa_code,
      away_team_fifa_code: awayTeam.fifa_code,
      poland_team_id: polandTeamId,
      poland_team_fifa_code: polandFifaCode,
      poland_is_home: polandIsHome,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      final_score: finalScore,
      shootout_score: shootoutScore,
      outcome,
      venue_country_id: venue?.venue_country_id ?? null,
      venue_country_name: venue?.venue_country_name ?? null,
      venue_city_id: venue?.venue_city_id ?? null,
      venue_city_name: venue?.venue_city_name ?? null,
      venue_stadium_id: venue?.venue_stadium_id ?? null,
      venue_stadium_name: venue?.venue_stadium_name ?? null,
      venue_type: venueType,
    })
    result.set(person_id, existing)
  }

  return result
}

async function getPersonStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personIds: string[]
): Promise<Map<string, PersonStatRow>> {
  if (!personIds.length) return new Map()

  const CHUNK_SIZE = 80
  const PAGE_SIZE = 1000

  type ParticipantRow = { person_id: string; match_id: string; is_starting: boolean | null }
  const allParticipants: ParticipantRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Participants')
        .select('person_id, match_id, is_starting')
        .eq('role', 'PLAYER')
        .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
      const rows = (data ?? []) as ParticipantRow[]
      allParticipants.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  if (!allParticipants.length) return new Map()

  const allMatchIds = [...new Set(allParticipants.map((p) => p.match_id))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipants = allParticipants.filter((p) => nonWalkoverMatchIds.has(p.match_id))
  if (!filteredParticipants.length) return new Map()

  const filteredMatchIds = [...new Set(filteredParticipants.map((p) => p.match_id))]

  type SubEvent = {
    match_id: string
    primary_person_id: string | null
    secondary_person_id: string | null
    minute: number
    minute_extra: number | null
  }
  const allSubEvents: SubEvent[] = []
  for (let i = 0; i < filteredMatchIds.length; i += CHUNK_SIZE) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tbl_Match_Events')
        .select('match_id, primary_person_id, secondary_person_id, minute, minute_extra')
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

  const subEnteredSet = new Set(
    allSubEvents
      .filter((e) => e.secondary_person_id)
      .map((e) => `${e.match_id}:${e.secondary_person_id as string}`)
  )
  type SubEntry = { minute: number; extra: number }
  const subOnByMatchPerson = new Map<string, SubEntry>()
  const subOffByMatchPerson = new Map<string, SubEntry>()
  for (const e of allSubEvents) {
    if (e.secondary_person_id) {
      subOnByMatchPerson.set(`${e.match_id}:${e.secondary_person_id}`, {
        minute: e.minute,
        extra: e.minute_extra ?? 0,
      })
    }
    if (e.primary_person_id) {
      subOffByMatchPerson.set(`${e.match_id}:${e.primary_person_id}`, {
        minute: e.minute,
        extra: e.minute_extra ?? 0,
      })
    }
  }
  const playedParticipants = allParticipants.filter(
    (p) => nonWalkoverMatchIds.has(p.match_id)
      && (p.is_starting || subEnteredSet.has(`${p.match_id}:${p.person_id}`))
  )

  const benchParticipants = allParticipants.filter(
    (p) => nonWalkoverMatchIds.has(p.match_id)
      && !p.is_starting && !subEnteredSet.has(`${p.match_id}:${p.person_id}`)
  )
  const benchMap = new Map<string, number>()
  for (const p of benchParticipants) {
    benchMap.set(p.person_id, (benchMap.get(p.person_id) ?? 0) + 1)
  }

  const playedMatchIds = [...new Set(playedParticipants.map((p) => p.match_id))]
  const playedPersonIds = new Set(playedParticipants.map((p) => p.person_id))

  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', playedMatchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches (result_type): ${error.message}`)
    for (const m of data ?? []) {
      matchResultTypeMap.set(m.id as string, m.result_type as string | null)
    }
  }

  const appearanceMap = new Map<string, number>()
  for (const p of playedParticipants) {
    appearanceMap.set(p.person_id, (appearanceMap.get(p.person_id) ?? 0) + 1)
  }

  const startingMap = new Map<string, number>()
  for (const p of filteredParticipants) {
    if (!p.is_starting) continue
    startingMap.set(p.person_id, (startingMap.get(p.person_id) ?? 0) + 1)
  }

  const subOnMap = new Map<string, number>()
  for (const p of playedParticipants) {
    if (p.is_starting) continue
    subOnMap.set(p.person_id, (subOnMap.get(p.person_id) ?? 0) + 1)
  }

  const subOffMap = new Map<string, number>()
  for (const e of allSubEvents) {
    if (!e.primary_person_id) continue
    subOffMap.set(e.primary_person_id, (subOffMap.get(e.primary_person_id) ?? 0) + 1)
  }

  type PrimaryEvent = { primary_person_id: string }
  type SecondaryEvent = { secondary_person_id: string }

  const allGoals: PrimaryEvent[] = []
  const allAssists: SecondaryEvent[] = []
  const allYellows: PrimaryEvent[] = []
  const allReds: PrimaryEvent[] = []

  for (let i = 0; i < playedMatchIds.length; i += CHUNK_SIZE) {
    const batch = playedMatchIds.slice(i, i + CHUNK_SIZE)
    let fromG = 0
    while (true) {
      const goalsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['GOAL', 'PENALTY_GOAL']).in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromG, fromG + PAGE_SIZE - 1)
      if (goalsRes.error) throw new Error(`tbl_Match_Events (goals): ${goalsRes.error.message}`)
      allGoals.push(...((goalsRes.data ?? []) as PrimaryEvent[]))
      if ((goalsRes.data ?? []).length < PAGE_SIZE) break
      fromG += PAGE_SIZE
    }
    let fromA = 0
    while (true) {
      const assistsRes = await supabase.from('tbl_Match_Events').select('secondary_person_id').in('event_type', ['GOAL', 'OWN_GOAL']).in('match_id', batch).not('secondary_person_id', 'is', null).order('id', { ascending: true }).range(fromA, fromA + PAGE_SIZE - 1)
      if (assistsRes.error) throw new Error(`tbl_Match_Events (assists): ${assistsRes.error.message}`)
      allAssists.push(...((assistsRes.data ?? []) as SecondaryEvent[]))
      if ((assistsRes.data ?? []).length < PAGE_SIZE) break
      fromA += PAGE_SIZE
    }
    let fromY = 0
    while (true) {
      const yellowsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').eq('event_type', 'YELLOW_CARD').in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromY, fromY + PAGE_SIZE - 1)
      if (yellowsRes.error) throw new Error(`tbl_Match_Events (yellow cards): ${yellowsRes.error.message}`)
      allYellows.push(...((yellowsRes.data ?? []) as PrimaryEvent[]))
      if ((yellowsRes.data ?? []).length < PAGE_SIZE) break
      fromY += PAGE_SIZE
    }
    let fromR = 0
    while (true) {
      const redsRes = await supabase.from('tbl_Match_Events').select('primary_person_id').in('event_type', ['RED_CARD', 'SECOND_YELLOW_CARD']).in('match_id', batch).not('primary_person_id', 'is', null).order('id', { ascending: true }).range(fromR, fromR + PAGE_SIZE - 1)
      if (redsRes.error) throw new Error(`tbl_Match_Events (red cards): ${redsRes.error.message}`)
      allReds.push(...((redsRes.data ?? []) as PrimaryEvent[]))
      if ((redsRes.data ?? []).length < PAGE_SIZE) break
      fromR += PAGE_SIZE
    }
  }

  const statsMap = new Map<string, PersonStatRow>()
  const allPersonIds = new Set([...playedPersonIds, ...benchParticipants.map((p) => p.person_id)])
  for (const personId of allPersonIds) {
    statsMap.set(personId, {
      appearance_count: appearanceMap.get(personId) ?? 0,
      starting_appearance_count: startingMap.get(personId) ?? 0,
      sub_on_count: subOnMap.get(personId) ?? 0,
      sub_off_count: subOffMap.get(personId) ?? 0,
      goal_count: 0,
      assist_count: 0,
      yellow_card_count: 0,
      red_card_count: 0,
      minute_count: 0,
      bench_count: benchMap.get(personId) ?? 0,
    })
  }
  for (const p of playedParticipants) {
    const stats = statsMap.get(p.person_id)
    if (!stats) continue

    const resultType = matchResultTypeMap.get(p.match_id) ?? null
    const hasExtraTime =
      resultType === 'EXTRA_TIME' ||
      resultType === 'EXTRA_TIME_AND_PENALTIES' ||
      resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90

    const isStarter = p.is_starting === true
    const subOn = isStarter ? null : (subOnByMatchPerson.get(`${p.match_id}:${p.person_id}`) ?? null)
    if (!isStarter && !subOn) continue

    const subOff = subOffByMatchPerson.get(`${p.match_id}:${p.person_id}`) ?? null

    const entryMin = isStarter ? 0 : subOn!.minute
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // Count full minute blocks from entry minute onward.
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    // Exiting in a regular minute (e.g. 46) means last played minute is previous one (45).
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

    stats.minute_count += Math.max(0, effectiveExit - effectiveEntry)
  }
  for (const e of allGoals) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.goal_count++
  }
  for (const e of allAssists) {
    const s = e.secondary_person_id ? statsMap.get(e.secondary_person_id) : null
    if (s) s.assist_count++
  }
  for (const e of allYellows) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.yellow_card_count++
  }
  for (const e of allReds) {
    const s = e.primary_person_id ? statsMap.get(e.primary_person_id) : null
    if (s) s.red_card_count++
  }

  return statsMap
}

/**
 * Computes total regular-time minutes on pitch for a single player.
 * Injury/stoppage time is ignored: a player entering during added time of any
 * half/period is credited with 1 minute for that period.
 */
async function getPlayerMinutes(
  supabase: ReturnType<typeof createServiceRoleClient>,
  personId: string
): Promise<number> {
  const { data: participations, error: partError } = await supabase
    .from('tbl_Match_Participants')
    .select('match_id, is_starting')
    .eq('role', 'PLAYER')
    .eq('person_id', personId)
  if (partError) throw new Error(`tbl_Match_Participants (minutes): ${partError.message}`)
  if (!participations?.length) return 0

  const allMatchIds = [...new Set(participations.map((p) => p.match_id as string))]
  const nonWalkoverMatchIds = await getNonWalkoverMatchIdSet(supabase, allMatchIds)
  const filteredParticipations = participations.filter((p) => nonWalkoverMatchIds.has(p.match_id as string))
  if (!filteredParticipations.length) return 0

  const [subOnRes, subOffRes] = await Promise.all([
    supabase
      .from('tbl_Match_Events')
      .select('match_id, minute, minute_extra')
      .eq('event_type', 'SUBSTITUTION')
      .eq('secondary_person_id', personId),
    supabase
      .from('tbl_Match_Events')
      .select('match_id, minute, minute_extra')
      .eq('event_type', 'SUBSTITUTION')
      .eq('primary_person_id', personId),
  ])
  if (subOnRes.error) throw new Error(`tbl_Match_Events (sub-on): ${subOnRes.error.message}`)
  if (subOffRes.error) throw new Error(`tbl_Match_Events (sub-off): ${subOffRes.error.message}`)

  type SubEntry = { minute: number; extra: number }
  const subOnByMatch = new Map<string, SubEntry>(
    (subOnRes.data ?? []).map((e) => [e.match_id as string, { minute: e.minute as number, extra: (e.minute_extra as number | null) ?? 0 }])
  )
  const subOffByMatch = new Map<string, SubEntry>(
    (subOffRes.data ?? []).map((e) => [e.match_id as string, { minute: e.minute as number, extra: (e.minute_extra as number | null) ?? 0 }])
  )

  const subOnMatchIds = new Set(
    (subOnRes.data ?? [])
      .map((e) => e.match_id as string)
      .filter((matchId) => nonWalkoverMatchIds.has(matchId))
  )
  const playedParticipations = filteredParticipations.filter(
    (p) => p.is_starting || subOnMatchIds.has(p.match_id)
  )
  if (!playedParticipations.length) return 0

  const playedMatchIds = [...new Set(playedParticipations.map((p) => p.match_id))]
  const CHUNK = 80
  const matchResultTypeMap = new Map<string, string | null>()
  for (let i = 0; i < playedMatchIds.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, result_type')
      .in('id', playedMatchIds.slice(i, i + CHUNK))
    if (error) throw new Error(`tbl_Matches (result_type): ${error.message}`)
    for (const m of data ?? []) matchResultTypeMap.set(m.id as string, m.result_type as string | null)
  }

  let totalMinutes = 0
  for (const p of playedParticipations) {
    const resultType = matchResultTypeMap.get(p.match_id) ?? null
    const hasExtraTime =
      resultType === 'EXTRA_TIME' ||
      resultType === 'EXTRA_TIME_AND_PENALTIES' ||
      resultType === 'GOLDEN_GOAL'
    const matchRegularEnd = hasExtraTime ? 120 : 90

    const isStarter = p.is_starting === true
    const subOn = isStarter ? null : (subOnByMatch.get(p.match_id) ?? null)
    if (!isStarter && !subOn) continue

    const subOff = subOffByMatch.get(p.match_id) ?? null

    const entryMin = isStarter ? 0 : subOn!.minute
    const exitMin = subOff ? subOff.minute : matchRegularEnd
    const exitExtra = subOff ? subOff.extra : 0

    // Count full minute blocks from entry minute onward.
    const effectiveEntry = entryMin > 0 ? entryMin - 1 : entryMin
    // Exiting in a regular minute (e.g. 46) means last played minute is previous one (45).
    const effectiveExitBase = subOff ? (exitExtra > 0 ? exitMin : exitMin - 1) : matchRegularEnd
    const effectiveExit = Math.min(Math.max(0, effectiveExitBase), matchRegularEnd)

    totalMinutes += Math.max(0, effectiveExit - effectiveEntry)
  }

  return totalMinutes
}

export async function getAdminPeople(): Promise<AdminPersonListItem[]> {
  const supabase = createServiceRoleClient()

  const { data: people, error: peopleError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id')

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return []

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  // Batch cities to avoid oversized .in() queries that can fail at the fetch layer
  const CITY_CHUNK = 80
  const cityMap = new Map<string, string | null>()
  for (let i = 0; i < cityIds.length; i += CITY_CHUNK) {
    const { data: cityBatch, error: citiesError } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds.slice(i, i + CITY_CHUNK))
    if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
    for (const c of cityBatch ?? []) cityMap.set(c.id, c.city_name)
  }

  const { data: countries, error: countriesError } = countryIds.length
    ? await supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
    : { data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const representedCountryIdsByPersonId = await getExplicitRepresentedCountryIdsByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const playerIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('PLAYER'))
    .map((p) => p.id)
  const coachIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('COACH'))
    .map((p) => p.id)
  const refereeIds = people
    .filter((p) => (rolesByPersonId.get(p.id) ?? []).includes('REFEREE'))
    .map((p) => p.id)
  const [statsByPersonId, coachResultStatsByPersonId, refereePolandFilterMatchesByPersonId] = await Promise.all([
    getPersonStats(supabase, playerIds),
    getCoachResultStatsByPersonId(supabase, coachIds),
    getRefereePolandFilterMatchesByPersonId(supabase, refereeIds),
  ])
  const [hasPlayedAgainstPolandByPersonId, hasRepresentedPolandByPersonId, hasCoachedPolandByPersonId, hasCoachedAgainstPolandByPersonId, coachPolandTenureByPersonId, coachPolandFilterMatchesByPersonId] = await Promise.all([
    getPlayedAgainstPolandByPersonId(supabase, playerIds),
    getRepresentedPolandByPersonId(supabase, playerIds),
    getCoachedPolandByPersonId(supabase, coachIds),
    getCoachedAgainstPolandByPersonId(supabase, coachIds),
    getCoachPolandTenureRangeByPersonId(supabase, coachIds),
    getCoachPolandFilterMatchesByPersonId(supabase, coachIds),
  ])

  return people
    .map((person) => {
      const representedData = representedCountryDataByPersonId.get(person.id) ?? []
      const representedIds = representedCountryIdsByPersonId.get(person.id) ?? []
      const fallbackName = person.birth_country_id ? (countryMap.get(person.birth_country_id) ?? null) : null
      const fallbackFifaCode = person.birth_country_id ? (countryFifaCodeMap.get(person.birth_country_id) ?? null) : null
      const representedNames = representedData.length ? representedData.map((d) => d.name) : (fallbackName ? [fallbackName] : [])
      const representedFifaCodes = representedData.length ? representedData.map((d) => d.fifaCode) : (fallbackFifaCode ? [fallbackFifaCode] : [])
      const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
      const stats = statsByPersonId.get(person.id)
      const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)
      const coachStats = coachResultStatsByPersonId.get(person.id)
      const refereeFilterMatches = refereePolandFilterMatchesByPersonId.get(person.id) ?? []
      const refStats = aggregateRefereePolandStats(refereeFilterMatches)
      const coachPolandTenure = coachPolandTenureByPersonId.get(person.id)
      const coachPolandFilterMatches = coachPolandFilterMatchesByPersonId.get(person.id) ?? []
      const coachPolandMatchCount = coachStats?.coach_poland_match_count ?? 0
      const coachAgainstPolandMatchCount = coachStats?.coach_against_poland_match_count ?? 0
      const coachMatchCount = coachPolandMatchCount + coachAgainstPolandMatchCount
      const coachWins = coachStats?.coach_wins ?? 0
      const coachDraws = coachStats?.coach_draws ?? 0

      return {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        nickname: person.nickname,
        birth_date: person.birth_date,
        death_date: person.death_date,
        is_active: person.is_active,
        birth_city_id: person.birth_city_id,
        birth_country_id: person.birth_country_id,
        birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
        birth_country_name: person.birth_country_id
          ? (countryMap.get(person.birth_country_id) ?? null)
          : null,
        birth_country_fifa_code: person.birth_country_id
          ? (countryFifaCodeMap.get(person.birth_country_id) ?? null)
          : null,
        represented_country_names: representedNames,
        represented_country_fifa_codes: representedFifaCodes,
        has_represented_poland: hasRepresentedPolandByPersonId.get(person.id) ?? false,
        has_played_against_poland: hasPlayedAgainstPolandByPersonId.get(person.id) ?? false,
        coached_country_names: coachedData.names,
        coached_country_fifa_codes: coachedData.fifaCodes,
        has_coached_poland: hasCoachedPolandByPersonId.get(person.id) ?? false,
        has_coached_against_poland: hasCoachedAgainstPolandByPersonId.get(person.id) ?? false,
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: stats?.appearance_count ?? 0,
        starting_appearance_count: stats?.starting_appearance_count ?? 0,
        sub_on_count: stats?.sub_on_count ?? 0,
        sub_off_count: stats?.sub_off_count ?? 0,
        goal_count: stats?.goal_count ?? 0,
        assist_count: stats?.assist_count ?? 0,
        yellow_card_count: stats?.yellow_card_count ?? 0,
        red_card_count: stats?.red_card_count ?? 0,
        minute_count: stats?.minute_count ?? 0,
        bench_count: stats?.bench_count ?? 0,
        player_match_count: roleMatchCounts?.player_match_count ?? 0,
        coach_match_count: coachMatchCount,
        coach_poland_match_count: coachPolandMatchCount,
        coach_against_poland_match_count: coachAgainstPolandMatchCount,
        coach_poland_first_match_date: coachPolandTenure?.firstMatchDate ?? null,
        coach_poland_last_match_date: coachPolandTenure?.lastMatchDate ?? null,
        coach_poland_filter_matches: coachPolandFilterMatches,
        referee_filter_matches: refereeFilterMatches,
        referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
        coach_wins: coachWins,
        coach_draws: coachDraws,
        coach_losses: coachStats?.coach_losses ?? 0,
        coach_goals_scored: coachStats?.coach_goals_scored ?? 0,
        coach_goals_conceded: coachStats?.coach_goals_conceded ?? 0,
        coach_points_per_match: getCoachPointsPerMatch({
          coachMatchCount,
          coachWins,
          coachDraws,
        }),
        coach_poland_wins: coachStats?.coach_poland_wins ?? 0,
        coach_poland_draws: coachStats?.coach_poland_draws ?? 0,
        coach_poland_losses: coachStats?.coach_poland_losses ?? 0,
        coach_poland_goals_scored: coachStats?.coach_poland_goals_scored ?? 0,
        coach_poland_goals_conceded: coachStats?.coach_poland_goals_conceded ?? 0,
        coach_poland_points_per_match: getCoachPointsPerMatch({
          coachMatchCount: coachPolandMatchCount,
          coachWins: coachStats?.coach_poland_wins ?? 0,
          coachDraws: coachStats?.coach_poland_draws ?? 0,
        }),
        coach_against_poland_wins: coachStats?.coach_against_poland_wins ?? 0,
        coach_against_poland_draws: coachStats?.coach_against_poland_draws ?? 0,
        coach_against_poland_losses: coachStats?.coach_against_poland_losses ?? 0,
        coach_against_poland_goals_scored: coachStats?.coach_against_poland_goals_scored ?? 0,
        coach_against_poland_goals_conceded: coachStats?.coach_against_poland_goals_conceded ?? 0,
        coach_against_poland_points_per_match: getCoachPointsPerMatch({
          coachMatchCount: coachAgainstPolandMatchCount,
          coachWins: coachStats?.coach_against_poland_wins ?? 0,
          coachDraws: coachStats?.coach_against_poland_draws ?? 0,
        }),
        referee_wins: refStats.referee_wins,
        referee_draws: refStats.referee_draws,
        referee_losses: refStats.referee_losses,
        referee_goals_scored: refStats.referee_goals_scored,
        referee_goals_conceded: refStats.referee_goals_conceded,
      }
    })
    .sort((a, b) => buildDisplayName(a).localeCompare(buildDisplayName(b), 'pl'))
}

export async function getPublicPeople(): Promise<AdminPersonListItem[]> {
  const cacheKey = await getPublicCacheKey('public-people')
  return unstable_cache(
    async () => getAdminPeople(),
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-people'],
    }
  )()
}

export async function getAdminPeoplePage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminPersonListItem>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: people, error: peopleError, count } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id', {
      count: 'exact',
    })
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true, nullsFirst: false })
    .order('nickname', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)
  if (!people?.length) return { items: [], total: count ?? 0 }

  const cityIds = [...new Set(people.map((p) => p.birth_city_id).filter(Boolean))]
  const countryIds = [...new Set(people.map((p) => p.birth_country_id).filter(Boolean))]

  // Batch cities to avoid oversized .in() queries that can fail at the fetch layer
  const CITY_CHUNK = 80
  const cityMap = new Map<string, string | null>()
  for (let i = 0; i < cityIds.length; i += CITY_CHUNK) {
    const { data: cityBatch, error: citiesError } = await supabase
      .from('tbl_Cities')
      .select('id, city_name')
      .in('id', cityIds.slice(i, i + CITY_CHUNK))
    if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
    for (const c of cityBatch ?? []) cityMap.set(c.id, c.city_name)
  }

  const { data: countries, error: countriesError } = countryIds.length
    ? await supabase.from('tbl_Countries').select('id, name, fifa_code').in('id', countryIds)
    : { data: [] as { id: string; name: string | null; fifa_code: string | null }[], error: null }
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryMap = new Map((countries ?? []).map((c) => [c.id, c.name]))
  const countryFifaCodeMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code]))
  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const rolesByPersonId = await getRolesByPersonId(
    supabase,
    people.map((person) => person.id)
  )
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(
    supabase,
    people.map((person) => person.id)
  )

  return {
    items: people.map((person) => {
      const representedData = representedCountryDataByPersonId.get(person.id) ?? []
      const fallbackName = person.birth_country_id ? (countryMap.get(person.birth_country_id) ?? null) : null
      const fallbackFifaCode = person.birth_country_id ? (countryFifaCodeMap.get(person.birth_country_id) ?? null) : null
      const representedNames = representedData.length ? representedData.map((d) => d.name) : (fallbackName ? [fallbackName] : [])
      const representedFifaCodes = representedData.length ? representedData.map((d) => d.fifaCode) : (fallbackFifaCode ? [fallbackFifaCode] : [])
      const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
      const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)

      return {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        nickname: person.nickname,
        birth_date: person.birth_date,
        death_date: person.death_date,
        is_active: person.is_active,
        birth_city_id: person.birth_city_id,
        birth_country_id: person.birth_country_id,
        birth_city_name: person.birth_city_id ? (cityMap.get(person.birth_city_id) ?? null) : null,
        birth_country_name: person.birth_country_id
          ? (countryMap.get(person.birth_country_id) ?? null)
          : null,
        birth_country_fifa_code: person.birth_country_id
          ? (countryFifaCodeMap.get(person.birth_country_id) ?? null)
          : null,
        represented_country_names: representedNames,
        represented_country_fifa_codes: representedFifaCodes,
        coached_country_names: coachedData.names,
        coached_country_fifa_codes: coachedData.fifaCodes,
        roles: rolesByPersonId.get(person.id) ?? [],
        role_labels: mapRolesToLabels(rolesByPersonId.get(person.id) ?? []),
        appearance_count: 0,
        starting_appearance_count: 0,
        sub_on_count: 0,
        sub_off_count: 0,
        goal_count: 0,
        assist_count: 0,
        yellow_card_count: 0,
        red_card_count: 0,
        minute_count: 0,
        bench_count: 0,
        player_match_count: roleMatchCounts?.player_match_count ?? 0,
        coach_match_count: roleMatchCounts?.coach_match_count ?? 0,
        coach_poland_match_count: 0,
        coach_against_poland_match_count: 0,
        coach_poland_first_match_date: null,
        coach_poland_last_match_date: null,
        coach_poland_filter_matches: [],
        referee_filter_matches: [],
        referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
        coach_wins: 0,
        coach_draws: 0,
        coach_losses: 0,
        coach_goals_scored: 0,
        coach_goals_conceded: 0,
        coach_points_per_match: 0,
        coach_poland_wins: 0,
        coach_poland_draws: 0,
        coach_poland_losses: 0,
        coach_poland_goals_scored: 0,
        coach_poland_goals_conceded: 0,
        coach_poland_points_per_match: 0,
        coach_against_poland_wins: 0,
        coach_against_poland_draws: 0,
        coach_against_poland_losses: 0,
        coach_against_poland_goals_scored: 0,
        coach_against_poland_goals_conceded: 0,
        coach_against_poland_points_per_match: 0,
        referee_wins: 0,
        referee_draws: 0,
        referee_losses: 0,
        referee_goals_scored: 0,
        referee_goals_conceded: 0,
      }
    }),
    total: count ?? 0,
  }
}

export async function getPublicPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  const cacheKey = await getPublicCacheKey('public-person-details', id)
  return unstable_cache(
    async () => getAdminPersonDetails(id),
    cacheKey,
    {
      revalidate: 3600,
      tags: ['public-people', `public-person:${id}`],
    }
  )()
}

export async function getAdminPersonDetails(id: string): Promise<AdminPersonDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: person, error: personError } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname, birth_date, death_date, is_active, birth_city_id, birth_country_id')
    .eq('id', id)
    .maybeSingle()

  if (personError) throw new Error(`tbl_People: ${personError.message}`)
  if (!person) return null

  const [{ data: city, error: cityError }, { data: country, error: countryError }] = await Promise.all([
    person.birth_city_id
      ? supabase
          .from('tbl_Cities')
          .select('city_name')
          .eq('id', person.birth_city_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { city_name: string | null } | null, error: null }),
    person.birth_country_id
      ? supabase
          .from('tbl_Countries')
          .select('name, fifa_code')
          .eq('id', person.birth_country_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null; fifa_code: string | null } | null, error: null }),
  ])

  if (cityError) throw new Error(`tbl_Cities: ${cityError.message}`)
  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)

  const representedCountryDataByPersonId = await getExplicitRepresentedCountryDataByPersonId(supabase, [person.id])
  const representedCountryIdsByPersonId = await getExplicitRepresentedCountryIdsByPersonId(supabase, [person.id])
  const coachedCountryDataByPersonId = await getCoachedCountryDataByPersonId(supabase, [person.id])
  const rolesByPersonId = await getRolesByPersonId(supabase, [person.id])
  const roleMatchCountsByPersonId = await getRoleMatchCountsByPersonId(supabase, [person.id])
  const explicitRepresentedData = representedCountryDataByPersonId.get(person.id) ?? []
  const explicitRepresentedIds = representedCountryIdsByPersonId.get(person.id) ?? []
  const coachedData = coachedCountryDataByPersonId.get(person.id) ?? { names: [], fifaCodes: [] }
  const fallbackRepresented = country?.name ?? null
  const fallbackFifaCode = country?.fifa_code ?? null
  const roles = rolesByPersonId.get(person.id) ?? []
  const representedNames = explicitRepresentedData.length
    ? explicitRepresentedData.map((d) => d.name)
    : (fallbackRepresented ? [fallbackRepresented] : [])
  const representedFifaCodes = explicitRepresentedData.length
    ? explicitRepresentedData.map((d) => d.fifaCode)
    : (fallbackFifaCode ? [fallbackFifaCode] : [])

  const isPlayer = roles.includes('PLAYER')
  const isCoach = roles.includes('COACH')
  const [statsMap, minuteCount, coachResultStatsByPersonId] = await Promise.all([
    isPlayer ? getPersonStats(supabase, [person.id]) : Promise.resolve(new Map()),
    isPlayer ? getPlayerMinutes(supabase, person.id) : Promise.resolve(0),
    isCoach ? getCoachResultStatsByPersonId(supabase, [person.id]) : Promise.resolve(new Map<string, CoachResultStats>()),
  ])
  const stats = statsMap.get(person.id)
  const roleMatchCounts = roleMatchCountsByPersonId.get(person.id)
  const coachStats = coachResultStatsByPersonId.get(person.id)
  const coachPolandMatchCount = coachStats?.coach_poland_match_count ?? 0
  const coachAgainstPolandMatchCount = coachStats?.coach_against_poland_match_count ?? 0
  const coachMatchCount = coachPolandMatchCount + coachAgainstPolandMatchCount
  const coachWins = coachStats?.coach_wins ?? 0
  const coachDraws = coachStats?.coach_draws ?? 0

  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    nickname: person.nickname,
    birth_date: person.birth_date,
    death_date: person.death_date,
    is_active: person.is_active,
    birth_city_id: person.birth_city_id,
    birth_country_id: person.birth_country_id,
    birth_city_name: city?.city_name ?? null,
    birth_country_name: country?.name ?? null,
    birth_country_fifa_code: country?.fifa_code ?? null,
    represented_country_ids: explicitRepresentedIds,
    represented_country_names: representedNames,
    represented_country_fifa_codes: representedFifaCodes,
    coached_country_names: coachedData.names,
    coached_country_fifa_codes: coachedData.fifaCodes,
    has_coached_poland: coachPolandMatchCount > 0,
    has_coached_against_poland: coachAgainstPolandMatchCount > 0,
    roles,
    role_labels: mapRolesToLabels(roles),
    appearance_count: stats?.appearance_count ?? 0,
    starting_appearance_count: stats?.starting_appearance_count ?? 0,
    sub_on_count: stats?.sub_on_count ?? 0,
    sub_off_count: stats?.sub_off_count ?? 0,
    goal_count: stats?.goal_count ?? 0,
    assist_count: stats?.assist_count ?? 0,
    yellow_card_count: stats?.yellow_card_count ?? 0,
    red_card_count: stats?.red_card_count ?? 0,
    minute_count: minuteCount,
    bench_count: stats?.bench_count ?? 0,
    player_match_count: roleMatchCounts?.player_match_count ?? 0,
    coach_match_count: coachMatchCount,
    coach_poland_match_count: coachPolandMatchCount,
    coach_against_poland_match_count: coachAgainstPolandMatchCount,
    coach_poland_first_match_date: null,
    coach_poland_last_match_date: null,
    coach_poland_filter_matches: [],
    referee_filter_matches: [],
    referee_match_count: roleMatchCounts?.referee_match_count ?? 0,
    coach_wins: coachWins,
    coach_draws: coachDraws,
    coach_losses: coachStats?.coach_losses ?? 0,
    coach_goals_scored: coachStats?.coach_goals_scored ?? 0,
    coach_goals_conceded: coachStats?.coach_goals_conceded ?? 0,
    coach_points_per_match: getCoachPointsPerMatch({
      coachMatchCount,
      coachWins,
      coachDraws,
    }),
    coach_poland_wins: coachStats?.coach_poland_wins ?? 0,
    coach_poland_draws: coachStats?.coach_poland_draws ?? 0,
    coach_poland_losses: coachStats?.coach_poland_losses ?? 0,
    coach_poland_goals_scored: coachStats?.coach_poland_goals_scored ?? 0,
    coach_poland_goals_conceded: coachStats?.coach_poland_goals_conceded ?? 0,
    coach_poland_points_per_match: getCoachPointsPerMatch({
      coachMatchCount: coachPolandMatchCount,
      coachWins: coachStats?.coach_poland_wins ?? 0,
      coachDraws: coachStats?.coach_poland_draws ?? 0,
    }),
    coach_against_poland_wins: coachStats?.coach_against_poland_wins ?? 0,
    coach_against_poland_draws: coachStats?.coach_against_poland_draws ?? 0,
    coach_against_poland_losses: coachStats?.coach_against_poland_losses ?? 0,
    coach_against_poland_goals_scored: coachStats?.coach_against_poland_goals_scored ?? 0,
    coach_against_poland_goals_conceded: coachStats?.coach_against_poland_goals_conceded ?? 0,
    coach_against_poland_points_per_match: getCoachPointsPerMatch({
      coachMatchCount: coachAgainstPolandMatchCount,
      coachWins: coachStats?.coach_against_poland_wins ?? 0,
      coachDraws: coachStats?.coach_against_poland_draws ?? 0,
    }),
    referee_wins: 0,
    referee_draws: 0,
    referee_losses: 0,
    referee_goals_scored: 0,
    referee_goals_conceded: 0,
  }
}

