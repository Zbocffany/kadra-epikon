import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

export type MatchStatus =
  | 'SCHEDULED'
  | 'FINISHED'
  | 'ABANDONED'
  | 'CANCELLED'

export type ResultType =
  | 'REGULAR_TIME'
  | 'EXTRA_TIME'
  | 'PENALTIES'
  | 'EXTRA_TIME_AND_PENALTIES'
  | 'GOLDEN_GOAL'
  | 'WALKOVER'

export type EditorialStatus =
  | 'DRAFT'
  | 'PARTIAL'
  | 'COMPLETE'
  | 'VERIFIED'

export type MatchParticipantRole = 'PLAYER' | 'COACH' | 'REFEREE'

export type PlayerPosition =
  | 'GOALKEEPER'
  | 'DEFENDER'
  | 'MIDFIELDER'
  | 'ATTACKER'

export type AdminMatch = {
  id: string
  match_date: string
  match_time: string | null
  match_status: MatchStatus
  result_type: ResultType | null
  editorial_status: EditorialStatus
  competition_name: string
  home_team_name: string
  away_team_name: string
}

export type AdminMatchDetails = AdminMatch & {
  competition_id: string
  home_team_id: string
  away_team_id: string
  match_city_id: string | null
  match_stadium_id: string | null
}

export type AdminCompetitionOption = {
  id: string
  name: string
}

export type AdminTeamOption = {
  id: string
  label: string
}

export type AdminCityOption = {
  id: string
  name: string
}

export type AdminStadiumOption = {
  id: string
  label: string
  stadium_city_id: string | null
}

export type AdminMatchParticipant = {
  id: string
  team_id: string | null
  person_id: string
  person_name: string
  role: MatchParticipantRole
  is_starting: boolean | null
  player_position: PlayerPosition | null
  club_team_id: string | null
  club_team_name: string | null
  derived_club_team_name: string | null
  country_code?: string | null
}

export type AdminMatchParticipantPersonOption = {
  id: string
  label: string
  firstName: string
  lastName: string
  nickname: string
}

type MatchParticipantRow = {
  id: string
  team_id: string | null
  person_id: string
  role: MatchParticipantRole
  is_starting: boolean | null
  player_position: PlayerPosition | null
  club_team_id: string | null
}

type PlayerClubSuggestionRow = {
  person_id: string
  club_team_id: string | null
  match_id: string
}

type MatchDateRow = {
  id: string
  match_date: string
}

type MatchParticipantPersonRow = {
  id: string
  first_name: string | null
  last_name: string | null
  nickname: string | null
}

type PersonTeamPeriodRow = {
  person_id: string
  club_team_id: string
  valid_from: string
  valid_to: string | null
}

type MatchListRow = {
  id: string
  match_date: string
  match_time: string | null
  match_status: MatchStatus
  result_type: ResultType | null
  editorial_status: EditorialStatus
  competition_id: string
  home_team_id: string
  away_team_id: string
}

function buildPersonDisplayName(person: MatchParticipantPersonRow): string {
  const first = person.first_name?.trim() ?? ''
  const last = person.last_name?.trim() ?? ''
  const nickname = person.nickname?.trim() ?? ''
  const fullName = `${first} ${last}`.trim()

  if (fullName) return fullName
  if (nickname) return nickname
  return '—'
}

function getDerivedClubTeamId(
  periods: PersonTeamPeriodRow[],
  matchDate: string
): string | null {
  const matching = periods
    .filter((period) => period.valid_from <= matchDate && (!period.valid_to || period.valid_to >= matchDate))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))

  return matching[0]?.club_team_id ?? null
}

