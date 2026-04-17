import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getPageRange, type PaginatedDbResult } from '@/lib/db/pagination'

type QueryError = { message: string } | null
type QueryResult<T> = { data: T[] | null; error: QueryError }

function isTransientGatewayError(error: QueryError): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('<!doctype html>') ||
    msg.includes('fetch failed') ||
    msg.includes('network error') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runSelectWithRetry<T>(
  run: () => Promise<QueryResult<T>>,
  maxAttempts = 3
): Promise<QueryResult<T>> {
  let attempt = 1
  let lastResult = await run()

  while (attempt < maxAttempts && isTransientGatewayError(lastResult.error)) {
    await delay(150 * attempt)
    attempt += 1
    lastResult = await run()
  }

  return lastResult
}

function isMissingSchemaObjectMessage(message: string, objectHint: string): boolean {
  const normalized = message.toLowerCase()
  const hint = objectHint.toLowerCase()

  return (
    normalized.includes(hint)
    && (
      normalized.includes('schema cache')
      || normalized.includes('does not exist')
      || normalized.includes('could not find')
      || normalized.includes('not found')
    )
  )
}

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

export type MatchEventType =
  | 'GOAL'
  | 'OWN_GOAL'
  | 'PENALTY_GOAL'
  | 'YELLOW_CARD'
  | 'SECOND_YELLOW_CARD'
  | 'RED_CARD'
  | 'PENALTY_SHOOTOUT_SCORED'
  | 'PENALTY_SHOOTOUT_MISSED'
  | 'PENALTY_SHOOTOUT_SAVED'
  | 'MATCH_PENALTY_SAVED'
  | 'MATCH_PENALTY_MISSED'
  | 'SUBSTITUTION'

export type AdminMatch = {
  id: string
  match_date: string
  match_time: string | null
  match_status: MatchStatus
  result_type: ResultType | null
  editorial_status: EditorialStatus
  competition_name: string
  match_level_name: string | null
  home_team_name: string
  away_team_name: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  final_score: string | null
  shootout_score: string | null
}

export type AdminMatchDetails = AdminMatch & {
  competition_id: string
  match_level_id: string | null
  home_team_id: string
  away_team_id: string
  home_team_fifa_code: string | null
  away_team_fifa_code: string | null
  match_city_id: string | null
  match_stadium_id: string | null
}

export type AdminCompetitionOption = {
  id: string
  name: string
}