function sortTeamParticipants(participants: AdminMatchParticipant[]): AdminMatchParticipant[] {
  const roleRank: Record<MatchParticipantRole, number> = {
    PLAYER: 0,
    COACH: 1,
    REFEREE: 2,
  }

  return [...participants].sort((a, b) => {
    if (a.role !== b.role) {
      return roleRank[a.role] - roleRank[b.role]
    }

    if (a.role === 'PLAYER' && b.role === 'PLAYER') {
      const aStartingRank = a.is_starting ? 0 : 1
      const bStartingRank = b.is_starting ? 0 : 1
      if (aStartingRank !== bStartingRank) {
        return aStartingRank - bStartingRank
      }
    }

    return a.person_name.localeCompare(b.person_name, 'pl')
  })
}

async function getTeamDisplayMap(teamIds: string[]): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient()

  if (!teamIds.length) {
    return new Map()
  }

  const { data: teams, error: teamError } = await supabase
    .from('tbl_Teams')
    .select('id, country_id, club_id')
    .in('id', teamIds)

  if (teamError) throw new Error(`tbl_Teams: ${teamError.message}`)

  const countryIds = [...new Set((teams ?? []).map((t) => t.country_id).filter(Boolean))]
  const clubIds = [...new Set((teams ?? []).map((t) => t.club_id).filter(Boolean))]

  const [
    { data: countries, error: countryError },
    { data: clubs, error: clubError },
  ] = await Promise.all([
    countryIds.length
      ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    clubIds.length
      ? supabase.from('tbl_Clubs').select('id, name').in('id', clubIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ])

  if (countryError) throw new Error(`tbl_Countries: ${countryError.message}`)
  if (clubError) throw new Error(`tbl_Clubs: ${clubError.message}`)

  const countryMap = new Map(countries?.map((c) => [c.id, c.name]) ?? [])
  const clubMap = new Map(clubs?.map((c) => [c.id, c.name]) ?? [])

  return new Map(
    (teams ?? []).map((t) => [
      t.id,
      t.country_id
        ? (countryMap.get(t.country_id) ?? '—')
        : (clubMap.get(t.club_id) ?? '—'),
    ])
  )
}

/**
 * Returns all matches for the admin list, sorted by match_date descending.
 *
 * Data is assembled from three separate fetches to avoid PostgREST
 * FK-ambiguity issues (two FK columns from tbl_Matches → tbl_Teams).
 * Score is intentionally omitted: derive it from tbl_Match_Events if needed.
 */
export async function getAdminMatches(): Promise<AdminMatch[]> {
  const supabase = createServiceRoleClient()

  // 1. Matches
  const { data: matches, error: matchError } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, result_type, editorial_status, competition_id, home_team_id, away_team_id'
    )
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!matches?.length) return []

  return mapAdminMatches(supabase, matches)
}

export async function getAdminMatchesPage(
  page: number,
  pageSize: number
): Promise<PaginatedDbResult<AdminMatch>> {
  const supabase = createServiceRoleClient()
  const { from, to } = getPageRange(page, pageSize)

  const { data: matches, error: matchError, count } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, result_type, editorial_status, competition_id, home_team_id, away_team_id',
      { count: 'exact' }
    )
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!matches?.length) {
    return { items: [], total: count ?? 0 }
  }

  const items = await mapAdminMatches(supabase, matches)
  return { items, total: count ?? 0 }
}

async function mapAdminMatches(
  supabase: ReturnType<typeof createServiceRoleClient>,
  matches: MatchListRow[]
): Promise<AdminMatch[]> {

  // 2. Competitions + teams (parallel)
  const competitionIds = [...new Set(matches.map((m) => m.competition_id))]
  const teamIds = [
    ...new Set([
      ...matches.map((m) => m.home_team_id),
      ...matches.map((m) => m.away_team_id),
    ]),
  ]

  const { data: competitions, error: compError } = await supabase
    .from('tbl_Competitions')
    .select('id, name')
    .in('id', competitionIds)

  if (compError) throw new Error(`tbl_Competitions: ${compError.message}`)

  const teamNameMap = await getTeamDisplayMap(teamIds)

  // 3. Lookup maps
  const compMap = new Map(competitions?.map((c) => [c.id, c.name]) ?? [])

  // 4. Assemble
  return matches.map((m) => ({
    id: m.id,
    match_date: m.match_date,
    match_time: m.match_time ?? null,
    match_status: m.match_status,
    result_type: m.result_type,
    editorial_status: m.editorial_status,
    competition_name: compMap.get(m.competition_id) ?? '—',
    home_team_name: teamNameMap.get(m.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(m.away_team_id) ?? '—',
  }))
}

export async function getAdminMatchDetails(id: string): Promise<AdminMatchDetails | null> {
  const supabase = createServiceRoleClient()

  const { data: match, error: matchError } = await supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, result_type, editorial_status, competition_id, home_team_id, away_team_id, match_city_id, match_stadium_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!match) return null

  const [{ data: competition, error: competitionError }, teamNameMap] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .eq('id', match.competition_id)
      .maybeSingle(),
    getTeamDisplayMap([match.home_team_id, match.away_team_id]),
  ])

  if (competitionError) throw new Error(`tbl_Competitions: ${competitionError.message}`)

  return {
    id: match.id,
    match_date: match.match_date,
    match_time: match.match_time ?? null,
    match_status: match.match_status,
    result_type: match.result_type,
    editorial_status: match.editorial_status,
    competition_name: competition?.name ?? '—',
    home_team_name: teamNameMap.get(match.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(match.away_team_id) ?? '—',
    competition_id: match.competition_id,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    match_city_id: match.match_city_id ?? null,
    match_stadium_id: match.match_stadium_id ?? null,
  }
}