export type AdminMatchLevelOption = {
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

export type AdminMatchEvent = {
  id: string
  team_id: string | null
  event_type: MatchEventType
  minute: number
  minute_extra: number | null
  primary_person_id: string | null
  secondary_person_id: string | null
  notes: string | null
  event_order: number | null
}

export type AdminMatchFilterOptions = {
  fromDate?: string
  toDate?: string
  status?: MatchStatus
}

export type AdminMatchYearBounds = {
  minYear: number
  maxYear: number
}

export type YearCoachEntry = { personId: string; name: string; matchCount: number }
export type YearAppearanceEntry = { personId: string; name: string; matchCount: number }
export type YearGoalEntry = { personId: string; name: string; goalCount: number }
export type MatchYearStatsData = {
  coaches: Record<string, YearCoachEntry[]>
  topAppearances: Record<string, YearAppearanceEntry[]>
  topScorers: Record<string, YearGoalEntry[]>
}

export type AdminPlayerMatchEventIconName =
  | 'goal'
  | 'ownGoal'
  | 'penaltyGoal'
  | 'missedPenalty'
  | 'savedPenalty'
  | 'yellowCard'
  | 'secondYellowCard'
  | 'redCard'
  | 'substitution'
  | 'assist'

export type AdminPlayerMatchEventIcon = {
  icon_name: AdminPlayerMatchEventIconName
  minute: string | null
  minute_left: boolean
}

export type AdminPlayerYearStats = {
  appearance_count: number
  starting_appearance_count: number
  sub_on_count: number
  sub_off_count: number
  bench_count: number
  goal_count: number
  assist_count: number
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
  player_position: PlayerPosition | null
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

type PersonCountryAssignmentRow = {
  person_id: string
  country_id: string
}

type PersonBirthCountryRow = {
  id: string
  birth_country_id: string | null
}

type CountryCodeRow = {
  id: string
  fifa_code: string | null
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

type MatchEventRow = {
  id: string
  match_id?: string
  team_id: string | null
  event_type: MatchEventType
  minute: number
  minute_extra: number | null
  primary_person_id: string | null
  secondary_person_id: string | null
  notes: string | null
  event_order: number | null
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
  type TeamRow = { id: string; country_id: string | null; club_id: string | null }
  type NamedRow = { id: string; name: string }

  if (!teamIds.length) {
    return new Map()
  }

  const { data: teams, error: teamError } = await runSelectWithRetry<TeamRow>(async () =>
    await supabase
      .from('tbl_Teams')
      .select('id, country_id, club_id')
      .in('id', teamIds)
  )

  if (teamError) throw new Error(`tbl_Teams: ${teamError.message}`)

  const countryIds = [...new Set((teams ?? []).map((t) => t.country_id).filter(Boolean))]
  const clubIds = [...new Set((teams ?? []).map((t) => t.club_id).filter(Boolean))]

  const [
    { data: countries, error: countryError },
    { data: clubs, error: clubError },
  ] = await Promise.all([
    countryIds.length
      ? runSelectWithRetry<NamedRow>(async () =>
          await supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
        )
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
    clubIds.length
      ? runSelectWithRetry<NamedRow>(async () =>
          await supabase.from('tbl_Clubs').select('id, name').in('id', clubIds)
        )
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ])

  // For transient upstream outages, degrade labels instead of crashing the whole page.
  if (countryError && !isTransientGatewayError(countryError)) {
    throw new Error(`tbl_Countries: ${countryError.message}`)
  }
  if (clubError && !isTransientGatewayError(clubError)) {
    throw new Error(`tbl_Clubs: ${clubError.message}`)
  }

  const countryMap = new Map(countries?.map((c) => [c.id, c.name]) ?? [])
  const clubMap = new Map(clubs?.map((c) => [c.id, c.name]) ?? [])

  return new Map(
    (teams ?? []).map((t) => [
      t.id,
      t.country_id
        ? (countryMap.get(t.country_id) ?? '—')
        : (t.club_id ? (clubMap.get(t.club_id) ?? '—') : '—'),
    ])
  )
}

async function getTeamCountryFifaCodeMap(teamIds: string[]): Promise<Map<string, string | null>> {
  const supabase = createServiceRoleClient()
  type TeamCountryRow = { id: string; country_id: string | null }
  type CountryRow = { id: string; fifa_code: string | null }

  if (!teamIds.length) {
    return new Map()
  }

  const { data: teams, error: teamError } = await runSelectWithRetry<TeamCountryRow>(async () =>
    await supabase
      .from('tbl_Teams')
      .select('id, country_id')
      .in('id', teamIds)
  )

  if (teamError) throw new Error(`tbl_Teams: ${teamError.message}`)

  const countryIds = [...new Set((teams ?? []).map((t) => t.country_id).filter(Boolean))]
  const { data: countries, error: countryError } = countryIds.length
    ? await runSelectWithRetry<CountryRow>(async () =>
        await supabase
          .from('tbl_Countries')
          .select('id, fifa_code')
          .in('id', countryIds)
      )
    : { data: [] as CountryRow[], error: null }

  if (countryError && !isTransientGatewayError(countryError)) {
    throw new Error(`tbl_Countries: ${countryError.message}`)
  }

  const countryFifaMap = new Map((countries ?? []).map((c) => [c.id, c.fifa_code ?? null]))

  return new Map(
    (teams ?? []).map((t) => [
      t.id,
      t.country_id ? (countryFifaMap.get(t.country_id) ?? null) : null,
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
export async function getAdminMatches(options?: AdminMatchFilterOptions): Promise<AdminMatch[]> {
  const supabase = createServiceRoleClient()

  // 1. Matches
  let matchesQuery = supabase
    .from('tbl_Matches')
    .select(
      'id, match_date, match_time, match_status, result_type, editorial_status, competition_id, home_team_id, away_team_id'
    )

  if (options?.status) {
    matchesQuery = matchesQuery.eq('match_status', options.status)
  }
  if (options?.fromDate) {
    matchesQuery = matchesQuery.gte('match_date', options.fromDate)
  }
  if (options?.toDate) {
    matchesQuery = matchesQuery.lte('match_date', options.toDate)
  }

  const { data: matches, error: matchError } = await matchesQuery
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })

  if (matchError) throw new Error(`tbl_Matches: ${matchError.message}`)
  if (!matches?.length) return []

  return mapAdminMatches(supabase, matches)
}

export async function getPublicMatches(): Promise<AdminMatch[]> {
  return unstable_cache(
    async () => getAdminMatches(),
    ['public-matches'],
    {
      revalidate: 3600,
      tags: ['public-matches'],
    }
  )()
}

export async function getAdminMatchesForPlayer(personId: string): Promise<AdminMatch[]> {
  const supabase = createServiceRoleClient()

  const { data: participations, error: participationsError } = await supabase
    .from('tbl_Match_Participants')
    .select('match_id, is_starting')
    .eq('role', 'PLAYER')
    .eq('person_id', personId)

  if (participationsError) {
    throw new Error(`tbl_Match_Participants: ${participationsError.message}`)
  }
  if (!participations?.length) {
    return []
  }

  const allMatchIds = [...new Set(participations.map((p) => p.match_id as string))]

  const { data: subOnEvents, error: subOnEventsError } = await supabase
    .from('tbl_Match_Events')
    .select('match_id')
    .eq('event_type', 'SUBSTITUTION')
    .eq('secondary_person_id', personId)
    .in('match_id', allMatchIds)

  if (subOnEventsError) {
    throw new Error(`tbl_Match_Events (substitutions): ${subOnEventsError.message}`)
  }

  const subOnMatchIds = new Set((subOnEvents ?? []).map((e) => e.match_id as string))
  const playedMatchIds = [
    ...new Set(
      participations
        .filter((p) => p.is_starting === true || subOnMatchIds.has(p.match_id as string))
        .map((p) => p.match_id as string)
    ),
  ]

  if (!playedMatchIds.length) {
    return []
  }

  const { data: matches, error: matchesError } = await supabase
    .from('tbl_Matches')
    .select('id, match_date, match_time, match_status, result_type, editorial_status, competition_id, home_team_id, away_team_id')
    .in('id', playedMatchIds)
    .order('match_date', { ascending: false })
    .order('match_time', { ascending: false })
    .order('id', { ascending: false })

  if (matchesError) {
    throw new Error(`tbl_Matches: ${matchesError.message}`)
  }
  if (!matches?.length) {
    return []
  }

  return mapAdminMatches(supabase, matches as MatchListRow[])
}

export async function getAdminPlayerGoalsByYear(personId: string): Promise<Record<string, number>> {
  const supabase = createServiceRoleClient()

  const { data: goalEvents, error: goalEventsError } = await supabase
    .from('tbl_Match_Events')
    .select('match_id')
    .in('event_type', ['GOAL', 'PENALTY_GOAL'])
    .eq('primary_person_id', personId)

  if (goalEventsError) {
    throw new Error(`tbl_Match_Events (player goals): ${goalEventsError.message}`)
  }
  if (!goalEvents?.length) {
    return {}
  }

  const goalsPerMatchId = new Map<string, number>()
  for (const event of goalEvents) {
    const matchId = event.match_id as string
    goalsPerMatchId.set(matchId, (goalsPerMatchId.get(matchId) ?? 0) + 1)
  }

  const matchIds = [...goalsPerMatchId.keys()]
  const CHUNK_SIZE = 80
  const yearGoals: Record<string, number> = {}

  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const batch = matchIds.slice(i, i + CHUNK_SIZE)
    const { data: matches, error: matchesError } = await supabase
      .from('tbl_Matches')
      .select('id, match_date')
      .in('id', batch)

    if (matchesError) {
      throw new Error(`tbl_Matches (player goals by year): ${matchesError.message}`)
    }

    for (const match of matches ?? []) {
      const matchId = match.id as string
      const year = (match.match_date as string).slice(0, 4)
      const goalsInMatch = goalsPerMatchId.get(matchId) ?? 0
      yearGoals[year] = (yearGoals[year] ?? 0) + goalsInMatch
    }
  }

  return yearGoals
}

function compareEventsChronologicallyForPlayer(a: MatchEventRow, b: MatchEventRow) {
  if (a.minute !== b.minute) return a.minute - b.minute
  const aExtra = a.minute_extra ?? 0
  const bExtra = b.minute_extra ?? 0
  if (aExtra !== bExtra) return aExtra - bExtra
  return (a.event_order ?? Number.MAX_SAFE_INTEGER) - (b.event_order ?? Number.MAX_SAFE_INTEGER)
}

function getPlayerEventIconName(eventType: MatchEventType): AdminPlayerMatchEventIconName | null {
  if (eventType === 'GOAL') return 'goal'
  if (eventType === 'OWN_GOAL') return 'ownGoal'
  if (eventType === 'PENALTY_GOAL' || eventType === 'PENALTY_SHOOTOUT_SCORED') return 'penaltyGoal'
  if (eventType === 'PENALTY_SHOOTOUT_MISSED' || eventType === 'MATCH_PENALTY_MISSED') return 'missedPenalty'
  if (eventType === 'PENALTY_SHOOTOUT_SAVED' || eventType === 'MATCH_PENALTY_SAVED') return 'savedPenalty'
  if (eventType === 'YELLOW_CARD') return 'yellowCard'
  if (eventType === 'SECOND_YELLOW_CARD') return 'secondYellowCard'
  if (eventType === 'RED_CARD') return 'redCard'
  if (eventType === 'SUBSTITUTION') return 'substitution'
  return null
}

function formatEventMinuteForPlayerEvent(event: Pick<MatchEventRow, 'minute' | 'minute_extra'>): string {
  return event.minute_extra && event.minute_extra > 0
    ? `${event.minute}+${event.minute_extra}'`
    : `${event.minute}'`
}

export async function getAdminPlayerMatchEventsByMatch(
  personId: string,
  matchIds: string[]
): Promise<Record<string, AdminPlayerMatchEventIcon[]>> {
  const supabase = createServiceRoleClient()

  if (!matchIds.length) {
    return {}
  }

  const uniqueMatchIds = [...new Set(matchIds)]
  const CHUNK_SIZE = 80

  const allPrimaryEvents: MatchEventRow[] = []
  const allSecondaryEvents: MatchEventRow[] = []

  for (let i = 0; i < uniqueMatchIds.length; i += CHUNK_SIZE) {
    const batch = uniqueMatchIds.slice(i, i + CHUNK_SIZE)

    const [primaryRes, secondaryRes] = await Promise.all([
      supabase
        .from('tbl_Match_Events')
        .select('id, match_id, event_type, minute, minute_extra, event_order, primary_person_id, secondary_person_id, team_id, notes')
        .eq('primary_person_id', personId)
        .in('match_id', batch),
      supabase
        .from('tbl_Match_Events')
        .select('id, match_id, event_type, minute, minute_extra, event_order, primary_person_id, secondary_person_id, team_id, notes')
        .eq('secondary_person_id', personId)
        .in('match_id', batch),
    ])

    if (primaryRes.error) {
      throw new Error(`tbl_Match_Events (primary person events): ${primaryRes.error.message}`)
    }
    if (secondaryRes.error) {
      throw new Error(`tbl_Match_Events (secondary person events): ${secondaryRes.error.message}`)
    }

    allPrimaryEvents.push(...((primaryRes.data ?? []) as MatchEventRow[]))
    allSecondaryEvents.push(...((secondaryRes.data ?? []) as MatchEventRow[]))
  }

  const result: Record<string, AdminPlayerMatchEventIcon[]> = {}
  const append = (matchId: string, icon: AdminPlayerMatchEventIcon) => {
    if (!result[matchId]) result[matchId] = []
    result[matchId].push(icon)
  }

  for (const event of allPrimaryEvents.sort(compareEventsChronologicallyForPlayer)) {
    if (!event.match_id) continue
    const iconName = getPlayerEventIconName(event.event_type)
    if (!iconName) continue
    append(event.match_id, {
      icon_name: iconName,
      minute: event.event_type === 'SUBSTITUTION' ? formatEventMinuteForPlayerEvent(event) : null,
      minute_left: false,
    })
  }

  for (const event of allSecondaryEvents.sort(compareEventsChronologicallyForPlayer)) {
    if (!event.match_id) continue

    if (event.event_type === 'GOAL' || event.event_type === 'OWN_GOAL') {
      append(event.match_id, {
        icon_name: 'assist',
        minute: null,
        minute_left: false,
      })
      continue
    }

    const iconName = getPlayerEventIconName(event.event_type)
    if (!iconName) continue

    append(event.match_id, {
      icon_name: iconName,
      minute: event.event_type === 'SUBSTITUTION' ? formatEventMinuteForPlayerEvent(event) : null,
      minute_left: true,
    })
  }

  return result
}

export async function getAdminPlayerYearStats(personId: string): Promise<Record<string, AdminPlayerYearStats>> {
  const supabase = createServiceRoleClient()

  const { data: participations, error: participationsError } = await supabase
    .from('tbl_Match_Participants')
    .select('match_id, is_starting')
    .eq('role', 'PLAYER')
    .eq('person_id', personId)

  if (participationsError) throw new Error(`tbl_Match_Participants (year stats): ${participationsError.message}`)
  if (!participations?.length) return {}

  const matchIds = [...new Set(participations.map((p) => p.match_id as string))]
  const CHUNK_SIZE = 80

  const matchYearById = new Map<string, string>()
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const batch = matchIds.slice(i, i + CHUNK_SIZE)
    const { data: matches, error: matchesError } = await supabase
      .from('tbl_Matches')
      .select('id, match_date')
      .in('id', batch)
    if (matchesError) throw new Error(`tbl_Matches (year stats): ${matchesError.message}`)
    for (const match of matches ?? []) {
      matchYearById.set(match.id as string, (match.match_date as string).slice(0, 4))
    }
  }

  const [subOnRes, subOffRes, goalsRes, assistsRes] = await Promise.all([
    supabase
      .from('tbl_Match_Events')
      .select('match_id')
      .eq('event_type', 'SUBSTITUTION')
      .eq('secondary_person_id', personId)
      .in('match_id', matchIds),
    supabase
      .from('tbl_Match_Events')
      .select('match_id')
      .eq('event_type', 'SUBSTITUTION')
      .eq('primary_person_id', personId)
      .in('match_id', matchIds),
    supabase
      .from('tbl_Match_Events')
      .select('match_id')
      .in('event_type', ['GOAL', 'PENALTY_GOAL'])
      .eq('primary_person_id', personId)
      .in('match_id', matchIds),
    supabase
      .from('tbl_Match_Events')
      .select('match_id')
      .in('event_type', ['GOAL', 'OWN_GOAL'])
      .eq('secondary_person_id', personId)
      .in('match_id', matchIds),
  ])

  if (subOnRes.error) throw new Error(`tbl_Match_Events (year stats sub on): ${subOnRes.error.message}`)
  if (subOffRes.error) throw new Error(`tbl_Match_Events (year stats sub off): ${subOffRes.error.message}`)
  if (goalsRes.error) throw new Error(`tbl_Match_Events (year stats goals): ${goalsRes.error.message}`)
  if (assistsRes.error) throw new Error(`tbl_Match_Events (year stats assists): ${assistsRes.error.message}`)

  const subOnMatchIds = new Set((subOnRes.data ?? []).map((e) => e.match_id as string))

  const result: Record<string, AdminPlayerYearStats> = {}
  const ensureYear = (year: string): AdminPlayerYearStats => {
    if (!result[year]) {
      result[year] = {
        appearance_count: 0,
        starting_appearance_count: 0,
        sub_on_count: 0,
        sub_off_count: 0,
        bench_count: 0,
        goal_count: 0,
        assist_count: 0,
      }
    }
    return result[year]
  }

  for (const participation of participations) {
    const matchId = participation.match_id as string
    const year = matchYearById.get(matchId)
    if (!year) continue

    const stats = ensureYear(year)
    if (participation.is_starting) {
      stats.appearance_count += 1
      stats.starting_appearance_count += 1
      continue
    }

    if (subOnMatchIds.has(matchId)) {
      stats.appearance_count += 1
      stats.sub_on_count += 1
    } else {
      stats.bench_count += 1
    }
  }

  for (const event of subOffRes.data ?? []) {
    const year = matchYearById.get(event.match_id as string)
    if (!year) continue
    ensureYear(year).sub_off_count += 1
  }

  for (const event of goalsRes.data ?? []) {
    const year = matchYearById.get(event.match_id as string)
    if (!year) continue
    ensureYear(year).goal_count += 1
  }

  for (const event of assistsRes.data ?? []) {
    const year = matchYearById.get(event.match_id as string)
    if (!year) continue
    ensureYear(year).assist_count += 1
  }

  return result
}

export async function getAdminMatchYearBounds(): Promise<AdminMatchYearBounds | null> {
  const supabase = createServiceRoleClient()

  const [{ data: earliest, error: earliestError }, { data: latest, error: latestError }] = await Promise.all([
    supabase.from('tbl_Matches').select('match_date').order('match_date', { ascending: true }).limit(1),
    supabase.from('tbl_Matches').select('match_date').order('match_date', { ascending: false }).limit(1),
  ])

  if (earliestError) throw new Error(`tbl_Matches (earliest): ${earliestError.message}`)
  if (latestError) throw new Error(`tbl_Matches (latest): ${latestError.message}`)

  const minDate = earliest?.[0]?.match_date as string | undefined
  const maxDate = latest?.[0]?.match_date as string | undefined
  if (!minDate || !maxDate) {
    return null
  }

  return {
    minYear: Number(minDate.slice(0, 4)),
    maxYear: Number(maxDate.slice(0, 4)),
  }
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

  let matchLevelIdByMatchId = new Map<string, string | null>()
  const { data: matchesWithLevel, error: matchesWithLevelError } = await supabase
    .from('tbl_Matches')
    .select('id, match_level_id')
    .in('id', matches.map((match) => match.id))

  if (matchesWithLevelError) {
    if (!isMissingSchemaObjectMessage(matchesWithLevelError.message, 'match_level_id')) {
      throw new Error(`tbl_Matches (match_level_id): ${matchesWithLevelError.message}`)
    }
  } else {
    matchLevelIdByMatchId = new Map(
      (matchesWithLevel ?? []).map((row) => [
        row.id as string,
        (row.match_level_id as string | null | undefined) ?? null,
      ])
    )
  }

  const matchLevelIds = [...new Set(
    [...matchLevelIdByMatchId.values()].filter((id): id is string => Boolean(id))
  )]

  let matchLevelNameById = new Map<string, string>()
  if (matchLevelIds.length > 0) {
    const { data: levels, error: levelsError } = await supabase
      .from('tbl_Match_Levels')
      .select('id, name')
      .in('id', matchLevelIds)

    if (levelsError) {
      if (!isMissingSchemaObjectMessage(levelsError.message, 'tbl_match_levels')) {
        throw new Error(`tbl_Match_Levels: ${levelsError.message}`)
      }
    } else {
      matchLevelNameById = new Map((levels ?? []).map((level) => [level.id as string, level.name as string]))
    }
  }

  const [{ data: matchEvents, error: matchEventsError }, teamNameMap, teamFifaMap] = await Promise.all([
    supabase
      .from('tbl_Match_Events')
      .select('match_id, team_id, event_type')
      .in('match_id', matches.map((match) => match.id)),
    getTeamDisplayMap(teamIds),
    getTeamCountryFifaCodeMap(teamIds),
  ])

  if (matchEventsError) throw new Error(`tbl_Match_Events: ${matchEventsError.message}`)

  // 3. Lookup maps
  const compMap = new Map(competitions?.map((c) => [c.id, c.name]) ?? [])
  const eventsByMatchId = new Map<string, Array<Pick<MatchEventRow, 'team_id' | 'event_type'>>>()

  for (const event of ((matchEvents ?? []) as Array<Pick<MatchEventRow, 'match_id' | 'team_id' | 'event_type'>>)) {
    if (!event.match_id) continue
    const existing = eventsByMatchId.get(event.match_id) ?? []
    existing.push({ team_id: event.team_id, event_type: event.event_type })
    eventsByMatchId.set(event.match_id, existing)
  }

  function getFinalScore(match: MatchListRow): string | null {
    const events = eventsByMatchId.get(match.id) ?? []
    if (!events.length) return null

    let homeGoals = 0
    let awayGoals = 0

    for (const event of events) {
      if (event.event_type !== 'GOAL' && event.event_type !== 'OWN_GOAL' && event.event_type !== 'PENALTY_GOAL') {
        continue
      }

      if (event.team_id === match.home_team_id) {
        homeGoals += 1
      } else if (event.team_id === match.away_team_id) {
        awayGoals += 1
      }
    }

    return `${homeGoals}:${awayGoals}`
  }

  function getShootoutScore(match: MatchListRow): string | null {
    if (match.result_type !== 'PENALTIES' && match.result_type !== 'EXTRA_TIME_AND_PENALTIES') return null
    const events = eventsByMatchId.get(match.id) ?? []
    let homeGoals = 0
    let awayGoals = 0
    for (const event of events) {
      if (event.event_type !== 'PENALTY_SHOOTOUT_SCORED') continue
      if (event.team_id === match.home_team_id) homeGoals += 1
      else if (event.team_id === match.away_team_id) awayGoals += 1
    }
    return `${homeGoals}:${awayGoals}`
  }

  // 4. Assemble
  return matches.map((m) => ({
    id: m.id,
    match_date: m.match_date,
    match_time: m.match_time ?? null,
    match_status: m.match_status,
    result_type: m.result_type,
    editorial_status: m.editorial_status,
    competition_name: compMap.get(m.competition_id) ?? '—',
    match_level_name: (() => {
      const levelId = matchLevelIdByMatchId.get(m.id)
      if (!levelId) return null
      return matchLevelNameById.get(levelId) ?? null
    })(),
    home_team_name: teamNameMap.get(m.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(m.away_team_id) ?? '—',
    home_team_fifa_code: teamFifaMap.get(m.home_team_id) ?? null,
    away_team_fifa_code: teamFifaMap.get(m.away_team_id) ?? null,
    final_score: getFinalScore(m),
    shootout_score: getShootoutScore(m),
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

  const [{ data: competition, error: competitionError }, teamNameMap, teamFifaMap] = await Promise.all([
    supabase
      .from('tbl_Competitions')
      .select('id, name')
      .eq('id', match.competition_id)
      .maybeSingle(),
    getTeamDisplayMap([match.home_team_id, match.away_team_id]),
    getTeamCountryFifaCodeMap([match.home_team_id, match.away_team_id]),
  ])

  if (competitionError) throw new Error(`tbl_Competitions: ${competitionError.message}`)

  let matchLevelId: string | null = null
  let matchLevelName: string | null = null

  const { data: levelRow, error: levelRowError } = await supabase
    .from('tbl_Matches')
    .select('match_level_id')
    .eq('id', id)
    .maybeSingle()

  if (levelRowError) {
    if (!isMissingSchemaObjectMessage(levelRowError.message, 'match_level_id')) {
      throw new Error(`tbl_Matches (match_level_id): ${levelRowError.message}`)
    }
  } else {
    matchLevelId = (levelRow?.match_level_id as string | null | undefined) ?? null

    if (matchLevelId) {
      const { data: level, error: levelError } = await supabase
        .from('tbl_Match_Levels')
        .select('id, name')
        .eq('id', matchLevelId)
        .maybeSingle()

      if (levelError) {
        if (!isMissingSchemaObjectMessage(levelError.message, 'tbl_match_levels')) {
          throw new Error(`tbl_Match_Levels: ${levelError.message}`)
        }
      } else {
        matchLevelName = (level?.name as string | null | undefined) ?? null
      }
    }
  }

  return {
    id: match.id,
    match_date: match.match_date,
    match_time: match.match_time ?? null,
    match_status: match.match_status,
    result_type: match.result_type,
    editorial_status: match.editorial_status,
    competition_name: competition?.name ?? '—',
    match_level_name: matchLevelName,
    home_team_name: teamNameMap.get(match.home_team_id) ?? '—',
    away_team_name: teamNameMap.get(match.away_team_id) ?? '—',
    final_score: null,
    competition_id: match.competition_id,
    match_level_id: matchLevelId,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    home_team_fifa_code: teamFifaMap.get(match.home_team_id) ?? null,
    away_team_fifa_code: teamFifaMap.get(match.away_team_id) ?? null,
    match_city_id: match.match_city_id ?? null,
    match_stadium_id: match.match_stadium_id ?? null,
    shootout_score: null,
  }
}

export async function getPublicMatchDetails(id: string): Promise<AdminMatchDetails | null> {
  return unstable_cache(
    async () => getAdminMatchDetails(id),
    ['public-match-details', id],
    {
      revalidate: 86400,
      tags: ['public-matches', `public-match:${id}`],
    }
  )()
}

export async function getPublicMatchParticipants(match: Pick<AdminMatchDetails, 'id' | 'home_team_id' | 'away_team_id'>): Promise<{
  homeParticipants: AdminMatchParticipant[]
  awayParticipants: AdminMatchParticipant[]
  referees: AdminMatchParticipant[]
  people: AdminMatchParticipantPersonOption[]
}> {
  return unstable_cache(
    async () => {
      const supabase = createServiceRoleClient()

  const { data: participants, error: participantsError } = await supabase
    .from('tbl_Match_Participants')
    .select('id, team_id, person_id, role, is_starting, player_position, club_team_id')
    .eq('match_id', match.id)

  if (participantsError) throw new Error(`tbl_Match_Participants: ${participantsError.message}`)

  const participantRows = (participants ?? []) as MatchParticipantRow[]
  const personIds = [...new Set(participantRows.map((participant) => participant.person_id))]

  const { data: people, error: peopleError } = personIds.length
    ? await supabase
        .from('tbl_People')
        .select('id, first_name, last_name, nickname')
        .in('id', personIds)
    : { data: [] as MatchParticipantPersonRow[], error: null }

  if (peopleError) throw new Error(`tbl_People: ${peopleError.message}`)

  const peopleRows = (people ?? []) as MatchParticipantPersonRow[]
  const peopleById = new Map(peopleRows.map((person) => [person.id, person]))

  const participantsWithCountryCodeIds = [...new Set(
    participantRows
      .filter((participant) => participant.role === 'REFEREE' || participant.role === 'COACH')
      .map((participant) => participant.person_id)
  )]

  const [personCountriesRes, birthCountriesRes] = participantsWithCountryCodeIds.length
    ? await Promise.all([
        supabase
          .from('tbl_Person_Countries')
          .select('person_id, country_id')
          .in('person_id', participantsWithCountryCodeIds)
          .order('country_id', { ascending: true }),
        supabase
          .from('tbl_People')
          .select('id, birth_country_id')
          .in('id', participantsWithCountryCodeIds),
      ])
    : [
        { data: [] as PersonCountryAssignmentRow[], error: null },
        { data: [] as PersonBirthCountryRow[], error: null },
      ]

  if (personCountriesRes.error) throw new Error(`tbl_Person_Countries: ${personCountriesRes.error.message}`)
  if (birthCountriesRes.error) throw new Error(`tbl_People (birth_country_id): ${birthCountriesRes.error.message}`)

  const personCountryRows = (personCountriesRes.data ?? []) as PersonCountryAssignmentRow[]
  const participantsBirthCountryRows = (birthCountriesRes.data ?? []) as PersonBirthCountryRow[]
  const participantsCountryIds = [...new Set([
    ...personCountryRows.map((row) => row.country_id),
    ...participantsBirthCountryRows
      .map((row) => row.birth_country_id)
      .filter((countryId): countryId is string => Boolean(countryId)),
  ])]

  const { data: countries, error: countriesError } = participantsCountryIds.length
    ? await supabase
        .from('tbl_Countries')
        .select('id, fifa_code')
        .in('id', participantsCountryIds)
    : { data: [] as CountryCodeRow[], error: null }

  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const countryCodeMap = new Map(
    ((countries ?? []) as CountryCodeRow[])
      .filter((row): row is { id: string; fifa_code: string } => Boolean(row.fifa_code))
      .map((row) => [row.id, row.fifa_code])
  )

  const personCountryMap = new Map<string, string>()
  for (const row of personCountryRows) {
    if (personCountryMap.has(row.person_id)) continue
    const code = countryCodeMap.get(row.country_id)
    if (code) personCountryMap.set(row.person_id, code)
  }
  for (const row of participantsBirthCountryRows) {
    if (personCountryMap.has(row.id)) continue
    if (!row.birth_country_id) continue
    const code = countryCodeMap.get(row.birth_country_id)
    if (code) personCountryMap.set(row.id, code)
  }

  const mappedParticipants = participantRows.map((participant) => ({
    id: participant.id,
    team_id: participant.team_id,
    person_id: participant.person_id,
    person_name: buildPersonDisplayName(peopleById.get(participant.person_id) ?? { id: participant.person_id, first_name: null, last_name: null, nickname: null }),
    role: participant.role,
    is_starting: participant.is_starting,
    player_position: participant.player_position,
    club_team_id: participant.club_team_id,
    club_team_name: null,
    derived_club_team_name: null,
    country_code: participant.role === 'REFEREE' || participant.role === 'COACH'
      ? personCountryMap.get(participant.person_id) ?? undefined
      : undefined,
  } satisfies AdminMatchParticipant))

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
    },
    ['public-match-participants', match.id],
    {
      revalidate: 86400,
      tags: [`public-match:${match.id}`],
    }
  )()
}

export async function getPublicMatchEvents(matchId: string): Promise<AdminMatchEvent[]> {
  return unstable_cache(
    async () => getAdminMatchEvents(matchId),
    ['public-match-events', matchId],
    {
      revalidate: 86400,
      tags: [`public-match:${matchId}`],
    }
  )()
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
  const coachPersonIds = [...new Set(
    participantRows
      .filter((participant) => participant.role === 'COACH')
      .map((participant) => participant.person_id)
  )]
  const participantsWithCountryCodeIds = [...new Set([...refereePersonIds, ...coachPersonIds])]

  const { data: periods, error: periodsError } = personIds.length
    ? await supabase
        .from('tbl_Person_Team_Periods')
        .select('person_id, club_team_id, valid_from, valid_to')
        .in('person_id', personIds)
    : { data: [] as PersonTeamPeriodRow[], error: null }

  const [
    { data: personCountries, error: personCountriesError },
    { data: participantsBirthCountries, error: participantsBirthCountriesError },
  ] = participantsWithCountryCodeIds.length
    ? await Promise.all([
        refereePersonIds.length
          ? supabase
              .from('tbl_Person_Countries')
              .select('person_id, country_id')
              .in('person_id', refereePersonIds)
              .order('country_id', { ascending: true })
          : Promise.resolve({ data: [] as PersonCountryAssignmentRow[], error: null }),
        supabase
          .from('tbl_People')
          .select('id, birth_country_id')
          .in('id', participantsWithCountryCodeIds),
      ])
    : [
        { data: [] as PersonCountryAssignmentRow[], error: null },
        { data: [] as PersonBirthCountryRow[], error: null },
      ]

  const personCountryRows = (personCountries ?? []) as PersonCountryAssignmentRow[]
  const participantsBirthCountryRows = (participantsBirthCountries ?? []) as PersonBirthCountryRow[]
  const participantsCountryIds = [...new Set([
    ...personCountryRows.map((row) => row.country_id),
    ...participantsBirthCountryRows
      .map((row) => row.birth_country_id)
      .filter((countryId): countryId is string => Boolean(countryId)),
  ])]

  const { data: countries, error: countriesError } = participantsCountryIds.length
    ? await supabase
        .from('tbl_Countries')
        .select('id, fifa_code')
        .in('id', participantsCountryIds)
    : { data: [] as CountryCodeRow[], error: null }

  if (periodsError) throw new Error(`tbl_Person_Team_Periods: ${periodsError.message}`)
  if (personCountriesError) throw new Error(`tbl_Person_Countries: ${personCountriesError.message}`)
  if (participantsBirthCountriesError) throw new Error(`tbl_People (birth_country_id): ${participantsBirthCountriesError.message}`)
  if (countriesError) throw new Error(`tbl_Countries: ${countriesError.message}`)

  const periodsByPerson = new Map<string, PersonTeamPeriodRow[]>()
  for (const period of (periods ?? []) as PersonTeamPeriodRow[]) {
    const existing = periodsByPerson.get(period.person_id) ?? []
    existing.push(period)
    periodsByPerson.set(period.person_id, existing)
  }

  const countryCodeMap = new Map(
    ((countries ?? []) as CountryCodeRow[])
      .filter((row): row is { id: string; fifa_code: string } => Boolean(row.fifa_code))
      .map((row) => [row.id, row.fifa_code])
  )

  const personCountryMap = new Map<string, string>()
  for (const row of personCountryRows) {
    if (personCountryMap.has(row.person_id)) continue
    const code = countryCodeMap.get(row.country_id)
    if (code) personCountryMap.set(row.person_id, code)
  }
  for (const row of participantsBirthCountryRows) {
    if (personCountryMap.has(row.id)) continue
    if (!row.birth_country_id) continue
    const code = countryCodeMap.get(row.birth_country_id)
    if (code) personCountryMap.set(row.id, code)
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
      country_code: participant.role === 'REFEREE' || participant.role === 'COACH'
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
  matchLevels: AdminMatchLevelOption[]
  teams: AdminTeamOption[]
  cities: AdminCityOption[]
  stadiums: AdminStadiumOption[]
}> {
  const supabase = createServiceRoleClient()
  type TeamOptionRow = { id: string; country_id: string | null; club_id: string | null }
  type NamedRow = { id: string; name: string }

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
    supabase.from('tbl_Teams').select('id, country_id, club_id').order('id', { ascending: true }),
    supabase.from('tbl_Cities').select('id, city_name').order('city_name', { ascending: true }),
    supabase.from('tbl_Stadiums').select('id, name, stadium_city_id').order('name', { ascending: true }),
  ])

  if (competitionsError) throw new Error(`tbl_Competitions: ${competitionsError.message}`)
  if (teamsError) throw new Error(`tbl_Teams: ${teamsError.message}`)
  if (citiesError) throw new Error(`tbl_Cities: ${citiesError.message}`)
  if (stadiumsError) throw new Error(`tbl_Stadiums: ${stadiumsError.message}`)

  let matchLevels: AdminMatchLevelOption[] = []

  const { data: levels, error: levelsError } = await supabase
    .from('tbl_Match_Levels')
    .select('id, name')
    .order('name', { ascending: true })

  if (levelsError) {
    if (!isMissingSchemaObjectMessage(levelsError.message, 'tbl_match_levels')) {
      throw new Error(`tbl_Match_Levels: ${levelsError.message}`)
    }
  } else {
    matchLevels = levels ?? []
  }

  const cityNameMap = new Map((cities ?? []).map((city) => [city.id, city.city_name]))

  const typedTeams = (teams ?? []) as TeamOptionRow[]
  const countryIds = [...new Set(typedTeams.map((team) => team.country_id).filter(Boolean))]
  const clubIds = [...new Set(typedTeams.map((team) => team.club_id).filter(Boolean))]
  const [countriesByTeam, clubsByTeam] = await Promise.all([
    countryIds.length
      ? supabase.from('tbl_Countries').select('id, name').in('id', countryIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
    clubIds.length
      ? supabase.from('tbl_Clubs').select('id, name').in('id', clubIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
  ])

  if (countriesByTeam.error) throw new Error(`tbl_Countries: ${countriesByTeam.error.message}`)
  if (clubsByTeam.error) throw new Error(`tbl_Clubs: ${clubsByTeam.error.message}`)

  const countryNameById = new Map((countriesByTeam.data ?? []).map((country) => [country.id, country.name]))
  const clubNameById = new Map((clubsByTeam.data ?? []).map((club) => [club.id, club.name]))

  const teamOptions = typedTeams
    .map((team) => ({
      id: team.id,
      label: team.country_id
        ? (countryNameById.get(team.country_id) ?? '—')
        : (team.club_id ? (clubNameById.get(team.club_id) ?? '—') : '—'),
    }))
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
    matchLevels,
    teams: teamOptions,
    cities: cityOptions,
    stadiums: stadiumOptions,
  }
}

export async function getAdminMatchEvents(matchId: string): Promise<AdminMatchEvent[]> {
  const supabase = createServiceRoleClient()

  const { data: events, error } = await supabase
    .from('tbl_Match_Events')
    .select('id, team_id, event_type, minute, minute_extra, primary_person_id, secondary_person_id, notes, event_order')
    .eq('match_id', matchId)
    .order('minute', { ascending: true })
    .order('minute_extra', { ascending: true, nullsFirst: true })
    .order('event_order', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })

  if (error) throw new Error(`tbl_Match_Events: ${error.message}`)

  return ((events ?? []) as MatchEventRow[]).map((row) => ({
    id: row.id,
    team_id: row.team_id,
    event_type: row.event_type,
    minute: row.minute,
    minute_extra: row.minute_extra,
    primary_person_id: row.primary_person_id,
    secondary_person_id: row.secondary_person_id,
    notes: row.notes,
    event_order: row.event_order,
  }))
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
  options?: { excludeMatchId?: string; targetMatchDate?: string }
): Promise<Record<string, string | null>> {
  const supabase = createServiceRoleClient()

  if (!personIds.length) {
    return {}
  }

  const CHUNK_SIZE = 80
  const chunks: string[][] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    chunks.push(personIds.slice(i, i + CHUNK_SIZE))
  }

  const allRows: PlayerClubSuggestionRow[] = []
  for (const chunk of chunks) {
    let q = supabase
      .from('tbl_Match_Participants')
      .select('person_id, club_team_id, match_id')
      .eq('role', 'PLAYER')
      .in('person_id', chunk)
    if (options?.excludeMatchId) {
      q = q.neq('match_id', options.excludeMatchId)
    }
    const { data, error } = await q
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allRows.push(...((data ?? []) as PlayerClubSuggestionRow[]))
  }

  const rows = allRows
  if (!rows.length) {
    return {}
  }

  const matchIds = [...new Set(rows.map((row) => row.match_id))]
  const allMatches: MatchDateRow[] = []
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, match_date')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches: ${error.message}`)
    allMatches.push(...((data ?? []) as MatchDateRow[]))
  }

  const matchDateMap = new Map(allMatches.map((match: MatchDateRow) => [match.id, match.match_date]))

  const calculateDateDistance = (dateStr: string, targetDate: string | undefined): number => {
    if (!targetDate) return 0
    const dateDiff = new Date(dateStr).getTime() - new Date(targetDate).getTime()
    return Math.abs(dateDiff)
  }

  const bestByPerson = new Map<string, { clubTeamId: string | null; matchDate: string; matchId: string; distance: number }>()
  for (const row of rows) {
    const matchDate = matchDateMap.get(row.match_id)
    if (!matchDate) continue

    const distance = calculateDateDistance(matchDate, options?.targetMatchDate)
    const current = bestByPerson.get(row.person_id)
    if (!current) {
      bestByPerson.set(row.person_id, {
        clubTeamId: row.club_team_id,
        matchDate,
        matchId: row.match_id,
        distance,
      })
      continue
    }

    const isCloser = distance < current.distance
      || (distance === current.distance && row.match_id > current.matchId)

    if (isCloser) {
      bestByPerson.set(row.person_id, {
        clubTeamId: row.club_team_id,
        matchDate,
        matchId: row.match_id,
        distance,
      })
    }
  }

  return Object.fromEntries(
    [...bestByPerson.entries()].map(([personId, value]) => [personId, value.clubTeamId])
  )
}

export async function getLatestPlayerPositionByPersonIds(
  personIds: string[],
  options?: { excludeMatchId?: string }
): Promise<Record<string, PlayerPosition | null>> {
  const supabase = createServiceRoleClient()

  if (!personIds.length) {
    return {}
  }

  const CHUNK_SIZE = 80
  const allRows: PlayerClubSuggestionRow[] = []
  for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
    let q = supabase
      .from('tbl_Match_Participants')
      .select('person_id, player_position, match_id')
      .eq('role', 'PLAYER')
      .in('person_id', personIds.slice(i, i + CHUNK_SIZE))
    if (options?.excludeMatchId) {
      q = q.neq('match_id', options.excludeMatchId)
    }
    const { data, error } = await q
    if (error) throw new Error(`tbl_Match_Participants: ${error.message}`)
    allRows.push(...((data ?? []) as PlayerClubSuggestionRow[]))
  }

  const rows = allRows
  if (!rows.length) {
    return {}
  }

  const matchIds = [...new Set(rows.map((row) => row.match_id))]
  const allMatches: MatchDateRow[] = []
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('tbl_Matches')
      .select('id, match_date')
      .in('id', matchIds.slice(i, i + CHUNK_SIZE))
    if (error) throw new Error(`tbl_Matches: ${error.message}`)
    allMatches.push(...((data ?? []) as MatchDateRow[]))
  }

  const matchDateMap = new Map(allMatches.map((match: MatchDateRow) => [match.id, match.match_date]))

  const bestByPerson = new Map<string, { playerPosition: PlayerPosition | null; matchDate: string; matchId: string }>()
  for (const row of rows) {
    const matchDate = matchDateMap.get(row.match_id)
    if (!matchDate) continue

    const current = bestByPerson.get(row.person_id)
    if (!current) {
      bestByPerson.set(row.person_id, {
        playerPosition: row.player_position,
        matchDate,
        matchId: row.match_id,
      })
      continue
    }

    const isNewer = matchDate > current.matchDate
      || (matchDate === current.matchDate && row.match_id > current.matchId)

    if (isNewer) {
      bestByPerson.set(row.person_id, {
        playerPosition: row.player_position,
        matchDate,
        matchId: row.match_id,
      })
    }
  }

  return Object.fromEntries(
    [...bestByPerson.entries()].map(([personId, value]) => [personId, value.playerPosition])
  )
}

export async function getMatchesYearStats(
  matchesInput: { id: string; match_date: string }[]
): Promise<MatchYearStatsData> {
  const empty: MatchYearStatsData = { coaches: {}, topAppearances: {}, topScorers: {} }
  if (!matchesInput.length) return empty

  const supabase = createServiceRoleClient()
  const matchIds = matchesInput.map((m) => m.id)
  const yearByMatchId = new Map(matchesInput.map((m) => [m.id, m.match_date.slice(0, 4)]))

  // 1. Find Poland's team ID via country name
  const { data: polandCountry } = await supabase
    .from('tbl_Countries')
    .select('id')
    .ilike('name', 'Polska')
    .maybeSingle()

  if (!polandCountry) return empty

  const { data: polandTeamRow } = await supabase
    .from('tbl_Teams')
    .select('id')
    .eq('country_id', polandCountry.id)
    .maybeSingle()

  if (!polandTeamRow) return empty

  const polandTeamId = (polandTeamRow as { id: string }).id

  // 2. Get all Poland participants for these matches
  const { data: participants, error: partError } = await supabase
    .from('tbl_Match_Participants')
    .select('match_id, person_id, role, is_starting')
    .in('match_id', matchIds)
    .eq('team_id', polandTeamId)

  if (partError || !participants?.length) return empty

  // 3. Get substitution events to find players who came on from the bench
  const { data: subEvents } = await supabase
    .from('tbl_Match_Events')
    .select('match_id, secondary_person_id')
    .in('match_id', matchIds)
    .eq('event_type', 'SUBSTITUTION')
    .not('secondary_person_id', 'is', null)

  const substitutedInByMatch = new Map<string, Set<string>>()
  for (const ev of (subEvents ?? []) as Array<{ match_id: string; secondary_person_id: string }>) {
    if (!substitutedInByMatch.has(ev.match_id)) substitutedInByMatch.set(ev.match_id, new Set())
    substitutedInByMatch.get(ev.match_id)!.add(ev.secondary_person_id)
  }

  // 3. Get person names
  const personIds = [...new Set((participants as Array<{ person_id: string }>).map((p) => p.person_id))]
  const { data: people } = await supabase
    .from('tbl_People')
    .select('id, first_name, last_name, nickname')
    .in('id', personIds)

  const personNameMap = new Map<string, string>()
  for (const person of (people ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; nickname: string | null }>) {
    const first = person.first_name?.trim() ?? ''
    const last = person.last_name?.trim() ?? ''
    const nickname = person.nickname?.trim() ?? ''
    personNameMap.set(person.id, `${first} ${last}`.trim() || nickname || '—')
  }

  // 4. Aggregate coaches and appearances per year
  const coachYearMap = new Map<string, Map<string, number>>()
  const appearanceYearMap = new Map<string, Map<string, number>>()
  const polandPlayersByMatch = new Map<string, Set<string>>()

  for (const p of participants as Array<{ match_id: string; person_id: string; role: string; is_starting: boolean | null }>) {
    const year = yearByMatchId.get(p.match_id)
    if (!year) continue

    if (p.role === 'COACH') {
      if (!coachYearMap.has(year)) coachYearMap.set(year, new Map())
      const m = coachYearMap.get(year)!
      m.set(p.person_id, (m.get(p.person_id) ?? 0) + 1)
    } else if (p.role === 'PLAYER') {
      const playedInMatch = p.is_starting === true || substitutedInByMatch.get(p.match_id)?.has(p.person_id) === true
      if (playedInMatch) {
        if (!appearanceYearMap.has(year)) appearanceYearMap.set(year, new Map())
        const m = appearanceYearMap.get(year)!
        m.set(p.person_id, (m.get(p.person_id) ?? 0) + 1)
      }

      if (!polandPlayersByMatch.has(p.match_id)) polandPlayersByMatch.set(p.match_id, new Set())
      polandPlayersByMatch.get(p.match_id)!.add(p.person_id)
    }
  }

  // 5. Get goal events for these matches
  const { data: goalEvents } = await supabase
    .from('tbl_Match_Events')
    .select('match_id, primary_person_id, event_type')
    .in('match_id', matchIds)
    .in('event_type', ['GOAL', 'PENALTY_GOAL'])
    .not('primary_person_id', 'is', null)

  const goalYearMap = new Map<string, Map<string, number>>()

  for (const event of (goalEvents ?? []) as Array<{ match_id: string; primary_person_id: string; event_type: string }>) {
    const year = yearByMatchId.get(event.match_id)
    if (!year) continue
    if (!polandPlayersByMatch.get(event.match_id)?.has(event.primary_person_id)) continue
    if (!goalYearMap.has(year)) goalYearMap.set(year, new Map())
    const m = goalYearMap.get(year)!
    m.set(event.primary_person_id, (m.get(event.primary_person_id) ?? 0) + 1)
  }

  // 6. Convert to sorted result arrays
  const coaches: Record<string, YearCoachEntry[]> = {}
  for (const [year, countMap] of coachYearMap) {
    coaches[year] = [...countMap.entries()]
      .map(([personId, matchCount]) => ({ personId, name: personNameMap.get(personId) ?? '—', matchCount }))
      .sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name, 'pl'))
  }

  const topAppearances: Record<string, YearAppearanceEntry[]> = {}
  for (const [year, countMap] of appearanceYearMap) {
    topAppearances[year] = [...countMap.entries()]
      .map(([personId, matchCount]) => ({ personId, name: personNameMap.get(personId) ?? '—', matchCount }))
      .sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name, 'pl'))
      .slice(0, 2)
  }

  const topScorers: Record<string, YearGoalEntry[]> = {}
  for (const [year, countMap] of goalYearMap) {
    topScorers[year] = [...countMap.entries()]
      .map(([personId, goalCount]) => ({ personId, name: personNameMap.get(personId) ?? '—', goalCount }))
      .sort((a, b) => b.goalCount - a.goalCount || a.name.localeCompare(b.name, 'pl'))
      .slice(0, 3)
  }

  return { coaches, topAppearances, topScorers }
}