export async function getAdminMatchParticipants(match: Pick<AdminMatchDetails, 'id' | 'match_date' | 'home_team_id' | 'away_team_id'>): Promise<{
  homeParticipants: AdminMatchParticipant[]
  awayParticipants: AdminMatchParticipant[]
  referees: AdminMatchParticipant[]
  people: AdminMatchParticipantPersonOption[]
}> {
  const supabase = createServiceRoleClient()

  const [
    { data: participants, error: participantsError },
    { data: people, error: peopleError },
  ] = await Promise.all([
    supabase
      .from('tbl_Match_Participants')
      .select('id, team_id, person_id, role, is_starting, player_position, club_team_id')
      .eq('match_id', match.id),
    supabase
      .from('tbl_People')
      .select('id, first_name, last_name, nickname')
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true, nullsFirst: false })
      .order('nickname', { ascending: true, nullsFirst: false }),
  ])

  if (participantsError) throw new Error(`tbl_Match_Participants: ${participantsError.message}`)
  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)

  const participantRows = (participants ?? []) as MatchParticipantRow[]
  const peopleRows = (people ?? []) as MatchParticipantPersonRow[]
  const personIds = [...new Set(participantRows.map((participant) => participant.person_id))]
  const refereePersonIds = [...new Set(
    participantRows
      .filter((participant) => participant.role === 'REFEREE')
      .map((participant) => participant.person_id)
  )]

  const { data: periods, error: periodsError } = personIds.length
    ? await supabase
        .from('tbl_Person_Team_Periods')
        .select('person_id, club_team_id, valid_from, valid_to')
        .in('person_id', personIds)
    : { data: [] as PersonTeamPeriodRow[], error: null }

  const { data: personCountries, error: personCountriesError } = refereePersonIds.length
    ? await supabase
        .from('tbl_Person_Countries')
        .select('person_id, country_id(fifa_code)')
        .in('person_id', refereePersonIds)
    : { data: [], error: null }

  if (periodsError) throw new Error(`tbl_Person_Team_Periods: ${periodsError.message}`)
  if (personCountriesError) throw new Error(`tbl_Person_Countries: ${personCountriesError.message}`)

  const periodsByPerson = new Map<string, PersonTeamPeriodRow[]>()
  for (const period of (periods ?? []) as PersonTeamPeriodRow[]) {
    const existing = periodsByPerson.get(period.person_id) ?? []
    existing.push(period)
    periodsByPerson.set(period.person_id, existing)
  }

  const personCountryMap = new Map<string, string | null>()
  for (const row of (personCountries ?? []) as Array<{ person_id: string; country_id: { fifa_code: string } | null }>) {
    if (row.country_id?.fifa_code) {
      personCountryMap.set(row.person_id, row.country_id.fifa_code)
    }
  }

  const personNameMap = new Map(peopleRows.map((person) => [person.id, buildPersonDisplayName(person)]))
  const derivedClubTeamIds = participantRows
    .filter((participant) => !participant.club_team_id && participant.role !== 'REFEREE')
    .map((participant) => getDerivedClubTeamId(periodsByPerson.get(participant.person_id) ?? [], match.match_date))
    .filter((teamId): teamId is string => Boolean(teamId))
  const allClubTeamIds = [...new Set([
    ...participantRows
      .map((participant) => participant.club_team_id)
      .filter((teamId): teamId is string => Boolean(teamId)),
    ...derivedClubTeamIds,
  ])]
  const clubTeamNameMap = await getTeamDisplayMap(allClubTeamIds)

  const mappedParticipants = participantRows.map((participant) => {
    const derivedClubTeamId = !participant.club_team_id && participant.role !== 'REFEREE'
      ? getDerivedClubTeamId(periodsByPerson.get(participant.person_id) ?? [], match.match_date)
      : null

    return {
      id: participant.id,
      team_id: participant.team_id,
      person_id: participant.person_id,
      person_name: personNameMap.get(participant.person_id) ?? '—',
      role: participant.role,
      is_starting: participant.is_starting,
      player_position: participant.player_position,
      club_team_id: participant.club_team_id,
      club_team_name: participant.club_team_id
        ? (clubTeamNameMap.get(participant.club_team_id) ?? '—')
        : null,
      derived_club_team_name: derivedClubTeamId
        ? (clubTeamNameMap.get(derivedClubTeamId) ?? '—')
        : null,
      country_code: participant.role === 'REFEREE'
        ? personCountryMap.get(participant.person_id) ?? undefined
        : undefined,
    } satisfies AdminMatchParticipant
  })

  return {
    homeParticipants: sortTeamParticipants(
      mappedParticipants.filter((participant) => participant.team_id === match.home_team_id)
    ),
    awayParticipants: sortTeamParticipants(
      mappedParticipants.filter((participant) => participant.team_id === match.away_team_id)
    ),
    referees: [...mappedParticipants]
      .filter((participant) => participant.role === 'REFEREE')
      .sort((a, b) => a.person_name.localeCompare(b.person_name, 'pl')),
    people: peopleRows
      .map((person) => ({ 
        id: person.id, 
        label: buildPersonDisplayName(person),
        firstName: person.first_name ?? '',
        lastName: person.last_name ?? '',
        nickname: person.nickname ?? '',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pl')),
  }
}

export async function getAdminMatchCreateOptions(): Promise<{
  competitions: AdminCompetitionOption[]
  teams: AdminTeamOption[]
  cities: AdminCityOption[]
  stadiums: AdminStadiumOption[]
}> {
  const supabase = createServiceRoleClient()

  const [
    { data: competitions, error: competitionsError },
    { data: teams, error: teamsError },
    { data: cities, error: citiesError },
    { data: stadiums, error: stadiumsError },
  ] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .order('name', { ascending: true }),
    supabase.from('tbl_Teams').select('id').order('id', { ascending: true }),
    supabase.from('tbl_Cities').select('id, city_name').order('city_name', { ascending: true }),
    supabase.from('tbl_Stadiums').select('id, name, stadium_city_id').order('name', { ascending: true }),
  ])

  if (competitionsError) throw new Error(`tbl_Competitions: ${competitionsError.message}`)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (stadiumsError) throw new Error(`tbl_Stadiums: ${stadiumsError.message}`)

  const cityNameMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))

  const teamIds = (teams ?? []).map((t) => t.id)
  const teamDisplayMap = await getTeamDisplayMap(teamIds)

  const teamOptions = teamIds
    .map((id) => ({ id, label: teamDisplayMap.get(id) ?? '—' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const cityOptions = (cities ?? []).map((city) => ({
    id: city.id,
    name: city.city_name ?? '—',
  }))

  const stadiumOptions = (stadiums ?? []).map((stadium) => {
    const cityName = stadium.stadium_city_id
      ? cityNameMap.get(stadium.stadium_city_id)
      : null

    const label = cityName
      ? `${stadium.name ?? '—'} (${cityName})`
      : (stadium.name ?? '—')

    return {
      id: stadium.id,
      label,
      stadium_city_id: stadium.stadium_city_id ?? null,
    }
  })

  return {
    competitions: competitions ?? [],
    teams: teamOptions,
    cities: cityOptions,
    stadiums: stadiumOptions,
  }
}

export async function getAdminClubTeamOptions(): Promise<AdminTeamOption[]> {
  const supabase = createServiceRoleClient()

  const { data: clubTeams, error } = await supabase
    .from('tbl_Teams')
    .select('id, club_id')
    .not('club_id', 'is', null)

  if (error) throw new Error(`tbl_Teams: ${error.message}`)

  const teamIds = (clubTeams ?? []).map((team) => team.id)
  const teamDisplayMap = await getTeamDisplayMap(teamIds)

  return teamIds
    .map((id) => ({ id, label: teamDisplayMap.get(id) ?? '—' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))
}

export async function getLatestPlayerClubTeamByPersonIds(
  personIds: string[],
  options?: { excludeMatchId?: string }
): Promise<Record<string, string | null>> {
  const supabase = createServiceRoleClient()

  if (!personIds.length) {
    return {}
  }

  let participantsQuery = supabase
    .from('tbl_Match_Participants')
    .select('person_id, club_team_id, match_id')
    .eq('role', 'PLAYER')
    .in('person_id', personIds)

  if (options?.excludeMatchId) {
    participantsQuery = participantsQuery.neq('match_id', options.excludeMatchId)
  }

  const { data: participantRows, error: participantsError } = await participantsQuery

  if (participantsError) {
    throw new Error(`tbl_Match_Participants: ${participantsError.message}`)
  }

  const rows = (participantRows ?? []) as PlayerClubSuggestionRow[]
  if (!rows.length) {
    return {}
  }

  const matchIds = [...new Set(rows.map((row) => row.match_id))]
  const { data: matches, error: matchesError } = await supabase
    .from('tbl_Matches')
    .select('id, match_date')
    .in('id', matchIds)

  if (matchesError) {
    throw new Error(`tbl_Matches: ${matchesError.message}`)
  }

  const matchDateMap = new Map((matches ?? []).map((match: MatchDateRow) => [match.id, match.match_date]))

  const bestByPerson = new Map<string, { clubTeamId: string | null; matchDate: string; matchId: string }>()
  for (const row of rows) {
    const matchDate = matchDateMap.get(row.match_id)
    if (!matchDate) continue

    const current = bestByPerson.get(row.person_id)
    if (!current) {
      bestByPerson.set(row.person_id, {
        clubTeamId: row.club_team_id,
        matchDate,
        matchId: row.match_id,
      })
      continue
    }

    const isNewer = matchDate > current.matchDate
      || (matchDate === current.matchDate && row.match_id > current.matchId)

    if (isNewer) {
      bestByPerson.set(row.person_id, {
        clubTeamId: row.club_team_id,
        matchDate,
        matchId: row.match_id,
      })
    }
  }

  return Object.fromEntries(
    [...bestByPerson.entries()].map(([personId, value]) => [personId, value.clubTeamId])
  )
}
